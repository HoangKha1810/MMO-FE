import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedSessionUserId } from '@/lib/session-cookie';
import {
  buildVastOfferSearch,
  DEFAULT_VAST_MIN_INET_DOWN_MBPS,
  DEFAULT_VAST_MIN_INET_UP_MBPS,
  getVastDefaultImage,
  isVastConfigured,
  VastApiError,
  vastRequest,
} from '@/lib/vast-ai';
import { getLegacySettingsMap } from '@/lib/legacy-settings';
import { db } from '@/lib/db';
import {
  assertMainWalletCanPay,
  chargeFirstHourAndSaveVpsGpu,
  deleteOwnedVpsGpuInstance,
  extractCreatedProviderInstanceId,
  hasDueVpsGpuBillingRows,
  listOwnedVpsGpuBillings,
  markVpsGpuEnded,
  markVpsGpuProviderStatus,
  requireOwnedVpsGpuBilling,
  runVpsGpuHourlyBilling,
  toPublicBilling,
  type VpsGpuBillingRow,
} from '@/lib/vps-gpu-billing';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

type VastOffer = Record<string, unknown>;
type VastInstance = Record<string, unknown>;
type VastSshKey = Record<string, unknown>;
type WebDesktopEndpointSource = 'direct' | 'mapped' | 'legacy';
type WebDesktopEndpoint = {
  internalPort: number;
  publicPort: number;
  host: string;
  protocol: 'http' | 'https';
  url: string;
  label: string;
  source: WebDesktopEndpointSource;
  primary?: boolean;
};
type PricedHostnode = ReturnType<typeof mapOfferToHostnode> & {
  pricing?: Record<string, unknown>;
};

interface VpsGpuPricingSettings {
  usdToVnd: number;
  priceMultiplier: number;
  hourlyFeeVnd: number;
  internetReserveVnd: number;
}

const VPS_GPU_OFFER_COSTS_TABLE = 'vps_gpu_offer_costs';
const PROVIDER_MISSING_GRACE_MS = 2 * 60 * 1000;
const DEFAULT_VPS_GPU_USD_TO_VND = 26000;
const VPS_GPU_PROFIT_MARKUP = 0.67;
const DEFAULT_VPS_GPU_PRICE_MULTIPLIER = 1 + VPS_GPU_PROFIT_MARKUP;
const MIN_VPS_GPU_PRICE_MULTIPLIER = DEFAULT_VPS_GPU_PRICE_MULTIPLIER;
const MAX_VPS_GPU_PRICE_MULTIPLIER = DEFAULT_VPS_GPU_PRICE_MULTIPLIER;
const DEFAULT_VPS_GPU_HOURLY_FEE_VND = 0;
const DEFAULT_VPS_GPU_INTERNET_RESERVE_VND = 50000;
let activeVpsGpuBillingSweep: Promise<void> | null = null;

async function requireUser() {
  return getVerifiedSessionUserId();
}

function json(data: Record<string, unknown>, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      ...noStoreHeaders,
      ...(init?.headers || {}),
    },
  });
}

function normalizePath(value: string) {
  return value.replace(/^\/+/, '').replace(/\/+$/, '');
}

function toArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function normalizePositiveInt(value: unknown, fallback: number) {
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeString(value: unknown, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeStatusValue(value: unknown) {
  const text = normalizeString(value).toLowerCase();
  return text === 'null' ? '' : text;
}

async function runVpsGpuBillingSweepIfDue(options: { force?: boolean } = {}) {
  const now = Date.now();
  if (!options.force) {
    const hasDueRows = await hasDueVpsGpuBillingRows(now);
    if (!hasDueRows) {
      return;
    }
  }

  if (activeVpsGpuBillingSweep) {
    await activeVpsGpuBillingSweep;
    return;
  }

  activeVpsGpuBillingSweep = runVpsGpuHourlyBilling()
    .then(() => undefined)
    .finally(() => {
      activeVpsGpuBillingSweep = null;
    });

  await activeVpsGpuBillingSweep;
}

function hasOwnField(record: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function isStaleOfferMessage(text: string) {
  return /no_such_ask|not available|instance type by id|offer.*(hết|không|not)|\/asks\/\d+/i.test(text);
}

function isProviderRuntimeError(text: string) {
  return /error response from daemon|failed to create task|oci runtime|cdi devices|unresolvable cdi|failed to create shim task|failed to inject|container.*failed|pull access denied|manifest unknown/i.test(text);
}

function isProviderImagePullRetry(text: string) {
  return /retrying in \d+\s*second|image.*retry|retry.*image|pull.*image|docker.*pull|toomanyrequests|timeout.*(registry|pull|image)|ghcr/i.test(text);
}

function sanitizeInstanceStatusMessage(value: unknown, fallback = '') {
  const text = normalizeString(value, fallback);
  if (!text) {
    return '';
  }

  if (/template\s+not\s+found/i.test(text)) {
    return '';
  }

  if (isProviderImagePullRetry(text)) {
    return 'Nguồn GPU đang kẹt kéo Docker image nên web desktop chưa chạy. Hãy xóa VPS này rồi tạo lại bằng Ubuntu XFCE noVNC hoặc chọn host network cao hơn.';
  }

  if (isProviderRuntimeError(text)) {
    return 'Máy nguồn không dựng được môi trường VPS cho gói này. Hãy xóa VPS này rồi chọn gói GPU hoặc image khác để tạo lại.';
  }

  return sanitizeProviderMessage(text, fallback);
}

function sanitizeProviderMessage(value: unknown, fallback = 'Nguồn GPU hiện chưa phản hồi') {
  const text = normalizeString(value, fallback);
  if (isStaleOfferMessage(text)) {
    return 'Gói GPU vừa được người khác thuê hoặc không còn khả dụng. Bấm Lọc gói rồi chọn gói khác.';
  }

  if (/HTTP\s+5\d\d|Something went wrong|Service Temporarily Unavailable/i.test(text)) {
    return 'Nguồn GPU đang bận hoặc chưa tạo được VPS lúc này. Hãy làm mới gói rồi thử lại.';
  }

  return text
    .replace(/API nguồn GPU\s+\/[^\s]+/gi, 'Nguồn GPU')
    .replace(/GPU API\s+\/[^\s]+/gi, 'Nguồn GPU')
    .replace(/Vast\.ai/gi, 'API GPU')
    .replace(/\bVast\b/g, 'API GPU')
    .replace(/\bvast\b/g, 'API GPU');
}

function normalizeBoolean(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function normalizePositiveNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeVpsGpuPriceMultiplier(value: unknown) {
  const parsed = normalizePositiveNumber(value, DEFAULT_VPS_GPU_PRICE_MULTIPLIER);
  return Math.min(MAX_VPS_GPU_PRICE_MULTIPLIER, Math.max(MIN_VPS_GPU_PRICE_MULTIPLIER, parsed));
}

function normalizeVpsGpuInternetReserveVnd(value: unknown) {
  return Math.max(
    DEFAULT_VPS_GPU_INTERNET_RESERVE_VND,
    roundPriceVnd(normalizePositiveNumber(value, DEFAULT_VPS_GPU_INTERNET_RESERVE_VND))
  );
}

function normalizeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isVerifiedOffer(offer: VastOffer) {
  const verificationText = normalizeString(
    offer.verification || offer.verification_status || offer.machine_verification || offer.host_verification
  ).toLowerCase();
  if (verificationText) {
    return verificationText === 'verified' || verificationText === 'secure cloud';
  }

  if (hasOwnField(offer, 'secure_cloud') && normalizeBoolean(offer.secure_cloud, false)) {
    return true;
  }

  for (const key of ['verified', 'is_verified', 'verified_machine', 'machine_verified']) {
    if (hasOwnField(offer, key)) {
      return normalizeBoolean(offer[key], false);
    }
  }

  for (const key of ['vericode', 'verification_code']) {
    if (hasOwnField(offer, key)) {
      return normalizeNumber(offer[key], 0) > 0;
    }
  }

  return true;
}

function normalizeStringList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeString(item)).filter(Boolean);
  }

  const text = normalizeString(value);
  return text ? text.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean) : [];
}

async function getVpsGpuPricingSettings(): Promise<VpsGpuPricingSettings> {
  const settings = await getLegacySettingsMap(true);

  return {
    usdToVnd: normalizePositiveNumber(settings.vps_gpu_usd_to_vnd, DEFAULT_VPS_GPU_USD_TO_VND),
    priceMultiplier: normalizeVpsGpuPriceMultiplier(settings.vps_gpu_price_multiplier),
    hourlyFeeVnd: DEFAULT_VPS_GPU_HOURLY_FEE_VND,
    internetReserveVnd: normalizeVpsGpuInternetReserveVnd(settings.vps_gpu_internet_reserve_vnd),
  };
}

function roundPriceVnd(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.ceil(value / 1000) * 1000;
}

function firstPositiveNumber(candidates: Array<readonly [string, unknown]>) {
  for (const [key, value] of candidates) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return { key, value: parsed };
    }
  }

  return { key: 'unknown', value: 0 };
}

