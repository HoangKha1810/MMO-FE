import { db } from '@/lib/db';
import {
  getLegacySettingsMap,
  getSmmDefaultProviderId,
  getSmmPriceMultiplier,
  getVatPercent,
} from '@/lib/legacy-settings';
import { toNumber } from '@/lib/utils';

const DEFAULT_SMM_CACHE_TTL_MS = 60 * 1000;

type ProviderAction = 'services' | 'add' | 'status' | 'balance';
type ProviderType = 'Standard' | 'BaoStar';

interface RawSmmService {
  service?: number | string;
  name?: string;
  type?: string;
  category?: string;
  rate?: number | string;
  min?: number | string;
  max?: number | string;
  currency?: string;
  description?: string;
  refill?: boolean | string | number;
  provider_data?: string;
}

interface SmmProviderConfig extends SmmProviderMeta {
  providerId: number;
  providerName: string;
  providerType: ProviderType;
  apiKey: string;
  priceMultiplier: number;
  vatPercent: number;
  fromLegacySettings: boolean;
}

export interface SmmServiceRecord {
  id: number;
  provider_id: number;
  service: number;
  name: string;
  raw_name: string;
  type: string;
  category: string;
  platform: string;
  rate: number;
  min: number;
  max: number;
  currency: string;
  description: string;
  refill: boolean;
  price_per_1k_vnd: number;
  price_per_unit_vnd: number;
  is_comment_service: boolean;
  custom_price: number;
  total_orders?: number;
  provider_data?: string;
}

export interface SmmProviderMeta {
  apiUrl: string;
  maskedKey: string;
  method: 'POST';
  contentType: 'application/x-www-form-urlencoded';
  responseType: 'JSON';
  exchangeRate: number;
  marginPercent: number;
  isPerUnit: boolean;
  providerId?: number;
  providerName?: string;
}

interface ProviderStatusContext {
  platformHint?: string;
}

let servicesCache:
  | {
      providerId: number;
      expiresAt: number;
      data: SmmServiceRecord[];
    }
  | null = null;
let servicesLoadPromise:
  | {
      key: string;
      promise: Promise<SmmServiceRecord[]>;
    }
  | null = null;

export function clearSmmServicesCache() {
  servicesCache = null;
  servicesLoadPromise = null;
}

const platformKeywordMap: Array<{ platform: string; keywords: string[] }> = [
  { platform: 'Facebook', keywords: ['facebook', 'fb'] },
  { platform: 'TikTok', keywords: ['tiktok', 'tik tok', 'tt'] },
  { platform: 'Instagram', keywords: ['instagram', 'ig'] },
  { platform: 'YouTube', keywords: ['youtube', 'yt'] },
  { platform: 'Telegram', keywords: ['telegram', 'tg'] },
  { platform: 'Twitter', keywords: ['twitter', 'x ', 'tw'] },
  { platform: 'Shopee', keywords: ['shopee'] },
  { platform: 'Spotify', keywords: ['spotify'] },
  { platform: 'WhatsApp', keywords: ['whatsapp'] },
  { platform: 'Threads', keywords: ['threads'] },
  { platform: 'Bigo', keywords: ['bigo'] },
  { platform: 'Google', keywords: ['google'] },
];

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function stripHtml(value: string): string {
  return normalizeWhitespace(value.replace(/<[^>]*>/g, ' '));
}

function parseBoolean(value: boolean | string | number | null | undefined): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
  }

  return false;
}

function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) {
    return '*'.repeat(Math.max(4, apiKey.length));
  }

  return `${apiKey.slice(0, 6)}${'*'.repeat(apiKey.length - 10)}${apiKey.slice(-4)}`;
}

function detectPlatform(category: string, name: string): string {
  const normalized = `${category} ${name}`.toLowerCase();

  for (const item of platformKeywordMap) {
    if (item.keywords.some((keyword) => normalized.includes(keyword))) {
      return item.platform;
    }
  }

  return 'Khác';
}

function isCommentService(type: string, name: string): boolean {
  const normalizedType = type.toLowerCase();
  const normalizedName = name.toLowerCase();
  const isLikeComment =
    normalizedName.includes('like bình luận') ||
    normalizedName.includes('like comment') ||
    normalizedName.includes('like cmt');

  return (
    normalizedType === 'custom comments' ||
    (!isLikeComment &&
      (normalizedName.includes('bình luận') ||
        normalizedName.includes('comment') ||
        normalizedName.includes('cmt')))
  );
}

