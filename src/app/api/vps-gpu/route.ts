import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import {
  buildVastOfferSearch,
  getVastDefaultImage,
  isVastConfigured,
  VastApiError,
  vastRequest,
} from '@/lib/vast-ai';
import { getLegacySettingsMap } from '@/lib/legacy-settings';
import { db } from '@/lib/db';

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
type PricedHostnode = ReturnType<typeof mapOfferToHostnode> & {
  pricing?: Record<string, unknown>;
};

interface VpsGpuPricingSettings {
  usdToVnd: number;
  priceMultiplier: number;
  hourlyFeeVnd: number;
}

const VPS_GPU_OFFER_COSTS_TABLE = 'vps_gpu_offer_costs';

async function requireUser() {
  const cookieStore = await cookies();
  return Number(cookieStore.get('user_id')?.value || 0);
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

async function getVpsGpuPricingSettings(): Promise<VpsGpuPricingSettings> {
  const settings = await getLegacySettingsMap();

  return {
    usdToVnd: normalizePositiveNumber(settings.vps_gpu_usd_to_vnd, 26000),
    priceMultiplier: normalizePositiveNumber(settings.vps_gpu_price_multiplier, 1.25),
    hourlyFeeVnd: normalizePositiveNumber(settings.vps_gpu_hourly_fee_vnd, 0),
  };
}

function roundPriceVnd(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.ceil(value / 1000) * 1000;
}

function applyVpsGpuPricing<T extends { pricing?: Record<string, unknown> }>(
  hostnodes: T[],
  settings: VpsGpuPricingSettings
) {
  return hostnodes.map((hostnode) => {
    const pricing = asRecord(hostnode.pricing);
    const costHourlyUsd = normalizePositiveNumber(pricing.total_hourly, 0);
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
        price_multiplier: settings.priceMultiplier,
        hourly_fee_vnd: settings.hourlyFeeVnd,
        usd_to_vnd: settings.usdToVnd,
      },
    };
  });
}

function getOfferCostSource(offer: VastOffer) {
  const candidates = [
    ['dph_total', offer.dph_total],
    ['dph_base', offer.dph_base],
    ['dph', offer.dph],
    ['min_bid', offer.min_bid],
  ] as const;

  for (const [key, value] of candidates) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return { key, value: parsed };
    }
  }

  return { key: 'unknown', value: 0 };
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
      price_multiplier DECIMAL(8,4) NOT NULL DEFAULT 1,
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
      const offerId = normalizeString(offer.id || offer.ask_contract_id || offer.machine_id);
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
      console.warn('[vps-gpu] Failed to save Vast.ai offer cost snapshots', error);
    }
  }
}

function formatDockerEnvFlags(value: unknown) {
  if (typeof value === 'string') {
    return value.trim();
  }

  const record = asRecord(value);
  return Object.entries(record)
    .filter(([key, item]) => key.trim() && item !== undefined && item !== null && String(item).trim())
    .map(([key, item]) => `-e ${key.trim()}=${String(item).trim()}`)
    .join(' ');
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
  return toArray(data.offers || data.results || data.data || payload);
}

function extractInstances(payload: unknown): VastInstance[] {
  const data = asRecord(payload);
  return toArray(data.instances || data.results || data.data || payload);
}

function extractSshKeys(payload: unknown): VastSshKey[] {
  const data = asRecord(payload);
  return toArray(data.ssh_keys || data.keys || data.data || payload);
}

function mapOfferGpu(offer: VastOffer) {
  const gpuName = normalizeString(offer.gpu_name || offer.gpu_name_full || offer.gpu_display_name, 'GPU');
  const gpuRamMb = normalizePositiveInt(offer.gpu_ram, 0);
  const priceHourly = Number(offer.dph_total || offer.dph_base || offer.dph || 0);

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
  const id = normalizeString(offer.id || offer.ask_contract_id || offer.machine_id);
  const location = parseGeolocation(offer.geolocation || offer.location || offer.country);
  const gpu = mapOfferGpu(offer);
  const priceHourly = Number(offer.dph_total || offer.dph_base || offer.dph || 0);
  const reliability = Number(offer.reliability || 0);

  return {
    id,
    location_id: location.country,
    engine: normalizeString(offer.hostname || offer.machine_id || offer.host_id, `Vast offer ${id}`),
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
      name: normalizeString(key.name, `Vast SSH Key ${id}`),
      type: 'SSHKEY',
    };
  });
}