function getVastPricingBreakdown(source: Record<string, unknown>) {
  const search = asRecord(source.search);
  const instance = asRecord(source.instance);
  const gpuHourly = firstPositiveNumber([
    ['search.gpuCostPerHour', search.gpuCostPerHour],
    ['instance.gpuCostPerHour', instance.gpuCostPerHour],
    ['gpu_cost_per_hour', source.gpu_cost_per_hour],
    ['gpuCostPerHour', source.gpuCostPerHour],
    ['dph_base', source.dph_base],
    ['dph', source.dph],
    ['min_bid', source.min_bid],
  ]);
  const storageHourly = firstPositiveNumber([
    ['search.diskHour', search.diskHour],
    ['instance.diskHour', instance.diskHour],
    ['diskHour', source.diskHour],
    ['disk_hour', source.disk_hour],
    ['storage_total_cost', source.storage_total_cost],
    ['storageTotalCost', source.storageTotalCost],
    ['storage_hourly', source.storage_hourly],
    ['storage_cost_per_hour', source.storage_cost_per_hour],
  ]);
  const totalHourly = firstPositiveNumber([
    ['search.totalHour', search.totalHour],
    ['instance.totalHour', instance.totalHour],
    ['totalHour', source.totalHour],
    ['dph_total', source.dph_total],
    ['dph_total_adj', source.dph_total_adj],
    ['total_hourly', source.total_hourly],
  ]);
  const fixedSubtotal = gpuHourly.value > 0 && storageHourly.value > 0
    ? gpuHourly.value + storageHourly.value
    : 0;
  const costHourlyUsd = Math.max(totalHourly.value, fixedSubtotal, gpuHourly.value);
  const internetUpCostPerTb = firstPositiveNumber([
    ['internet_up_cost_per_tb', source.internet_up_cost_per_tb],
    ['inet_up_cost_per_tb', source.inet_up_cost_per_tb],
  ]);
  const internetDownCostPerTb = firstPositiveNumber([
    ['internet_down_cost_per_tb', source.internet_down_cost_per_tb],
    ['inet_down_cost_per_tb', source.inet_down_cost_per_tb],
  ]);

  return {
    costSource: totalHourly.value > 0
      ? totalHourly.key
      : fixedSubtotal > 0
        ? `${gpuHourly.key}+${storageHourly.key}`
        : gpuHourly.key,
    gpuHourlyUsd: gpuHourly.value,
    storageHourlyUsd: storageHourly.value,
    fixedSubtotalHourlyUsd: fixedSubtotal,
    totalHourlyUsd: costHourlyUsd,
    internetUpCostPerTbUsd: internetUpCostPerTb.value,
    internetDownCostPerTbUsd: internetDownCostPerTb.value,
  };
}

function applyVpsGpuPricing<T extends { pricing?: Record<string, unknown> }>(
  hostnodes: T[],
  settings: VpsGpuPricingSettings
) {
  return hostnodes.map((hostnode) => {
    const pricing = asRecord(hostnode.pricing);
    const costHourlyUsd = normalizePositiveNumber(pricing.cost_hourly_usd, normalizePositiveNumber(pricing.total_hourly, 0));
    const costHourlyVnd = Math.round(costHourlyUsd * settings.usdToVnd);
    const saleHourlyVnd = roundPriceVnd(costHourlyVnd * settings.priceMultiplier + settings.hourlyFeeVnd);

    return {
      ...hostnode,
      pricing: {
        ...pricing,
        total_hourly: costHourlyUsd,
        cost_hourly_usd: costHourlyUsd,
        cost_hourly_vnd: costHourlyVnd,
        sale_hourly_vnd: saleHourlyVnd,
        profit_hourly_vnd: Math.max(0, saleHourlyVnd - costHourlyVnd),
        profit_markup: Math.max(0, settings.priceMultiplier - 1),
        price_multiplier: settings.priceMultiplier,
        hourly_fee_vnd: settings.hourlyFeeVnd,
        internet_reserve_vnd: settings.internetReserveVnd,
        usd_to_vnd: settings.usdToVnd,
      },
    };
  });
}

function getOfferCostSource(offer: VastOffer) {
  const breakdown = getVastPricingBreakdown(offer);
  return { key: breakdown.costSource, value: breakdown.totalHourlyUsd };
}

function getOfferId(offer: VastOffer) {
  return normalizeString(offer.ask_contract_id || offer.id || offer.machine_id);
}

async function ensureVpsGpuOfferCostsTable() {
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`${VPS_GPU_OFFER_COSTS_TABLE}\` (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      offer_id VARCHAR(80) NOT NULL,
      machine_id VARCHAR(80) NULL,
      host_id VARCHAR(80) NULL,
      gpu_name VARCHAR(255) NULL,
      gpu_count INT NULL DEFAULT 0,
      gpu_ram_gb DECIMAL(10,2) NULL DEFAULT 0,
      location VARCHAR(255) NULL,
      reliability DECIMAL(8,5) NULL DEFAULT 0,
      cost_source VARCHAR(50) NULL,
      cost_hourly_usd DECIMAL(14,6) NOT NULL DEFAULT 0,
      cost_hourly_vnd DECIMAL(15,2) NOT NULL DEFAULT 0,
      sale_hourly_vnd DECIMAL(15,2) NOT NULL DEFAULT 0,
      profit_hourly_vnd DECIMAL(15,2) NOT NULL DEFAULT 0,
      price_multiplier DECIMAL(8,4) NOT NULL DEFAULT 1.67,
      hourly_fee_vnd DECIMAL(15,2) NOT NULL DEFAULT 0,
      usd_to_vnd DECIMAL(15,2) NOT NULL DEFAULT 0,
      raw_offer LONGTEXT NULL,
      last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_vps_gpu_offer_id (offer_id),
      KEY idx_vps_gpu_cost_last_seen (last_seen_at),
      KEY idx_vps_gpu_cost_gpu (gpu_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function saveVpsGpuOfferCostSnapshots(
  offers: VastOffer[],
  hostnodes: PricedHostnode[],
  settings: VpsGpuPricingSettings
) {
  if (!offers.length || !hostnodes.length) {
    return;
  }

  try {
    await ensureVpsGpuOfferCostsTable();
    const hostnodeById = new Map(hostnodes.map((hostnode) => [String(hostnode.id), hostnode]));

    for (const offer of offers.slice(0, 120)) {
      const offerId = getOfferId(offer);
      if (!offerId) {
        continue;
      }

      const hostnode = hostnodeById.get(offerId);
      const pricing = asRecord(hostnode?.pricing);
      const costSource = getOfferCostSource(offer);
      const costHourlyUsd = Number(pricing.cost_hourly_usd || costSource.value || 0);
      const costHourlyVnd = Number(pricing.cost_hourly_vnd || Math.round(costHourlyUsd * settings.usdToVnd));
      const saleHourlyVnd = Number(pricing.sale_hourly_vnd || roundPriceVnd(costHourlyVnd * settings.priceMultiplier + settings.hourlyFeeVnd));
      const profitHourlyVnd = Math.max(0, saleHourlyVnd - costHourlyVnd);
      const gpuRamGb = Number(offer.gpu_ram || 0) / 1024;
      const location = formatOfferLocation(offer);

      await db.$executeRawUnsafe(
        `
          INSERT INTO \`${VPS_GPU_OFFER_COSTS_TABLE}\` (
            offer_id, machine_id, host_id, gpu_name, gpu_count, gpu_ram_gb, location, reliability,
            cost_source, cost_hourly_usd, cost_hourly_vnd, sale_hourly_vnd, profit_hourly_vnd,
            price_multiplier, hourly_fee_vnd, usd_to_vnd, raw_offer, last_seen_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON DUPLICATE KEY UPDATE
            machine_id = VALUES(machine_id),
            host_id = VALUES(host_id),
            gpu_name = VALUES(gpu_name),
            gpu_count = VALUES(gpu_count),
            gpu_ram_gb = VALUES(gpu_ram_gb),
            location = VALUES(location),
            reliability = VALUES(reliability),
            cost_source = VALUES(cost_source),
            cost_hourly_usd = VALUES(cost_hourly_usd),
            cost_hourly_vnd = VALUES(cost_hourly_vnd),
            sale_hourly_vnd = VALUES(sale_hourly_vnd),
            profit_hourly_vnd = VALUES(profit_hourly_vnd),
            price_multiplier = VALUES(price_multiplier),
            hourly_fee_vnd = VALUES(hourly_fee_vnd),
            usd_to_vnd = VALUES(usd_to_vnd),
            raw_offer = VALUES(raw_offer),
            last_seen_at = CURRENT_TIMESTAMP
        `,
        offerId,
        normalizeString(offer.machine_id),
        normalizeString(offer.host_id || offer.hostname),
        normalizeString(offer.gpu_name || offer.gpu_name_full || offer.gpu_display_name, 'GPU'),
        normalizePositiveInt(offer.num_gpus, 1),
        Number.isFinite(gpuRamGb) ? gpuRamGb : 0,
        location,
        Number(offer.reliability || 0),
        costSource.key,
        costHourlyUsd,
        costHourlyVnd,
        saleHourlyVnd,
        profitHourlyVnd,
        settings.priceMultiplier,
        settings.hourlyFeeVnd,
        settings.usdToVnd,
        JSON.stringify(offer)
      );
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[vps-gpu] Failed to save GPU offer cost snapshots', error);
    }
  }
}