function normalizeSmmCategory(category: string): string {
  const trimmed = normalizeWhitespace(category);

  if (!trimmed || trimmed.startsWith('[')) {
    return trimmed;
  }

  const lower = trimmed.toLowerCase();
  const prefix =
    platformKeywordMap.find((item) => item.keywords.some((keyword) => lower.includes(keyword)))?.platform || '';

  const prefixMap: Record<string, string> = {
    Facebook: '[FB]',
    TikTok: '[TT]',
    Instagram: '[IG]',
    YouTube: '[YT]',
    Telegram: '[TG]',
    Twitter: '[TW]',
    Shopee: '[SP]',
    Google: '[GG]',
    Threads: '[THREADS]',
    Spotify: '[SPOTIFY]',
    WhatsApp: '[WHATSAPP]',
    Bigo: '[BIGO]',
  };

  return prefix && prefixMap[prefix] ? `${prefixMap[prefix]} ${trimmed}` : trimmed;
}

function parseProviderPayload(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Provider trả về dữ liệu không hợp lệ');
  }
}

function ensureObjectPayload(payload: unknown, fallbackMessage: string): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error(fallbackMessage);
  }

  return payload as Record<string, unknown>;
}

function getMarginPercent(multiplier: number): number {
  return Math.max(0, Math.round((Math.max(multiplier, 1) - 1) * 10000) / 100);
}

async function loadProviderConfig(providerId?: number | null): Promise<SmmProviderConfig> {
  const settings = await getLegacySettingsMap();
  const explicitProviderId =
    providerId !== undefined && providerId !== null ? Math.max(0, Math.trunc(toNumber(providerId, 0))) : null;
  const defaultProviderId = getSmmDefaultProviderId(settings);
  const preferredProviderName = normalizeWhitespace(
    process.env.SMM_PROVIDER_NAME || settings.smm_provider_name || 'SubMetaVip'
  );
  const priceMultiplier = getSmmPriceMultiplier(settings);
  const vatPercent = getVatPercent(settings);

  let provider =
    explicitProviderId && explicitProviderId > 0
      ? await db.api_providers.findFirst({
          where: {
            id: explicitProviderId,
            service_type: 'smm',
            status: 'active',
          },
        })
      : null;

  if (!provider && !explicitProviderId && preferredProviderName) {
    provider = await db.api_providers.findFirst({
      where: {
        service_type: 'smm',
        status: 'active',
        name: { contains: preferredProviderName },
      },
      orderBy: { id: 'desc' },
    });
  }

  if (!provider && !explicitProviderId && defaultProviderId > 0) {
    provider = await db.api_providers.findFirst({
      where: {
        id: defaultProviderId,
        service_type: 'smm',
        status: 'active',
      },
    });
  }

  if (!provider) {
    provider = await db.api_providers.findFirst({
      where: {
        service_type: 'smm',
        status: 'active',
      },
      orderBy: { id: 'asc' },
    });
  }

  if (provider?.api_url && provider.api_key) {
    const apiUrl = normalizeWhitespace(provider.api_url);
    const apiKey = String(provider.api_key);
    const providerType = String(provider.type || 'Standard') === 'BaoStar' ? 'BaoStar' : 'Standard';

    return {
      providerId: provider.id,
      providerName: provider.name,
      providerType,
      apiUrl,
      apiKey,
      maskedKey: maskApiKey(apiKey),
      method: 'POST',
      contentType: 'application/x-www-form-urlencoded',
      responseType: 'JSON',
      exchangeRate: toNumber(provider.exchange_rate, 1),
      marginPercent: getMarginPercent(priceMultiplier),
      isPerUnit: Boolean(provider.is_per_unit),
      priceMultiplier,
      vatPercent,
      fromLegacySettings: false,
    };
  }

  const apiUrl = normalizeWhitespace(settings.smm_api_url || '');
  const apiKey = String(settings.smm_api_key || '');

  if (!apiUrl || !apiKey) {
    throw new Error('Không tìm thấy cấu hình SMM đang hoạt động');
  }

  const providerType = String(settings.smm_api_type || 'Standard') === 'BaoStar' ? 'BaoStar' : 'Standard';

  return {
    providerId: 0,
    providerName: 'Legacy SMM',
    providerType,
    apiUrl,
    apiKey,
    maskedKey: maskApiKey(apiKey),
    method: 'POST',
    contentType: 'application/x-www-form-urlencoded',
    responseType: 'JSON',
    exchangeRate: toNumber(settings.smm_api_exchange_rate, 1),
    marginPercent: getMarginPercent(priceMultiplier),
    isPerUnit: parseBoolean(settings.smm_api_is_per_unit),
    priceMultiplier,
    vatPercent,
    fromLegacySettings: true,
  };
}