function mapInstances(instances: VastInstance[]) {
  return instances.map((instance) => {
    const id = normalizeString(instance.id || instance.instance_id || instance.contract_id);
    const status = normalizeString(instance.actual_status || instance.cur_state || instance.status, 'unknown');
    const ipAddress = normalizeString(
      instance.public_ipaddr || instance.ssh_host || instance.hostname || instance.direct_port_end,
      ''
    );

    return {
      id,
      name: normalizeString(instance.label || instance.name, id ? `Vast instance ${id}` : 'Vast instance'),
      status,
      type: 'GPU Instance',
      ipAddress,
      rateHourly: Number(instance.dph_total || instance.dph_base || instance.dph || 0),
      attributes: {
        name: normalizeString(instance.label || instance.name, id),
        status,
        region: normalizeString(instance.geolocation || instance.public_ipaddr || instance.ssh_host, 'N/A'),
      },
      vast: instance,
    };
  });
}

async function handleVastError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Không thể kết nối Vast.ai';
  const status = error instanceof VastApiError
    ? error.status
    : message.includes('VAST_API_KEY') ? 500 : 502;
  return json({ success: false, message }, { status });
}

async function safeVastRequest<T>(path: string, init?: RequestInit, options?: { version?: 'v0' | 'v1' }) {
  try {
    return {
      ok: true,
      data: await vastRequest<T>(path, init, options),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : `Không thể tải ${path}`;
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
    limit: req.nextUrl.searchParams.get('limit') || 60,
  });
  return vastRequest('/bundles/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

function buildCreateInstancePayload(rawPayload: unknown) {
  const payload = asRecord(rawPayload);
  const attributes = asRecord(asRecord(payload.data).attributes || payload.attributes || payload);
  const resources = asRecord(attributes.resources);
  const gpuMap = asRecord(resources.gpus);
  const gpuEntry = Object.entries(gpuMap)[0];

  const offerId = normalizeString(
    attributes.offer_id || attributes.ask_id || attributes.hostnode_id || payload.offer_id || payload.ask_id
  );
  if (!offerId) {
    throw new Error('Thiếu Vast offer_id. Hãy chọn một offer/hostnode trước khi tạo instance.');
  }

  const name = normalizeString(attributes.name || attributes.label, 'trungtammmo-gpu-ai');
  const rawImage = normalizeString(attributes.image);
  const dockerImage = rawImage.includes('/') || rawImage.includes(':') ? rawImage : getVastDefaultImage();
  const storageGb = normalizePositiveInt(asRecord(resources).storage_gb || attributes.disk, 100);
  const gpuCount = normalizePositiveInt(gpuEntry?.[1] && asRecord(gpuEntry[1]).count, 1);
  const onstart = normalizeString(attributes.onstart, 'nvidia-smi');
  const env = formatDockerEnvFlags(attributes.env);
  const ports = Array.isArray(attributes.port_forwards)
    ? attributes.port_forwards
        .map((item) => normalizePositiveInt(asRecord(item).internal_port, 0))
        .filter(Boolean)
    : [];

  const vastPayload: Record<string, unknown> = {
    client_id: 'me',
    image: dockerImage,
    disk: storageGb,
    label: name,
    onstart,
    runtype: normalizeString(attributes.runtype, 'ssh'),
    target_state: normalizeString(attributes.target_state, 'running'),
    python_utf8: normalizeBoolean(attributes.python_utf8, true),
    lang_utf8: normalizeBoolean(attributes.lang_utf8, true),
    use_jupyter_lab: normalizeBoolean(attributes.use_jupyter_lab, false),
    cancel_unavail: normalizeBoolean(attributes.cancel_unavail, true),
    env,
  };

  const optionalFields = ['price', 'template_hash_id', 'args', 'args_str', 'vm', 'force', 'use_ssh'] as const;
  for (const field of optionalFields) {
    if (attributes[field] !== undefined && attributes[field] !== '') {
      vastPayload[field] = attributes[field];
    }
  }

  if (gpuCount > 1) {
    vastPayload.num_gpus = gpuCount;
  }

  if (ports.length) {
    vastPayload.ports = ports.join(',');
  }

  const sshKey = normalizeString(attributes.ssh_key || attributes.sshKey || attributes.ssh_key_id);
  if (sshKey) {
    vastPayload.ssh_key = sshKey;
  }

  return {
    offerId,
    payload: vastPayload,
  };
}

export async function GET(req: NextRequest) {
  const userId = await requireUser();
  if (!userId) {
    return json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  if (!isVastConfigured()) {
    return json({ success: false, message: 'Thiếu VAST_API_KEY' }, { status: 500 });
  }

  const resource = normalizePath(req.nextUrl.searchParams.get('resource') || 'overview');

  try {
    if (resource === 'overview') {
      const [offers, instances, sshKeys, user] = await Promise.all([
        safeVastRequest('/bundles/', {
          method: 'POST',
          body: JSON.stringify(buildVastOfferSearch({ minGpus: 1, limit: 60 })),
        }),
        safeVastRequest('/instances/', undefined, { version: 'v1' }),
        safeVastRequest('/ssh/'),
        safeVastRequest('/users/current/'),
      ]);

      const mappedOffers = extractOffers(offers.data);
      const mappedInstances = mapInstances(extractInstances(instances.data));
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
          provider: 'vast-ai',
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
      const offer = extractOffers(payload).find((item) => String(item.id) === offerId);
      if (!offer) {
        return json({ success: false, message: 'Không tìm thấy offer Vast.ai' }, { status: 404 });
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
      return json({ success: true, data: { instances: mapInstances(extractInstances(payload)) } });
    }

    if (resource.startsWith('instances/')) {
      const instanceId = normalizePath(resource.slice('instances/'.length));
      if (!instanceId || instanceId.includes('/')) {
        return json({ success: false, message: 'Instance ID không hợp lệ' }, { status: 400 });
      }
      const payload = await vastRequest(`/instances/${encodeURIComponent(instanceId)}/`, undefined, { version: 'v1' });
      return json({ success: true, data: payload });
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
    return json({ success: false, message: 'Thiếu VAST_API_KEY' }, { status: 500 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = normalizePath(String(body?.action || 'create-instance'));

    if (action === 'create-instance') {
      const { offerId, payload } = buildCreateInstancePayload(body?.payload);
      const response = await vastRequest(`/asks/${encodeURIComponent(offerId)}/`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      return json({ success: true, data: response });
    }

    const instanceAction = getAllowedInstanceAction(action);
    if (instanceAction) {
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
    return json({ success: false, message: 'Thiếu VAST_API_KEY' }, { status: 500 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const instanceId = normalizeString(body?.instanceId || body?.id || req.nextUrl.searchParams.get('instanceId'));

    if (!instanceId) {
      return json({ success: false, message: 'Thiếu instanceId' }, { status: 400 });
    }

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
    return json({ success: false, message: 'Thiếu VAST_API_KEY' }, { status: 500 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const instanceId = normalizeString(body?.instanceId || req.nextUrl.searchParams.get('instanceId'));

    if (!instanceId) {
      return json({ success: false, message: 'Thiếu instanceId' }, { status: 400 });
    }

    const payload = await vastRequest(`/instances/${encodeURIComponent(instanceId)}/`, { method: 'DELETE' });
    return json({ success: true, data: payload });
  } catch (error) {
    return handleVastError(error);
  }
}