function getAllowedInstanceAction(path: string) {
  const match = path.match(/^instances\/([^/]+)\/(start|stop)$/);
  if (!match) {
    return null;
  }

  return {
    id: match[1],
    action: match[2] as 'start' | 'stop',
  };
}

function extractOffers(payload: unknown): VastOffer[] {
  const data = asRecord(payload);
  return toArray(data.offers || data.results || data.data || payload).filter(isVerifiedOffer);
}

function extractInstances(payload: unknown): VastInstance[] {
  const data = asRecord(payload);
  const nestedData = asRecord(data.data);
  const nestedAttributes = asRecord(nestedData.attributes);
  return toArray(
    data.instances ||
    data.results ||
    nestedData.instances ||
    nestedData.results ||
    nestedAttributes.instances ||
    data.data ||
    payload
  );
}

function extractSshKeys(payload: unknown): VastSshKey[] {
  const data = asRecord(payload);
  return toArray(data.ssh_keys || data.keys || data.data || payload);
}

function mapOfferGpu(offer: VastOffer) {
  const gpuName = normalizeString(offer.gpu_name || offer.gpu_name_full || offer.gpu_display_name, 'GPU');
  const gpuRamMb = normalizePositiveInt(offer.gpu_ram, 0);
  const breakdown = getVastPricingBreakdown(offer);
  const priceHourly = breakdown.gpuHourlyUsd || breakdown.totalHourlyUsd;

  return {
    v0Name: gpuName,
    displayName: gpuRamMb ? `${gpuName} ${Math.round(gpuRamMb / 1024)}GB` : gpuName,
    max_count: normalizePositiveInt(offer.num_gpus, 1),
    availableCount: normalizePositiveInt(offer.num_gpus, 1),
    price_per_hr: Number.isFinite(priceHourly) ? priceHourly : 0,
    resources: {
      max_vcpus: normalizePositiveInt(offer.cpu_cores, 0),
      max_ram_gb: Math.round(normalizePositiveInt(offer.cpu_ram, 0) / 1024),
      max_storage_gb: normalizePositiveInt(offer.disk_space, 0),
    },
    pricing: {
      per_vcpu_hr: 0,
      per_gb_ram_hr: 0,
      per_gb_storage_hr: 0,
    },
    network_features: {
      dedicated_ip_available: true,
      port_forwarding_available: true,
      network_storage_available: false,
    },
  };
}

function parseGeolocation(value: unknown) {
  const text = normalizeString(value, 'Unknown location');
  const parts = text.split(',').map((item) => item.trim()).filter(Boolean);
  return {
    city: parts.length > 2 ? parts.slice(0, -2).join(', ') : undefined,
    stateprovince: parts.length > 2 ? parts.at(-2) : undefined,
    country: parts.at(-1) || text,
  };
}

function formatOfferLocation(offer: VastOffer) {
  const location = parseGeolocation(offer.geolocation || offer.location || offer.country);
  return [location.city, location.stateprovince, location.country].filter(Boolean).join(', ') || 'Unknown location';
}

function mapOfferToHostnode(offer: VastOffer) {
  const id = getOfferId(offer);
  const location = parseGeolocation(offer.geolocation || offer.location || offer.country);
  const gpu = mapOfferGpu(offer);
  const breakdown = getVastPricingBreakdown(offer);
  const priceHourly = breakdown.totalHourlyUsd;
  const reliability = Number(offer.reliability || 0);

  return {
    id,
    location_id: location.country,
    engine: normalizeString(offer.hostname || offer.machine_id || offer.host_id, `Offer GPU ${id}`),
    uptime_percentage: Number.isFinite(reliability) ? reliability * 100 : undefined,
    available_resources: {
      gpus: [gpu],
      vcpu_count: normalizePositiveInt(offer.cpu_cores, 0),
      ram_gb: Math.round(normalizePositiveInt(offer.cpu_ram, 0) / 1024),
      storage_gb: normalizePositiveInt(offer.disk_space, 0),
      has_public_ip_available: true,
    },
    pricing: {
      per_vcpu_hr: 0,
      per_gb_ram_hr: 0,
      per_gb_storage_hr: 0,
      gpu_hourly_usd: breakdown.gpuHourlyUsd,
      storage_hourly_usd: breakdown.storageHourlyUsd,
      fixed_subtotal_hourly_usd: breakdown.fixedSubtotalHourlyUsd,
      internet_up_cost_per_tb_usd: breakdown.internetUpCostPerTbUsd,
      internet_down_cost_per_tb_usd: breakdown.internetDownCostPerTbUsd,
      cost_source: breakdown.costSource,
      cost_hourly_usd: Number.isFinite(priceHourly) ? priceHourly : 0,
      total_hourly: Number.isFinite(priceHourly) ? priceHourly : 0,
    },
    location: {
      uuid: location.country,
      city: location.city,
      stateprovince: location.stateprovince,
      country: location.country,
      network_speed_gbps: Number(offer.inet_down || 0) / 1000,
      network_speed_upload_gbps: Number(offer.inet_up || 0) / 1000,
      tier: reliability >= 0.99 ? 1 : reliability >= 0.95 ? 2 : 3,
    },
    vast: offer,
  };
}

function mapOffersToLocations(offers: VastOffer[]) {
  const byCountry = new Map<string, { id: string; country: string; gpus: ReturnType<typeof mapOfferGpu>[] }>();

  for (const offer of offers) {
    const location = parseGeolocation(offer.geolocation || offer.location || offer.country);
    const id = location.country || 'Unknown';
    const current = byCountry.get(id) || { id, country: id, gpus: [] };
    current.gpus.push(mapOfferGpu(offer));
    byCountry.set(id, current);
  }

  return Array.from(byCountry.values()).map((location) => ({
    ...location,
    tier: 1,
  }));
}

function mapSshKeys(keys: VastSshKey[]) {
  return keys.map((key, index) => {
    const id = normalizeString(key.id || key.uuid || key.name || index);
    return {
      id,
      name: normalizeString(key.name, `SSH Key ${id}`),
      type: 'SSHKEY',
    };
  });
}

function getInstancePortFromMap(instance: VastInstance, portName: string) {
  const ports = asRecord(instance.ports);
  const direct = ports[portName];
  const entries = Array.isArray(direct) ? direct : [];
  const firstEntry = asRecord(entries[0]);
  return normalizePositiveInt(firstEntry.HostPort || firstEntry.host_port || firstEntry.port, 0);
}

function getInstanceRdpPort(instance: VastInstance) {
  return normalizePositiveInt(
    instance.rdp_port ||
      instance.rdpPort ||
      getInstancePortFromMap(instance, '3389/tcp') ||
      getInstancePortFromMap(instance, '3389'),
    0
  );
}

function getRemoteProfileForImage(image: string) {
  const normalizedImage = image.toLowerCase();
  if (normalizedImage.includes('selkies-project/nvidia-egl-desktop') || normalizedImage.includes('selkies-project/nvidia-glx-desktop')) {
    return {
      name: 'selkies',
      webPorts: [8080],
      extraPorts: [],
    };
  }
  if (normalizedImage.includes('linuxserver/webtop') || normalizedImage.includes('linuxserver/blender')) {
    return {
      name: 'linuxserver-web',
      webPorts: [3001, 3000],
      extraPorts: [],
    };
  }
  if (normalizedImage.includes('accetto/') || normalizedImage.includes('novnc') || normalizedImage.includes('vnc')) {
    return {
      name: 'novnc',
      webPorts: [6901, 6080],
      extraPorts: [5901, 5900],
    };
  }
  return {
    name: 'generic',
    webPorts: [8080, 3001, 3000, 6901, 6080],
    extraPorts: [5901, 5900],
  };
}

function parseRemotePortsFromEnv(instance: VastInstance) {
  const env = asRecord(instance.env || instance.environment || instance.env_vars || instance.envVars);
  const value = String(env._TTMMO_REMOTE_PORTS || env.TTMMO_REMOTE_PORTS || '').trim();
  return value
    .split(',')
    .map((item) => normalizePositiveInt(item, 0))
    .filter(Boolean);
}

function sortRemotePortsForProfile(profileName: string, ports: number[]) {
  const uniquePorts = Array.from(new Set(ports.map((port) => normalizePositiveInt(port, 0)).filter(Boolean)));
  if (profileName === 'linuxserver-web') {
    const preferred = [3001, 3000];
    return [
      ...preferred.filter((port) => uniquePorts.includes(port)),
      ...uniquePorts.filter((port) => !preferred.includes(port)),
    ];
  }

  return uniquePorts;
}

function getMappedPublicPort(instance: VastInstance, internalPort: number) {
  return normalizePositiveInt(
    getInstancePortFromMap(instance, `${internalPort}/tcp`) ||
      getInstancePortFromMap(instance, String(internalPort)),
    0
  );
}