async function requestStandardProvider(
  config: SmmProviderConfig,
  action: ProviderAction,
  params: Record<string, string | number> = {}
): Promise<unknown> {
  const body = new URLSearchParams({
    key: config.apiKey,
    action,
  });

  for (const [key, value] of Object.entries(params)) {
    body.set(key, String(value));
  }

  const response = await fetch(config.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
    cache: 'no-store',
  });

  const text = await response.text();
  const payload = parseProviderPayload(text);

  if (!response.ok) {
    const data = ensureObjectPayload(payload, `Provider trả về HTTP ${response.status}`);
    throw new Error(typeof data.error === 'string' ? data.error : `Provider trả về HTTP ${response.status}`);
  }

  if (payload && typeof payload === 'object' && !Array.isArray(payload) && 'error' in payload) {
    const message = payload.error;
    if (typeof message === 'string' && message.trim()) {
      throw new Error(message);
    }
  }

  return payload;
}

function guessBaoStarPlatform(text: string): string {
  const normalized = text.toLowerCase();

  if (normalized.includes('facebook') || normalized.includes('[fb]')) return 'facebook';
  if (normalized.includes('tiktok') || normalized.includes('[tt]')) return 'tiktok';
  if (normalized.includes('instagram') || normalized.includes('[ig]')) return 'instagram';
  if (normalized.includes('youtube') || normalized.includes('[yt]')) return 'youtube';
  if (normalized.includes('shopee') || normalized.includes('[sp]')) return 'shopee';
  if (normalized.includes('telegram') || normalized.includes('[tg]')) return 'telegram';
  if (normalized.includes('twitter') || normalized.includes('[tw]')) return 'twitter';
  if (normalized.includes('threads') || normalized.includes('[threads]')) return 'threads';
  if (normalized.includes('google') || normalized.includes('[gg]')) return 'google';

  return 'facebook';
}

async function requestBaoStar(
  config: SmmProviderConfig,
  path: string,
  init: {
    method?: 'GET' | 'POST';
    params?: Record<string, string | number>;
    json?: boolean;
  } = {}
): Promise<Record<string, unknown>> {
  const method = init.method || 'GET';
  const isAbsolute = /^https?:\/\//i.test(path);
  const url = isAbsolute ? path : `${config.apiUrl.replace(/\/+$/, '')}${path}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'api-key': config.apiKey,
  };

  let body: string | undefined;

  if (method === 'POST' && init.params) {
    if (init.json === false) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(
        Object.entries(init.params).reduce<Record<string, string>>((acc, [key, value]) => {
          acc[key] = String(value);
          return acc;
        }, {})
      ).toString();
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(init.params);
    }
  }

  const response = await fetch(url, {
    method,
    headers,
    body,
    cache: 'no-store',
  });

  const text = await response.text();
  const payload = ensureObjectPayload(parseProviderPayload(text), 'BaoStar trả về dữ liệu không hợp lệ');

  if (!response.ok) {
    throw new Error(typeof payload.message === 'string' ? payload.message : `BaoStar trả về HTTP ${response.status}`);
  }

  return payload;
}

async function fetchProviderServices(config: SmmProviderConfig): Promise<RawSmmService[]> {
  if (config.providerType === 'BaoStar') {
    const payload = await requestBaoStar(config, '/api/prices');

    if (!payload.success) {
      throw new Error(typeof payload.message === 'string' ? payload.message : 'BaoStar không trả về danh sách dịch vụ');
    }

    const categories = Array.isArray(payload.data) ? payload.data : [];
    const services: RawSmmService[] = [];

    for (const category of categories) {
      if (!category || typeof category !== 'object') {
        continue;
      }

      const categoryName = String(category.name || 'General');
      const path = String(category.path || '');
      const urlApi = String(category.url_api || '');
      const tag = normalizeSmmCategory(categoryName);
      const packages = Array.isArray(category.package) ? category.package : [];

      for (const pkg of packages) {
        if (!pkg || typeof pkg !== 'object') {
          continue;
        }

        services.push({
          service: pkg.id,
          name: String(pkg.name || `Service #${String(pkg.id || '')}`),
          category: tag,
          rate: toNumber(pkg.price_per, 0) * 1000,
          min: pkg.min_quantity,
          max: pkg.max_quantity,
          type: 'Default',
          description: String(pkg.description || ''),
          provider_data: JSON.stringify({
            package_name: pkg.package_name,
            url_api: urlApi,
            platform: guessBaoStarPlatform(path || categoryName),
          }),
        });
      }
    }

    return services;
  }

  const payload = await requestStandardProvider(config, 'services');

  if (!Array.isArray(payload)) {
    throw new Error('Provider không trả về danh sách dịch vụ hợp lệ');
  }

  return payload as RawSmmService[];
}