function formatRemoteEndpointLabel(profileName: string, internalPort: number, publicPort: number, source: WebDesktopEndpointSource) {
  let base = internalPort ? `Port ${internalPort}` : 'Remote';
  if (profileName === 'selkies' && internalPort === 8080) {
    base = 'WebRTC 8080';
  } else if (profileName === 'linuxserver-web' && internalPort === 3001) {
    base = 'GUI 3001';
  } else if (profileName === 'linuxserver-web' && internalPort === 3000) {
    base = 'App 3000';
  } else if (profileName === 'novnc' && internalPort === 6901) {
    base = 'noVNC 6901';
  } else if (profileName === 'novnc' && internalPort === 6080) {
    base = 'Web 6080';
  }

  if (source === 'mapped' && internalPort && publicPort && internalPort !== publicPort) {
    return `${base} -> ${publicPort}`;
  }

  return base;
}

function getWebDesktopProtocol(profileName: string, internalPort: number): 'http' | 'https' {
  if (profileName === 'linuxserver-web' && internalPort === 3001) {
    return 'https';
  }

  return 'http';
}

function buildWebDesktopEndpoint(
  profileName: string,
  host: string,
  internalPort: number,
  publicPort: number,
  source: WebDesktopEndpointSource
): WebDesktopEndpoint | null {
  if (!host || !publicPort) {
    return null;
  }

  const protocol = getWebDesktopProtocol(profileName, internalPort);

  return {
    internalPort,
    publicPort,
    host,
    protocol,
    url: `${protocol}://${host}:${publicPort}`,
    label: formatRemoteEndpointLabel(profileName, internalPort, publicPort, source),
    source,
  };
}

function getInstanceWebDesktopEndpoints(instance: VastInstance, webDesktopHost: string) {
  const image = normalizeString(instance.image || instance.image_uuid || instance.template_name || instance.docker_image).toLowerCase();
  const configuredPorts = parseRemotePortsFromEnv(instance);
  const profile = getRemoteProfileForImage(image);
  const publicIp = normalizeString(instance.public_ipaddr);
  const orderedRemotePorts = sortRemotePortsForProfile(
    profile.name,
    configuredPorts.length ? configuredPorts : profile.webPorts
  );
  const preferDirectPublicPorts = Boolean(
    publicIp &&
      (
        configuredPorts.length ||
        profile.name !== 'generic' ||
        normalizeBoolean(instance.static_ip, false)
      )
  );
  const endpoints: WebDesktopEndpoint[] = [];

  for (const internalPort of orderedRemotePorts) {
    const mappedPublicPort = getMappedPublicPort(instance, internalPort);
    const mappedEndpoint = buildWebDesktopEndpoint(profile.name, webDesktopHost, internalPort, mappedPublicPort, 'mapped');
    if (mappedEndpoint) {
      endpoints.push(mappedEndpoint);
    }
  }

  const legacyPublicPorts = [
    instance.web_port,
    instance.webPort,
    instance.desktop_port,
    instance.desktopPort,
    instance.vnc_port,
    instance.vncPort,
    getInstancePortFromMap(instance, '8080/tcp'),
    getInstancePortFromMap(instance, '8080'),
    getInstancePortFromMap(instance, '3001/tcp'),
    getInstancePortFromMap(instance, '3001'),
    getInstancePortFromMap(instance, '3000/tcp'),
    getInstancePortFromMap(instance, '3000'),
    getInstancePortFromMap(instance, '6901/tcp'),
    getInstancePortFromMap(instance, '6901'),
    getInstancePortFromMap(instance, '6080/tcp'),
    getInstancePortFromMap(instance, '6080'),
  ];

  for (const publicPort of legacyPublicPorts) {
    const normalizedPublicPort = normalizePositiveInt(publicPort, 0);
    const legacyEndpoint = buildWebDesktopEndpoint(profile.name, webDesktopHost, 0, normalizedPublicPort, 'legacy');
    if (legacyEndpoint) {
      endpoints.push(legacyEndpoint);
    }
  }

  if (!endpoints.length) {
    for (const internalPort of orderedRemotePorts) {
      if (preferDirectPublicPorts) {
        const directEndpoint = buildWebDesktopEndpoint(profile.name, publicIp, internalPort, internalPort, 'direct');
        if (directEndpoint) {
          endpoints.push(directEndpoint);
        }
      }
    }
  }

  const seenUrls = new Set<string>();
  return endpoints
    .filter((endpoint) => {
      if (seenUrls.has(endpoint.url)) {
        return false;
      }
      seenUrls.add(endpoint.url);
      return true;
    })
    .map((endpoint, index) => ({
      ...endpoint,
      primary: index === 0,
    }));
}

function getInstanceWebDesktopPort(instance: VastInstance, webDesktopHost: string) {
  return getInstanceWebDesktopEndpoints(instance, webDesktopHost)[0]?.publicPort || 0;
}

function normalizeCredential(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return '';
  }
  const text = String(value).trim();
  return text && text !== '[object Object]' ? text : '';
}

function getInstanceEnv(instance: VastInstance) {
  return asRecord(instance.env || instance.environment || instance.env_vars || instance.envVars);
}

function getInstancePassword(instance: VastInstance) {
  const env = getInstanceEnv(instance);
  return (
    normalizeCredential(instance.password) ||
    normalizeCredential(instance.root_password) ||
    normalizeCredential(instance.rootPassword) ||
    normalizeCredential(instance.ssh_password) ||
    normalizeCredential(instance.rdp_password) ||
    normalizeCredential(instance.image_password) ||
    normalizeCredential(instance.passwd) ||
    normalizeCredential(instance.login_password) ||
    normalizeCredential(env.VNC_PW) ||
    normalizeCredential(env.PASSWORD) ||
    normalizeCredential(env.PASSWD) ||
    normalizeCredential(env.SELKIES_BASIC_AUTH_PASSWORD)
  );
}

function getInstanceUsername(instance: VastInstance, rdpPort: number) {
  const env = getInstanceEnv(instance);
  return normalizeString(
    instance.username ||
      instance.user ||
      instance.ssh_user ||
      instance.rdp_username ||
      instance.login_user ||
      env.SELKIES_BASIC_AUTH_USER ||
      env.CUSTOM_USER ||
      env.USER ||
      env.USERNAME,
    rdpPort ? 'Administrator' : 'root'
  );
}

function getInstanceId(instance: VastInstance) {
  return normalizeString(instance.id || instance.instance_id || instance.contract_id);
}

function getInstanceSshPort(instance: VastInstance) {
  return normalizePositiveInt(
    instance.ssh_port ||
      instance.machine_dir_ssh_port ||
      getInstancePortFromMap(instance, '22/tcp') ||
      getInstancePortFromMap(instance, '22'),
    0
  );
}

function isSshRuntime(runtime: string) {
  return runtime.startsWith('ssh');
}

function getInstancePortRange(instance: VastInstance) {
  const start = normalizePositiveInt(instance.direct_port_start, 0);
  const end = normalizePositiveInt(instance.direct_port_end, 0);
  if (start && end) {
    return start === end ? String(start) : `${start}-${end}`;
  }

  const ports = asRecord(instance.ports);
  const hostPorts = Object.values(ports)
    .flatMap((value) => (Array.isArray(value) ? value : []))
    .map((value) => normalizePositiveInt(asRecord(value).HostPort || asRecord(value).host_port, 0))
    .filter(Boolean);

  if (!hostPorts.length) {
    return '';
  }

  const min = Math.min(...hostPorts);
  const max = Math.max(...hostPorts);
  return min === max ? String(min) : `${min}-${max}`;
}

function formatInstanceStatusLabel(status: string, ready: boolean) {
  const normalized = status.toLowerCase();
  if (normalized.includes('failed') || normalized.includes('error')) return 'Nguồn GPU không tạo được VPS';
  if (ready && normalized.includes('running')) return 'Sẵn sàng kết nối';
  if (normalized.includes('loading')) return 'Đang tải Docker';
  if (normalized.includes('creating') || normalized.includes('loading') || normalized.includes('starting') || normalized.includes('created') || normalized.includes('transferring')) {
    return 'Đang khởi tạo';
  }
  if (normalized.includes('not running')) return 'Đang khởi tạo';
  if (normalized.includes('running')) return 'Đang mở kết nối';
  if (normalized.includes('stop')) return 'Đã dừng';
  if (normalized.includes('exit')) return 'Đã thoát';
  return status || 'Đang cập nhật';
}

function mapInstances(instances: VastInstance[]) {
  return instances.map((instance) => {
    const id = getInstanceId(instance);
    const actualStatus = normalizeStatusValue(instance.actual_status);
    const hasActualStatusField = hasOwnField(instance, 'actual_status');
    const curState = normalizeStatusValue(instance.cur_state);
    const nextState = normalizeStatusValue(instance.next_state);
    const intendedStatus = normalizeStatusValue(instance.intended_status);
    const rawStatus = normalizeStatusValue(instance.status);
    const actualStatusIsProvisioning = hasActualStatusField && !actualStatus;
    const status = actualStatusIsProvisioning
      ? 'creating'
      : actualStatus || rawStatus || curState || 'unknown';
    const publicIp = normalizeString(instance.public_ipaddr);
    const sshHost = normalizeString(instance.ssh_host || publicIp || instance.hostname);
    const sshPort = getInstanceSshPort(instance);
    const rdpPort = getInstanceRdpPort(instance);
    const rdpHost = publicIp || sshHost;
    const webDesktopHost = publicIp || sshHost;
    const webDesktopUrls = getInstanceWebDesktopEndpoints(instance, webDesktopHost);
    const primaryWebDesktopUrl = webDesktopUrls[0];
    const webDesktopPort = primaryWebDesktopUrl?.publicPort || 0;
    const password = getInstancePassword(instance);
    const username = getInstanceUsername(instance, rdpPort);
    const portRange = getInstancePortRange(instance);
    const localIps = normalizeStringList(instance.local_ipaddrs);
    const statusMessage = normalizeString(instance.status_msg || instance.status_message);
    const hasRuntimeError = isProviderRuntimeError(statusMessage);
    const runtimeState = [
      status,
      actualStatus,
      curState,
      nextState,
      intendedStatus,
      statusMessage,
    ].map((item) => normalizeString(item).toLowerCase()).join(' ');
    const isRunning = actualStatus === 'running' && !hasRuntimeError;
    const isProvisioning = /creating|loading|starting|created|transferring|not running|installing|pending|queued|initializing|dockerfile/i.test(runtimeState);
    const isStopped = /stopped|exited|deleted|destroyed|paused|frozen|offline|unknown|unloaded/i.test(runtimeState);
    const hasConnectionTarget = Boolean((sshHost && sshPort) || primaryWebDesktopUrl);
    const ready = Boolean(
      isRunning &&
      curState !== 'unloaded' &&
      intendedStatus !== 'stopped' &&
      intendedStatus !== 'frozen' &&
      !isProvisioning &&
      !isStopped &&
      hasConnectionTarget
    );
    const gpuRamMb = normalizeNumber(instance.gpu_ram || instance.gpu_totalram, 0);
    const cpuRamMb = normalizeNumber(instance.cpu_ram || instance.mem_limit, 0);
    const hourlyUsd = normalizeNumber(instance.dph_total || instance.dph_base || instance.dph, 0);
    const displayStatus = actualStatusIsProvisioning
      ? 'creating'
      : hasRuntimeError
        ? 'failed'
        : isProvisioning && !ready
        ? status === 'running' ? 'loading' : status
        : status;
    const displayStatusMessage = sanitizeInstanceStatusMessage(statusMessage) || (actualStatusIsProvisioning
      ? 'Instance đang được cấp phát. Chờ nguồn GPU chuyển actual_status sang running rồi mới có thể kết nối.'
      : '');

    return {
      id,
      name: normalizeString(instance.label || instance.name, id ? `Instance GPU ${id}` : 'Instance GPU'),
      status: displayStatus,
      statusLabel: formatInstanceStatusLabel(displayStatus, ready),
      statusMessage: displayStatusMessage,
      sourceStatus: {
        actualStatus: actualStatus || null,
        curState: curState || null,
        nextState: nextState || null,
        intendedStatus: intendedStatus || null,
        statusMessage: displayStatusMessage || null,
      },
      type: 'GPU Instance',
      ipAddress: publicIp || sshHost,
      rateHourly: hourlyUsd,
      attributes: {
        name: normalizeString(instance.label || instance.name, id),
        status: displayStatus,
        region: normalizeString(instance.geolocation || instance.country_code || publicIp || sshHost, 'N/A'),
      },
      connection: {
        ready,
        host: sshHost,
        port: sshPort,
        command: sshHost && sshPort ? `ssh -p ${sshPort} root@${sshHost}` : '',
        username,
        password,
        rdpPort,
        rdpAddress: rdpHost && rdpPort ? `${rdpHost}:${rdpPort}` : '',
        rdpCommand: rdpHost && rdpPort ? `mstsc /v:${rdpHost}:${rdpPort}` : '',
        webDesktopPort,
        webDesktopInternalPort: primaryWebDesktopUrl?.internalPort || 0,
        webDesktopUrl: primaryWebDesktopUrl?.url || '',
        webDesktopUrls,
        publicIp,
        localIps,
        portRange,
        ipAddressType: normalizeBoolean(instance.static_ip) ? 'Static' : 'Shared',
      },
      specs: {
        gpuName: normalizeString(instance.gpu_name || instance.gpu_name_full || instance.gpu_display_name, 'GPU'),
        gpuCount: normalizePositiveInt(instance.num_gpus, 1),
        gpuRamGb: gpuRamMb > 0 ? Math.round(gpuRamMb / 1024) : 0,
        gpuUtil: normalizeNumber(instance.gpu_util, 0),
        gpuTemp: normalizeNumber(instance.gpu_temp, 0),
        cpuName: normalizeString(instance.cpu_name),
        cpuCores: normalizeNumber(instance.cpu_cores || instance.cpu_cores_effective, 0),
        ramGb: cpuRamMb > 0 ? Math.round(cpuRamMb / 1024) : 0,
        diskName: normalizeString(instance.disk_name),
        diskGb: normalizeNumber(instance.disk_space, 0),
        diskUsageGb: normalizeNumber(instance.disk_usage, 0),
        machineId: normalizeString(instance.machine_id),
        hostId: normalizeString(instance.host_id),
        dlperf: normalizeNumber(instance.dlperf, 0),
        networkUpMbps: normalizeNumber(instance.inet_up || instance.network_up_mbps, 0),
        networkDownMbps: normalizeNumber(instance.inet_down || instance.network_down_mbps, 0),
        image: normalizeString(instance.image || instance.image_uuid || instance.template_name || instance.docker_image),
      },
    };
  });
}

function makeBillingFallbackInstance(row: VpsGpuBillingRow): VastInstance {
  return {
    id: row.provider_instance_id,
    instance_id: row.provider_instance_id,
    label: row.instance_name || `VPS GPU ${row.provider_instance_id}`,
    status: row.status === 'deletion_pending' ? 'deletion_pending' : (row.provider_status || 'creating'),
    actual_status: row.provider_status || row.status,
    status_msg: row.status === 'deletion_pending'
      ? 'Tài khoản chưa đủ cho giờ tiếp theo, hệ thống đang xóa VPS GPU.'
      : 'Hệ thống đang đồng bộ trạng thái VPS GPU.',
    dph_total: row.cost_hourly_usd,
  };
}

function attachBillingToInstance(mappedInstance: ReturnType<typeof mapInstances>[number], row: VpsGpuBillingRow) {
  const billing = toPublicBilling(row);
  const nextStatus = row.status === 'deletion_pending' ? 'deletion_pending' : mappedInstance.status;

  return {
    ...mappedInstance,
    id: row.provider_instance_id || mappedInstance.id,
    name: row.instance_name || mappedInstance.name,
    status: nextStatus,
    statusLabel: row.status === 'deletion_pending' ? 'Đang xóa vì tài khoản chưa đủ' : mappedInstance.statusLabel,
    billing,
  };
}

function shouldEndMissingProviderInstance(row: VpsGpuBillingRow) {
  const startedAtMs = row.started_at_ms || row.started_at?.getTime() || 0;
  return startedAtMs > 0 && Date.now() - startedAtMs > PROVIDER_MISSING_GRACE_MS;
}

async function mapOwnedVpsGpuInstances(
  userId: number,
  providerInstances: VastInstance[],
  options: { providerListReliable?: boolean } = {}
) {
  const billings = await listOwnedVpsGpuBillings(userId);
  const providerById = new Map(providerInstances.map((instance) => [getInstanceId(instance), instance]));

  await Promise.all(
    billings.map((row) => {
      const providerInstance = providerById.get(row.provider_instance_id);
      if (!providerInstance) return Promise.resolve();
      const providerStatus = normalizeString(providerInstance.actual_status || providerInstance.status || providerInstance.cur_state);
      return providerStatus
        ? markVpsGpuProviderStatus(row.provider_instance_id, providerStatus).catch(() => undefined)
        : Promise.resolve();
    })
  );

  const visibleBillings: VpsGpuBillingRow[] = [];

  for (const row of billings) {
    if (!providerById.has(row.provider_instance_id) && options.providerListReliable && shouldEndMissingProviderInstance(row)) {
      await markVpsGpuEnded(row.provider_instance_id, 'provider_missing').catch(() => undefined);
      continue;
    }

    visibleBillings.push(row);
  }

  return visibleBillings.map((row) => {
    const providerInstance = providerById.get(row.provider_instance_id) || makeBillingFallbackInstance(row);
    return attachBillingToInstance(mapInstances([providerInstance])[0], row);
  });
}

async function handleVastError(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : 'Không thể kết nối nguồn GPU';
  const message = sanitizeProviderMessage(rawMessage, 'Không thể kết nối nguồn GPU');
  const status = error instanceof VastApiError
    ? error.status
    : message.includes('VAST_API_KEY') ? 500 : 502;
  return json({ success: false, message, upstream_status: status }, { status: 200 });
}