function normalizeImportedRate(rawRate: unknown, config: SmmProviderConfig): number {
  const baseRate = toNumber(rawRate, 0);
  const normalizedRate = config.isPerUnit ? baseRate * 1000 : baseRate;
  return normalizedRate * Math.max(config.exchangeRate, 1);
}

async function syncSmmServicesFromProvider(config: SmmProviderConfig): Promise<void> {
  const servicesRaw = await fetchProviderServices(config);

  const existingRows = await db.smm_services_cache.findMany({
    where: { provider_id: config.providerId },
    select: {
      id: true,
      service_id: true,
      rate: true,
      custom_price: true,
      is_auto_margin: true,
      margin_percent: true,
      old_rate: true,
      last_price_change: true,
      is_deleted: true,
      status: true,
    },
  });

  const existingMap = new Map(existingRows.map((row) => [row.service_id, row]));
  const syncedIds: number[] = [];

  for (const rawService of servicesRaw) {
    const serviceId = Math.max(0, Math.trunc(toNumber(rawService.service, 0)));
    if (!serviceId) {
      continue;
    }

    const normalizedName = stripHtml(String(rawService.name || `Service #${serviceId}`));
    const normalizedCategory = normalizeSmmCategory(stripHtml(String(rawService.category || 'Chưa phân loại')));
    const newRate = normalizeImportedRate(rawService.rate, config);
    const min = Math.max(1, Math.trunc(toNumber(rawService.min, 1)));
    const max = Math.max(min, Math.trunc(toNumber(rawService.max, min)));
    const type = normalizeWhitespace(String(rawService.type || 'Default')) || 'Default';
    const description = String(rawService.description || '').trim() || null;
    const providerData = rawService.provider_data || null;

    syncedIds.push(serviceId);

    const existing = existingMap.get(serviceId);
    if (existing) {
      const oldRate = toNumber(existing.rate, 0);
      const changed = Math.abs(newRate - oldRate) > 0.00001;
      const isAutoMargin = Boolean(existing.is_auto_margin);
      const marginPercent = toNumber(existing.margin_percent, 0);
      let customPrice = toNumber(existing.custom_price, 0);

      if (changed && isAutoMargin) {
        customPrice = newRate * (1 + marginPercent / 100);
      }

      await db.smm_services_cache.update({
        where: { id: existing.id },
        data: {
          original_name: normalizedName,
          category: normalizedCategory,
          rate: newRate,
          old_rate: changed ? oldRate : existing.old_rate,
          last_price_change: changed ? new Date() : existing.last_price_change,
          min,
          max,
          type,
          description,
          provider_data: providerData,
          custom_price: customPrice > 0 ? customPrice : null,
          cached_at: new Date(),
          status: 'active',
          is_deleted: false,
        },
      });

      continue;
    }

    await db.smm_services_cache.create({
      data: {
        provider_id: config.providerId,
        service_id: serviceId,
        name: normalizedName,
        original_name: normalizedName,
        category: normalizedCategory,
        rate: newRate,
        min,
        max,
        type,
        description,
        provider_data: providerData,
        status: 'active',
        is_deleted: false,
        cached_at: new Date(),
      },
    });
  }

  if (syncedIds.length > 0) {
    await db.smm_services_cache.updateMany({
      where: {
        provider_id: config.providerId,
        is_deleted: false,
        service_id: { notIn: syncedIds },
      },
      data: {
        status: 'inactive',
      },
    });
  }

  servicesCache = null;
}