async function safeVastRequest<T>(path: string, init?: RequestInit, options?: { version?: 'v0' | 'v1' }) {
  try {
    return {
      ok: true,
      data: await vastRequest<T>(path, init, options),
    };
  } catch (error) {
    const message = sanitizeProviderMessage(error instanceof Error ? error.message : `Không thể tải ${path}`);
    return {
      ok: false,
      data: null,
      message,
    };
  }
}

async function getOfferOverview(req: NextRequest) {
  const gpuName = req.nextUrl.searchParams.get('gpu') || req.nextUrl.searchParams.get('gpuName') || undefined;
  const payload = buildVastOfferSearch({
    gpuName,
    minGpus: req.nextUrl.searchParams.get('minGpus') || req.nextUrl.searchParams.get('gpuCount'),
    minGpuRamMb: req.nextUrl.searchParams.get('minGpuRamMb'),
    minDiskGb: req.nextUrl.searchParams.get('minDiskGb'),
    maxHourlyUsd: req.nextUrl.searchParams.get('maxHourlyUsd'),
    minInetDownMbps: req.nextUrl.searchParams.get('minInetDownMbps') || DEFAULT_VAST_MIN_INET_DOWN_MBPS,
    minInetUpMbps: req.nextUrl.searchParams.get('minInetUpMbps') || DEFAULT_VAST_MIN_INET_UP_MBPS,
    limit: req.nextUrl.searchParams.get('limit') || 60,
  });
  return vastRequest('/bundles/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function findLiveOfferById(offerId: string) {
  const offerNumber = Number(offerId);
  if (!Number.isFinite(offerNumber) || offerNumber <= 0) {
    return null;
  }

  const payload = await vastRequest('/bundles/', {
    method: 'POST',
    body: JSON.stringify({
      rentable: { eq: true },
      verified: { eq: true },
      ask_contract_id: { eq: offerNumber },
      limit: 1,
    }),
  });

  return extractOffers(payload).find((offer) => getOfferId(offer) === offerId) || null;
}

function normalizeRuntime(value: unknown) {
  const runtime = normalizeString(value, 'ssh').toLowerCase();
  if (runtime === 'jupyter') return 'jupyter_direct';
  if (runtime === 'entrypoint') return 'args';
  if (runtime === 'args') return 'args';
  if (['ssh_direct', 'ssh_proxy', 'jupyter_direct', 'jupyter_proxy'].includes(runtime)) return runtime;
  return 'ssh_direct';
}

function normalizeVastEnv(value: unknown) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key, item]) => key.trim() && item !== undefined && item !== null && String(item).trim())
        .map(([key, item]) => [key.trim(), String(item).trim()])
    );
  }

  const text = normalizeString(value);
  if (!text) {
    return {};
  }

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return normalizeVastEnv(parsed);
    }
  } catch {
    // Allow shell-style flags from older UI state, but only keep environment variables.
  }

  const env: Record<string, string> = {};
  const matches = text.matchAll(/(?:^|\s)-e\s+([A-Za-z_][A-Za-z0-9_]*)=("[^"]*"|'[^']*'|[^\s]+)/g);
  for (const match of matches) {
    const key = match[1];
    const rawValue = match[2] || '';
    env[key] = rawValue.replace(/^["']|["']$/g, '');
  }

  return env;
}

function quoteDockerFlagValue(value: string) {
  if (!/[^\w@%+=:,./-]/.test(value)) {
    return value;
  }

  return `'${value.replace(/'/g, "'\\''")}'`;
}

function buildTemplateEnvFlags(env: Record<string, string>) {
  return Object.entries(env)
    .map(([key, value]) => {
      const normalizedKey = key.replace(/\s+/g, ' ').trim();
      const normalizedValue = String(value || '').trim();
      if (!normalizedKey) {
        return '';
      }

      if (/^-p\s+\d+:\d+(?:\/tcp)?$/i.test(normalizedKey)) {
        return normalizedKey.replace(/\/tcp$/i, '');
      }

      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(normalizedKey) || !normalizedValue) {
        return '';
      }

      return `-e ${normalizedKey}=${quoteDockerFlagValue(normalizedValue)}`;
    })
    .filter(Boolean)
    .join(' ');
}

function ensureVastAppPortMappings(image: string, env: Record<string, string>) {
  const nextEnv = { ...env };
  const profile = getRemoteProfileForImage(image);
  const hasPortMapping = (internalPort: number) =>
    Object.keys(nextEnv).some((key) => {
      const normalizedKey = key.replace(/\s+/g, ' ').trim().toLowerCase();
      return normalizedKey === `-p ${internalPort}:${internalPort}` ||
        normalizedKey === `-p ${internalPort}:${internalPort}/tcp`;
    });

  const remotePorts = [...profile.webPorts, ...profile.extraPorts];
  nextEnv._TTMMO_REMOTE_PROFILE = profile.name;
  nextEnv._TTMMO_REMOTE_PORTS = profile.webPorts.join(',');

  if (profile.name === 'linuxserver-web') {
    nextEnv.OPEN_BUTTON_PORT = nextEnv.OPEN_BUTTON_PORT || '3001';
  } else if (profile.name === 'selkies') {
    nextEnv.OPEN_BUTTON_PORT = nextEnv.OPEN_BUTTON_PORT || '8080';
  } else if (profile.name === 'novnc') {
    nextEnv.OPEN_BUTTON_PORT = nextEnv.OPEN_BUTTON_PORT || '6901';
  }

  for (const port of remotePorts) {
    if (!hasPortMapping(port)) {
      nextEnv[`-p ${port}:${port}`] = '1';
    }
  }

  return nextEnv;
}

function buildVastTemplatePayload(params: {
  image: string;
  runtime: string;
  env: Record<string, string>;
  onstart: string;
  argsStr: string;
  storageGb: number;
}) {
  const profile = getRemoteProfileForImage(params.image);
  const templateRuntime = params.runtime.startsWith('jupyter')
    ? 'jupyter'
    : isSshRuntime(params.runtime)
      ? 'ssh'
      : 'args';
  const payload: Record<string, unknown> = {
    name: `TTMMO ${profile.name} ${params.image}`.slice(0, 120),
    image: params.image,
    env: buildTemplateEnvFlags(params.env),
    runtype: templateRuntime,
    ssh_direct: true,
    use_ssh: true,
    use_jupyter_lab: templateRuntime === 'jupyter',
    recommended_disk_space: params.storageGb,
  };

  if (templateRuntime !== 'args' && params.onstart) {
    payload.onstart = params.onstart;
  }

  if (templateRuntime === 'args' && params.argsStr) {
    payload.args = params.argsStr;
  }

  return payload;
}

function extractTemplateHashId(payload: unknown) {
  const record = asRecord(payload);
  const template = asRecord(record.template);
  return normalizeString(
    template.hash_id ||
      template.hashId ||
      template.template_hash_id ||
      record.hash_id ||
      record.hashId ||
      record.template_hash_id
  );
}

async function createVastTemplateHash(templatePayload: Record<string, unknown>) {
  const response = await vastRequest('/template/', {
    method: 'POST',
    body: JSON.stringify(templatePayload),
  });
  return extractTemplateHashId(response);
}

function buildTemplatePayloadFromRaw(rawPayload: unknown) {
  const payload = asRecord(rawPayload);
  const attributes = asRecord(asRecord(payload.data).attributes || payload.attributes || payload);
  const resources = asRecord(attributes.resources);
  const rawImage = normalizeString(attributes.image);
  const dockerImage = rawImage.includes('/') || rawImage.includes(':') ? rawImage : getVastDefaultImage();
  const requestedStorageGb = normalizePositiveInt(asRecord(resources).storage_gb || attributes.disk, 100);
  let onstart = normalizeString(attributes.onstart, 'nvidia-smi');
  let runtime = normalizeRuntime(attributes.runtype);
  let argsStr = normalizeString(attributes.args_str || attributes.args);
  const remoteProfile = getRemoteProfileForImage(dockerImage);

  if (['linuxserver-web', 'selkies', 'novnc'].includes(remoteProfile.name) && isSshRuntime(runtime)) {
    runtime = 'args';
    argsStr = '';
  }

  const env = ensureVastAppPortMappings(dockerImage, normalizeVastEnv(attributes.env));
  return buildVastTemplatePayload({
    image: dockerImage,
    runtime,
    env,
    onstart,
    argsStr,
    storageGb: requestedStorageGb,
  });
}

function normalizePublicSshKey(value: unknown) {
  return normalizeString(value).replace(/\s+/g, ' ').trim();
}

function assertPublicSshKey(value: unknown) {
  const key = normalizePublicSshKey(value);
  if (!key) {
    throw new Error('Thiếu SSH public key. Hãy dán nội dung file .pub của bạn trước khi tạo VPS.');
  }

  if (/BEGIN .*PRIVATE KEY/i.test(key) || key.includes('OPENSSH PRIVATE KEY')) {
    throw new Error('Bạn đang dán private key. Hệ thống chỉ nhận public key trong file .pub để kết nối SSH.');
  }

  const parts = key.split(/\s+/);
  const keyType = parts[0] || '';
  const keyBody = parts[1] || '';
  const supportedTypes = new Set([
    'ssh-ed25519',
    'ssh-rsa',
    'ecdsa-sha2-nistp256',
    'ecdsa-sha2-nistp384',
    'ecdsa-sha2-nistp521',
    'sk-ssh-ed25519@openssh.com',
    'sk-ecdsa-sha2-nistp256@openssh.com',
  ]);

  if (!supportedTypes.has(keyType) || !/^[A-Za-z0-9+/]+={0,3}$/.test(keyBody)) {
    throw new Error('SSH public key chưa đúng định dạng. Key thường bắt đầu bằng ssh-ed25519 hoặc ssh-rsa.');
  }

  return key;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function attachSshKeyToInstance(instanceId: string, publicKey: string) {
  const normalizedKey = assertPublicSshKey(publicKey);
  let lastError: unknown;

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      return await vastRequest(`/instances/${encodeURIComponent(instanceId)}/ssh/`, {
        method: 'POST',
        body: JSON.stringify({ ssh_key: normalizedKey }),
      });
    } catch (error) {
      lastError = error;
      const status = error instanceof VastApiError ? error.status : 500;
      if (![404, 409, 429, 500, 502, 503, 504].includes(status) || attempt === 5) {
        break;
      }
      await sleep(1200 * attempt);
    }
  }

  const message = lastError instanceof Error ? sanitizeProviderMessage(lastError.message) : 'Nguồn GPU chưa nhận SSH key';
  throw new Error(`Không gắn được SSH key vào VPS vừa tạo. Hệ thống đã hủy VPS để tránh tính phí. Chi tiết: ${message}`);
}

function buildCreateInstancePayload(rawPayload: unknown, liveOffer?: VastOffer | null) {
  const payload = asRecord(rawPayload);
  const attributes = asRecord(asRecord(payload.data).attributes || payload.attributes || payload);
  const resources = asRecord(attributes.resources);
  const gpuMap = asRecord(resources.gpus);
  const gpuEntry = Object.entries(gpuMap)[0];

  const offerId = normalizeString(
    attributes.offer_id || attributes.ask_id || attributes.hostnode_id || payload.offer_id || payload.ask_id
  );
  if (!offerId) {
    throw new Error('Thiếu gói GPU. Hãy chọn một gói GPU trước khi tạo instance.');
  }

  const name = normalizeString(attributes.name || attributes.label, 'trungtammmo-gpu-ai');
  const rawImage = normalizeString(attributes.image);
  const dockerImage = rawImage.includes('/') || rawImage.includes(':') ? rawImage : getVastDefaultImage();
  const remoteProfile = getRemoteProfileForImage(dockerImage);
  const requestedStorageGb = normalizePositiveInt(asRecord(resources).storage_gb || attributes.disk, 100);
  const liveOfferDiskGb = liveOffer ? normalizePositiveInt(liveOffer.disk_space, requestedStorageGb) : requestedStorageGb;
  const storageGb = Math.max(20, Math.min(requestedStorageGb, liveOfferDiskGb || requestedStorageGb));
  let onstart = normalizeString(attributes.onstart, 'nvidia-smi');
  let runtime = normalizeRuntime(attributes.runtype);
  let argsStr = normalizeString(attributes.args_str || attributes.args);

  if (['linuxserver-web', 'selkies', 'novnc'].includes(remoteProfile.name) && isSshRuntime(runtime)) {
    runtime = 'args';
    argsStr = '';
  }

  const env = ensureVastAppPortMappings(dockerImage, normalizeVastEnv(attributes.env));
  const rawUserSshKey = attributes.ssh_public_key || attributes.public_ssh_key || attributes.ssh_key || payload.ssh_public_key || payload.ssh_key;
  const userSshKey = isSshRuntime(runtime)
    ? assertPublicSshKey(rawUserSshKey)
    : (rawUserSshKey ? assertPublicSshKey(rawUserSshKey) : '');

  const vastPayload: Record<string, unknown> = {
    image: dockerImage,
    disk: storageGb,
    label: name,
    runtype: runtime,
    target_state: normalizeString(attributes.target_state, 'running'),
    python_utf8: normalizeBoolean(attributes.python_utf8, true),
    lang_utf8: normalizeBoolean(attributes.lang_utf8, true),
    cancel_unavail: normalizeBoolean(attributes.cancel_unavail, true),
    env,
  };

  if (runtime !== 'args' && onstart) {
    vastPayload.onstart = onstart;
  }

  if (runtime.startsWith('jupyter')) {
    vastPayload.use_jupyter_lab = normalizeBoolean(attributes.use_jupyter_lab, true);
  }

  if (runtime === 'args' && argsStr) {
    vastPayload.args_str = argsStr;
  }

  const optionalFields = ['price', 'template_hash_id', 'args', 'args_str', 'vm', 'force', 'user', 'image_login', 'volume_info'] as const;
  for (const field of optionalFields) {
    if (attributes[field] !== undefined && attributes[field] !== '') {
      if (field === 'args' || field === 'args_str') {
        continue;
      }
      vastPayload[field] = attributes[field];
    }
  }

  return {
    offerId,
    payload: vastPayload,
    templatePayload: buildVastTemplatePayload({
      image: dockerImage,
      runtime,
      env,
      onstart,
      argsStr,
      storageGb,
    }),
    userSshKey,
    shouldAttachSshKey: isSshRuntime(runtime),
  };
}