function normalizeCachedService(
  row: {
    id: number;
    provider_id: number | null;
    service_id: number;
    name: string;
    original_name: string | null;
    category: string | null;
    rate: unknown;
    custom_price: unknown;
    min: number;
    max: number;
    type: string | null;
    description: string | null;
    provider_data: string | null;
    total_orders?: number | null;
  },
  config: SmmProviderConfig
): SmmServiceRecord {
  const rawName = normalizeWhitespace(String(row.original_name || row.name || `Service #${row.service_id}`));
  const name = stripHtml(String(row.name || rawName)) || rawName;
  const category = normalizeWhitespace(String(row.category || 'Chưa phân loại'));
  const type = normalizeWhitespace(String(row.type || 'Default')) || 'Default';
  const cachedRate = toNumber(row.rate, 0);
  const customPrice = toNumber(row.custom_price, 0);
  const finalRate = customPrice > 0 ? customPrice : cachedRate * Math.max(config.priceMultiplier, 1);

  return {
    id: row.id,
    provider_id: row.provider_id ?? config.providerId,
    service: row.service_id,
    name,
    raw_name: rawName,
    type,
    category,
    platform: detectPlatform(category, name),
    rate: cachedRate,
    min: Math.max(1, row.min),
    max: Math.max(row.min, row.max),
    currency: config.exchangeRate > 1 ? 'USD' : 'VND',
    description: stripHtml(String(row.description || '')),
    refill: false,
    price_per_1k_vnd: finalRate,
    price_per_unit_vnd: finalRate / 1000,
    is_comment_service: isCommentService(type, name),
    custom_price: customPrice,
    total_orders: Math.max(0, Math.trunc(toNumber(row.total_orders, 0))),
    provider_data: row.provider_data || undefined,
  };
}

export async function getSmmProviderMeta(providerId?: number | null): Promise<SmmProviderMeta> {
  const config = await loadProviderConfig(providerId);

  return {
    apiUrl: config.apiUrl,
    maskedKey: config.maskedKey,
    method: config.method,
    contentType: config.contentType,
    responseType: config.responseType,
    exchangeRate: config.exchangeRate,
    marginPercent: config.marginPercent,
    isPerUnit: config.isPerUnit,
    providerId: config.providerId,
    providerName: config.providerName,
  };
}

export async function listSmmServices(forceRefresh = false, providerId?: number | null): Promise<SmmServiceRecord[]> {
  const config = await loadProviderConfig(providerId);
  const now = Date.now();

  if (!forceRefresh && servicesCache && servicesCache.providerId === config.providerId && servicesCache.expiresAt > now) {
    return servicesCache.data;
  }

  const loadKey = `${config.providerId}:${forceRefresh ? 'refresh' : 'cached'}`;
  if (servicesLoadPromise?.key === loadKey) {
    return servicesLoadPromise.promise;
  }

  const loadPromise = (async () => {
    if (forceRefresh) {
      await syncSmmServicesFromProvider(config);
    }

    let rows = await db.smm_services_cache.findMany({
      where: {
        provider_id: config.providerId,
        status: 'active',
        is_deleted: false,
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        provider_id: true,
        service_id: true,
        name: true,
        original_name: true,
        category: true,
        rate: true,
        custom_price: true,
        min: true,
        max: true,
        type: true,
        description: true,
        provider_data: true,
        total_orders: true,
      },
    });

    if (rows.length === 0 && !forceRefresh) {
      await syncSmmServicesFromProvider(config);
      rows = await db.smm_services_cache.findMany({
        where: {
          provider_id: config.providerId,
          status: 'active',
          is_deleted: false,
        },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          provider_id: true,
          service_id: true,
          name: true,
          original_name: true,
          category: true,
          rate: true,
          custom_price: true,
          min: true,
          max: true,
          type: true,
          description: true,
          provider_data: true,
          total_orders: true,
        },
      });
    }

    const orderCounts = await db.smm_orders.groupBy({
      by: ['provider_id', 'service_id'],
      where: { provider_id: config.providerId },
      _count: { _all: true },
    });
    const orderCountMap = new Map(
      orderCounts.map((row) => [`${row.provider_id ?? 0}:${row.service_id}`, row._count._all])
    );

    const services = rows.map((row) =>
      normalizeCachedService(
        {
          ...row,
          total_orders: Math.max(
            Math.trunc(toNumber(row.total_orders, 0)),
            orderCountMap.get(`${row.provider_id ?? config.providerId}:${row.service_id}`) || 0
          ),
        },
        config
      )
    );

    servicesCache = {
      providerId: config.providerId,
      expiresAt: Date.now() + DEFAULT_SMM_CACHE_TTL_MS,
      data: services,
    };

    return services;
  })();

  servicesLoadPromise = {
    key: loadKey,
    promise: loadPromise,
  };

  try {
    return await loadPromise;
  } finally {
    if (servicesLoadPromise?.promise === loadPromise) {
      servicesLoadPromise = null;
    }
  }
}

export async function findSmmService(serviceId: number, providerId?: number | null): Promise<SmmServiceRecord | null> {
  const services = await listSmmServices(false, providerId);
  return services.find((service) => service.service === serviceId) || null;
}

async function createBaoStarOrder(
  config: SmmProviderConfig,
  service: SmmServiceRecord,
  input: { link: string; quantity: number; comments?: string; reaction?: string }
): Promise<{ orderId: string }> {
  let providerData: Record<string, unknown> = {};

  if (service.provider_data) {
    try {
      providerData = ensureObjectPayload(JSON.parse(service.provider_data), 'Provider data không hợp lệ');
    } catch {
      providerData = {};
    }
  }

  const urlApi = String(providerData.url_api || '');
  const packageName = String(providerData.package_name || '');

  if (!urlApi || !packageName) {
    throw new Error('Dịch vụ BaoStar thiếu cấu hình provider_data');
  }

  const payload = await requestBaoStar(config, urlApi, {
    method: 'POST',
    params: {
      object_id: input.link,
      quantity: input.quantity,
      package_name: packageName,
      ...(input.reaction ? { reaction: input.reaction } : {}),
      ...(input.comments ? { list_comment: input.comments } : {}),
    },
  });

  if (!payload.success) {
    throw new Error(typeof payload.message === 'string' ? payload.message : 'BaoStar từ chối tạo đơn');
  }

  const data = ensureObjectPayload(payload.data, 'BaoStar không trả về mã đơn hợp lệ');
  const orderId = data.id;

  if (typeof orderId !== 'string' && typeof orderId !== 'number') {
    throw new Error('BaoStar không trả về mã đơn hợp lệ');
  }

  return { orderId: String(orderId) };
}

export async function createSmmProviderOrder(input: {
  providerId?: number | null;
  serviceId: number;
  link: string;
  quantity: number;
  comments?: string;
  reaction?: string;
}): Promise<{ orderId: string }> {
  const service = await findSmmService(input.serviceId, input.providerId);

  if (!service) {
    throw new Error('Không tìm thấy dịch vụ SMM');
  }

  const config = await loadProviderConfig(input.providerId ?? service.provider_id);

  if (config.providerType === 'BaoStar') {
    return createBaoStarOrder(config, service, input);
  }

  const payload = await requestStandardProvider(config, 'add', {
    service: service.service,
    link: input.link,
    quantity: input.quantity,
    ...(input.reaction ? { reaction: input.reaction } : {}),
    ...(input.comments && service.is_comment_service ? { comments: input.comments } : {}),
  });

  const data = ensureObjectPayload(payload, 'Provider không trả về mã đơn hợp lệ');
  const orderId = data.order;

  if (typeof orderId !== 'number' && typeof orderId !== 'string') {
    throw new Error('Provider không trả về mã đơn hợp lệ');
  }

  return { orderId: String(orderId) };
}

export async function getSmmCheckoutAmount(service: SmmServiceRecord, quantity: number): Promise<{
  subtotal: number;
  vatAmount: number;
  totalToPay: number;
  vatPercent: number;
}> {
  const settings = await getLegacySettingsMap();
  const vatPercent = getVatPercent(settings);
  const subtotal = Math.ceil((Math.max(quantity, 0) / 1000) * service.price_per_1k_vnd);
  const vatAmount = Math.round(subtotal * vatPercent / 100);
  const totalToPay = Math.round(subtotal + vatAmount);

  return { subtotal, vatAmount, totalToPay, vatPercent };
}