export async function GET(req: NextRequest) {
  const userId = await requireUser();
  if (!userId) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  if (!isVastConfigured()) {
    return json({ success: false, message: 'Thiếu API key nguồn GPU', upstream_status: 500 }, { status: 200 });
  }

  const resource = normalizePath(req.nextUrl.searchParams.get('resource') || 'overview');

  try {
    if (resource === 'overview' || resource === 'instances' || resource.startsWith('instances/')) {
      await runVpsGpuBillingSweepIfDue();
    }

    if (resource === 'overview') {
      const [offers, instances, sshKeys, user] = await Promise.all([
        safeVastRequest('/bundles/', {
          method: 'POST',
          body: JSON.stringify(buildVastOfferSearch({
            minGpus: 1,
            minInetDownMbps: DEFAULT_VAST_MIN_INET_DOWN_MBPS,
            minInetUpMbps: DEFAULT_VAST_MIN_INET_UP_MBPS,
            limit: 60,
          })),
        }),
        safeVastRequest('/instances/', undefined, { version: 'v1' }),
        safeVastRequest('/ssh/'),
        safeVastRequest('/users/current/'),
      ]);

      const mappedOffers = extractOffers(offers.data);
      const mappedInstances = await mapOwnedVpsGpuInstances(userId, extractInstances(instances.data), {
        providerListReliable: instances.ok,
      });
      const mappedSshKeys = mapSshKeys(extractSshKeys(sshKeys.data));
      const pricingSettings = await getVpsGpuPricingSettings();
      const pricedHostnodes = applyVpsGpuPricing(mappedOffers.map(mapOfferToHostnode), pricingSettings);
      await saveVpsGpuOfferCostSnapshots(mappedOffers, pricedHostnodes, pricingSettings);

      return json({
        success: offers.ok || instances.ok || sshKeys.ok || user.ok,
        message: [offers, instances, sshKeys, user]
          .filter((item) => !item.ok)
          .map((item) => item.message)
          .join(' | ') || undefined,
        data: {
          provider: 'gpu-cloud',
          account: user.data,
          pricingSettings,
          locations: { data: { locations: mapOffersToLocations(mappedOffers) } },
          hostnodes: { data: { hostnodes: pricedHostnodes } },
          instances: { data: { instances: mappedInstances } },
          secrets: { data: { secrets: mappedSshKeys } },
          defaultSshKeySecretId: mappedSshKeys[0]?.id || '',
          defaultImage: getVastDefaultImage(),
          errors: {
            offers: offers.ok ? null : offers.message,
            instances: instances.ok ? null : instances.message,
            sshKeys: sshKeys.ok ? null : sshKeys.message,
            user: user.ok ? null : user.message,
          },
        },
      });
    }

    if (resource === 'locations') {
      const payload = await getOfferOverview(req);
      const offers = extractOffers(payload);
      return json({ success: true, data: { locations: mapOffersToLocations(offers) } });
    }

    if (resource === 'hostnodes' || resource === 'offers') {
      const payload = await getOfferOverview(req);
      const offers = extractOffers(payload);
      const pricingSettings = await getVpsGpuPricingSettings();
      const pricedHostnodes = applyVpsGpuPricing(offers.map(mapOfferToHostnode), pricingSettings);
      await saveVpsGpuOfferCostSnapshots(offers, pricedHostnodes, pricingSettings);
      return json({
        success: true,
        data: { hostnodes: pricedHostnodes, offers, pricingSettings },
      });
    }

    if (resource.startsWith('hostnodes/') || resource.startsWith('offers/')) {
      const offerId = normalizePath(resource.replace(/^hostnodes\/|^offers\//, ''));
      if (!offerId || offerId.includes('/')) {
        return json({ success: false, message: 'Offer ID không hợp lệ' }, { status: 400 });
      }
      const payload = await getOfferOverview(req);
      const offer = extractOffers(payload).find((item) => getOfferId(item) === offerId);
      if (!offer) {
        return json({ success: false, message: 'Không tìm thấy gói GPU' }, { status: 404 });
      }
      const pricingSettings = await getVpsGpuPricingSettings();
      const pricedHostnode = applyVpsGpuPricing([mapOfferToHostnode(offer)], pricingSettings);
      await saveVpsGpuOfferCostSnapshots([offer], pricedHostnode, pricingSettings);
      return json({
        success: true,
        data: { hostnode: pricedHostnode[0], offer, pricingSettings },
      });
    }

    if (resource === 'instances') {
      const payload = await vastRequest('/instances/', undefined, { version: 'v1' });
      return json({
        success: true,
        data: { instances: await mapOwnedVpsGpuInstances(userId, extractInstances(payload), { providerListReliable: true }) },
      });
    }

    if (resource.startsWith('instances/')) {
      const instanceId = normalizePath(resource.slice('instances/'.length));
      if (!instanceId || instanceId.includes('/')) {
        return json({ success: false, message: 'Instance ID không hợp lệ' }, { status: 400 });
      }
      const billing = await requireOwnedVpsGpuBilling(userId, instanceId);
      const payload = await vastRequest('/instances/', undefined, { version: 'v1' });
      const instance = extractInstances(payload).find((item) => getInstanceId(item) === instanceId) || makeBillingFallbackInstance(billing);
      return json({ success: true, data: { instance: attachBillingToInstance(mapInstances([instance])[0], billing) } });
    }

    if (resource === 'secrets' || resource === 'ssh-keys') {
      const payload = await vastRequest('/ssh/');
      return json({ success: true, data: { secrets: mapSshKeys(extractSshKeys(payload)), sshKeys: payload } });
    }

    if (resource === 'account' || resource === 'profile') {
      const payload = await vastRequest('/users/current/');
      return json({ success: true, data: payload });
    }

    return json({ success: false, message: 'Resource không hợp lệ' }, { status: 400 });
  } catch (error) {
    return handleVastError(error);
  }
}

export async function POST(req: NextRequest) {
  const userId = await requireUser();
  if (!userId) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  if (!isVastConfigured()) {
    return json({ success: false, message: 'Thiếu API key nguồn GPU', upstream_status: 500 }, { status: 200 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = normalizePath(String(body?.action || 'create-instance'));

    if (action === 'test-template') {
      const templatePayload = buildTemplatePayloadFromRaw(body?.payload);
      const templateHashId = await createVastTemplateHash(templatePayload);
      if (!templateHashId) {
        return json({
          success: false,
          message: 'Không tạo được template hash cho image này.',
          data: {
            templatePayload,
          },
        }, { status: 502 });
      }

      return json({
        success: true,
        data: {
          templateHashId,
          templatePayload,
        },
      });
    }

    if (action === 'create-instance') {
      const initialPayload = buildCreateInstancePayload(body?.payload);
      const liveOffer = await findLiveOfferById(initialPayload.offerId);
      if (!liveOffer) {
        return json({
          success: false,
          staleOffer: true,
          message: 'Gói GPU vừa hết, không còn cho thuê hoặc chưa được xác minh. Bấm Lọc gói rồi chọn gói đã xác minh khác.',
        });
      }

      const { offerId, payload, templatePayload, userSshKey, shouldAttachSshKey } = buildCreateInstancePayload(body?.payload, liveOffer);
      const existingTemplateHashId = normalizeString(asRecord(payload).template_hash_id);
      const templateHashId = existingTemplateHashId || await createVastTemplateHash(templatePayload);
      if (!templateHashId) {
        return json({
          success: false,
          message: 'Không tạo được template Vast cho image này. Hãy thử lại hoặc chọn preset khác để tránh lỗi Template not found.',
        }, { status: 502 });
      }
      payload.template_hash_id = templateHashId;

      const pricingSettings = await getVpsGpuPricingSettings();
      const pricedHostnode = applyVpsGpuPricing([mapOfferToHostnode(liveOffer)], pricingSettings)[0];
      const pricing = asRecord(pricedHostnode.pricing);
      const saleHourlyVnd = normalizePositiveNumber(pricing.sale_hourly_vnd, 0);
      const costHourlyVnd = normalizePositiveNumber(pricing.cost_hourly_vnd, 0);
      const costHourlyUsd = normalizePositiveNumber(pricing.cost_hourly_usd, getOfferCostSource(liveOffer).value);

      await assertMainWalletCanPay(userId, saleHourlyVnd, {
        internetReserveVnd: pricingSettings.internetReserveVnd,
      });

      let response: unknown;
      try {
        response = await vastRequest(`/asks/${encodeURIComponent(offerId)}/`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } catch (error) {
        const rawMessage = error instanceof Error ? error.message : '';
        if (isStaleOfferMessage(rawMessage)) {
          return json({
            success: false,
            staleOffer: true,
            message: 'Gói GPU vừa được người khác thuê hoặc không còn khả dụng. Danh sách đã cũ, bấm Lọc gói rồi chọn gói khác.',
          });
        }
        throw error;
      }

      const providerInstanceId = extractCreatedProviderInstanceId(response);
      if (!providerInstanceId) {
        throw new Error('Nguồn GPU đã nhận lệnh nhưng chưa trả instance ID. Hãy kiểm tra lại danh sách VPS GPU sau vài giây.');
      }

      if (shouldAttachSshKey && userSshKey) {
        try {
          await attachSshKeyToInstance(providerInstanceId, userSshKey);
        } catch (error) {
          await vastRequest(`/instances/${encodeURIComponent(providerInstanceId)}/`, { method: 'DELETE' }).catch(() => undefined);
          throw error;
        }
      }

      try {
        const billingResult = await chargeFirstHourAndSaveVpsGpu({
          userId,
          providerInstanceId,
          offerId,
          instanceName: normalizeString(asRecord(payload).label, 'trungtammmo-gpu-ai'),
          costHourlyUsd,
          costHourlyVnd,
          saleHourlyVnd,
        });

        return json({
          success: true,
          data: {
            instanceId: providerInstanceId,
            billing: billingResult.billing,
            balance: billingResult.balance,
          },
        });
      } catch (error) {
        await vastRequest(`/instances/${encodeURIComponent(providerInstanceId)}/`, { method: 'DELETE' }).catch(() => undefined);
        throw error;
      }
    }

    const instanceAction = getAllowedInstanceAction(action);
    if (instanceAction) {
      await runVpsGpuBillingSweepIfDue();
      await requireOwnedVpsGpuBilling(userId, instanceAction.id);
      const desiredState = instanceAction.action === 'start' ? 'running' : 'stopped';
      const payload = await vastRequest(`/instances/${encodeURIComponent(instanceAction.id)}/`, {
        method: 'PUT',
        body: JSON.stringify({ state: desiredState }),
      });
      return json({ success: true, data: payload });
    }

    if (action === 'search-offers') {
      const payload = await vastRequest('/bundles/', {
        method: 'POST',
        body: JSON.stringify(buildVastOfferSearch(asRecord(body?.payload))),
      });
      const offers = extractOffers(payload);
      const pricingSettings = await getVpsGpuPricingSettings();
      const pricedHostnodes = applyVpsGpuPricing(offers.map(mapOfferToHostnode), pricingSettings);
      await saveVpsGpuOfferCostSnapshots(offers, pricedHostnodes, pricingSettings);
      return json({
        success: true,
        data: { hostnodes: pricedHostnodes, offers, pricingSettings },
      });
    }

    return json({ success: false, message: 'Action không hợp lệ' }, { status: 400 });
  } catch (error) {
    return handleVastError(error);
  }
}

export async function PUT(req: NextRequest) {
  const userId = await requireUser();
  if (!userId) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  if (!isVastConfigured()) {
    return json({ success: false, message: 'Thiếu API key nguồn GPU', upstream_status: 500 }, { status: 200 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const instanceId = normalizeString(body?.instanceId || body?.id || req.nextUrl.searchParams.get('instanceId'));

    if (!instanceId) {
      return json({ success: false, message: 'Thiếu instanceId' }, { status: 400 });
    }

    await runVpsGpuBillingSweepIfDue();
    await requireOwnedVpsGpuBilling(userId, instanceId);

    const payload = await vastRequest(`/instances/${encodeURIComponent(instanceId)}/`, {
      method: 'PUT',
      body: JSON.stringify(body.payload || {}),
    });
    return json({ success: true, data: payload });
  } catch (error) {
    return handleVastError(error);
  }
}

export async function DELETE(req: NextRequest) {
  const userId = await requireUser();
  if (!userId) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  if (!isVastConfigured()) {
    return json({ success: false, message: 'Thiếu API key nguồn GPU', upstream_status: 500 }, { status: 200 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const instanceId = normalizeString(body?.instanceId || req.nextUrl.searchParams.get('instanceId'));

    if (!instanceId) {
      return json({ success: false, message: 'Thiếu instanceId' }, { status: 400 });
    }

    await runVpsGpuBillingSweepIfDue();
    const payload = await deleteOwnedVpsGpuInstance(userId, instanceId);
    return json({ success: true, data: payload });
  } catch (error) {
    return handleVastError(error);
  }
}