export async function getSmmProviderBalance(providerId?: number | null): Promise<Record<string, unknown>> {
  const config = await loadProviderConfig(providerId);

  if (config.providerType === 'BaoStar') {
    const payload = await requestStandardProvider(config, 'balance');
    return ensureObjectPayload(payload, 'BaoStar không trả về số dư hợp lệ');
  }

  const payload = await requestStandardProvider(config, 'balance');
  return ensureObjectPayload(payload, 'Provider không trả về số dư hợp lệ');
}

export async function getSmmProviderOrderStatus(
  orderId: string,
  providerId?: number | null,
  context: ProviderStatusContext = {}
): Promise<Record<string, unknown>> {
  const result = await getSmmProviderMultipleOrdersStatus([orderId], providerId, context);
  const direct = result[orderId];

  if (direct && typeof direct === 'object') {
    return direct as Record<string, unknown>;
  }

  if ('status' in result || 'charge' in result || 'start_count' in result || 'remains' in result) {
    return result;
  }

  throw new Error('Không thể lấy trạng thái đơn từ provider');
}

export async function getSmmProviderMultipleOrdersStatus(
  orderIds: string[],
  providerId?: number | null,
  context: ProviderStatusContext = {}
): Promise<Record<string, unknown>> {
  const config = await loadProviderConfig(providerId);

  if (config.providerType === 'BaoStar') {
    const payload = await requestBaoStar(config, '/api/logs-order', {
      method: 'POST',
      params: {
        type: context.platformHint || 'facebook',
        list_ids: orderIds.join(','),
      },
    });

    if (Array.isArray(payload.data)) {
      const normalized: Record<string, unknown> = {};

      for (const row of payload.data) {
        if (!row || typeof row !== 'object') {
          continue;
        }

        const record = row as Record<string, unknown>;
        const currentId = String(record.id || record.order_id || record.orderid || '');
        if (!currentId) {
          continue;
        }

        const quantity = Math.trunc(toNumber(record.quantity, 0));
        const countRun = Math.trunc(toNumber(record.count_is_run, 0));
        const rawStatus = String(record.status || 'Pending');
        const statusMap: Record<string, string> = {
          '200': 'Completed',
          '100': 'Processing',
          '0': 'Pending',
          '-1': 'Cancelled',
          done: 'Completed',
          Done: 'Completed',
        };

        normalized[currentId] = {
          status: statusMap[rawStatus] || rawStatus,
          start_count: Math.trunc(toNumber(record.start_like, 0)),
          remains: Math.max(0, quantity - countRun),
        };
      }

      if (orderIds.length === 1 && normalized[orderIds[0]]) {
        return normalized[orderIds[0]] as Record<string, unknown>;
      }

      return normalized;
    }

    return payload;
  }

  const payload = await requestStandardProvider(config, 'status', {
    [orderIds.length === 1 ? 'order' : 'orders']: orderIds.length === 1 ? orderIds[0] : orderIds.join(','),
  });

  return ensureObjectPayload(payload, 'Provider không trả về dữ liệu trạng thái hợp lệ');
}

export async function guessProviderStatusContext(orderIds: string[]): Promise<ProviderStatusContext> {
  const order = await db.smm_orders.findFirst({
    where: {
      api_order_id: { in: orderIds },
    },
    orderBy: { id: 'desc' },
    select: {
      service_id: true,
      provider_id: true,
    },
  });

  if (!order) {
    return {};
  }

  const service = await db.smm_services_cache.findFirst({
    where: {
      provider_id: order.provider_id || 0,
      service_id: order.service_id,
    },
    select: {
      category: true,
      provider_data: true,
    },
  });

  if (!service) {
    return {};
  }

  if (service.provider_data) {
    try {
      const providerData = JSON.parse(service.provider_data) as Record<string, unknown>;
      if (typeof providerData.platform === 'string') {
        return { platformHint: providerData.platform };
      }
    } catch {
      return { platformHint: guessBaoStarPlatform(String(service.category || '')) };
    }
  }

  return { platformHint: guessBaoStarPlatform(String(service.category || '')) };
}
