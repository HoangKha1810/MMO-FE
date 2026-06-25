import 'server-only';

import { db } from '@/lib/db';
import {
  calculateGameAccountApiPrice,
  clampResourcePrice,
  rewriteGameAccountPriceMentions,
} from '@/lib/game-account-pricing';
import {
  buildGameAccountProviderSourceWhereSql,
  buildRandom1kResourceWhereSql,
  buildRandom1kTags,
  getGameAccountProviderKind,
  getRandom1kResourceType,
  isRandom1kProviderLike,
  normalizeProviderAssetUrl,
} from '@/lib/random1k';
import { hideProviderBranding } from '@/lib/provider-branding';
import { cleanResourceHtml } from '@/lib/resource-content';
import { slugify, toNumber } from '@/lib/utils';

type Row = Record<string, unknown>;

interface ProviderRecord {
  id: number;
  name: string;
  type: string | null;
  api_url: string | null;
  api_key: string | null;
  exchange_rate: unknown;
  last_sync?: Date | string | null;
}

interface CloneTutProduct {
  id: string | number;
  name: string;
  price: string | number;
  amount: string | number;
  description?: string | null;
  flag?: string | null;
  min?: string | number | null;
  max?: string | number | null;
}

interface CloneTutCategory {
  id: string | number;
  parent_id: string | number | null;
  name: string;
  icon?: string | null;
  products?: CloneTutProduct[];
}

interface CloneTutProductsResponse {
  status?: string;
  msg?: string;
  categories?: CloneTutCategory[];
}

interface CloneTutProductResponse {
  status?: string;
  msg?: string;
  product?: CloneTutProduct[];
}

interface CloneTutProfileResponse {
  status?: string;
  msg?: string;
  data?: {
    username?: string;
    money?: string | number;
  };
}

interface CloneTutOrderResponse {
  status?: string;
  msg?: string;
  trans_id?: string;
  data?: string[];
}

interface CloneTutBuyResponse extends CloneTutOrderResponse {}

interface ExistingCategoryRow extends Row {
  id: number;
  parent_id: number | null;
  name: string | null;
  slug: string | null;
  icon: string | null;
  image: string | null;
  api_category_id: string | null;
}

interface ExistingResourceRow extends Row {
  id: number;
  product_code: string | null;
  title: string | null;
  description: string | null;
  category: string | null;
  category_id: number | null;
  price: unknown;
  original_price: unknown;
  thumbnail: string | null;
  resource_type: string | null;
  stock: unknown;
  status: string | null;
  featured: unknown;
  is_pinned: unknown;
  api_product_id: string | null;
  is_auto: unknown;
  is_auto_margin: unknown;
  margin_percent: unknown;
  custom_badge: string | null;
  display_order: unknown;
  tags: string | null;
}

export interface MmoProviderSyncSummary {
  providers: number;
  categories: number;
  products: number;
  disabled_categories: number;
  disabled_products: number;
}

export interface GameAccountAutoSyncSummary extends MmoProviderSyncSummary {
  skipped?: boolean;
  reason?: 'recent' | 'missing-provider' | 'missing-api-key' | 'syncing';
}

const GAME_ACCOUNT_AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;
const GAME_ACCOUNT_BACKGROUND_SYNC_DELAY_MS = 1500;
const GAME_ACCOUNT_PROVIDER_DISPLAY_NAME = 'Provider API Tài khoản game';
const GAME_ACCOUNT_PROVIDER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, '');
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function readProviderMessage(payload: unknown, fallback: string) {
  const payloadObject = asObject(payload);
  const message = payloadObject?.msg || payloadObject?.message || payloadObject?.error;
  return typeof message === 'string' && message.trim() ? message.trim() : fallback;
}

function providerDisplayName() {
  return GAME_ACCOUNT_PROVIDER_DISPLAY_NAME;
}

function parseProviderJson(provider: ProviderRecord, text: string, context: string, httpStatus?: number) {
  const displayName = providerDisplayName();
  try {
    return JSON.parse(text);
  } catch {
    const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 180);
    const cloudflareBlocked = /cloudflare|just a moment|cf-browser-verification|cf-chl/i.test(text);
    if (cloudflareBlocked) {
      throw new Error(
        `${displayName} yêu cầu xác thực Cloudflare cho request server${httpStatus ? ` (HTTP ${httpStatus})` : ''}. Hãy cấp cookie cf_clearance hợp lệ hoặc cấu hình Cloudflare để endpoint API trả JSON cho server.`
      );
    }

    throw new Error(
      snippet
        ? `${displayName} trả về dữ liệu ${context} không hợp lệ: ${snippet}`
        : `${displayName} trả về dữ liệu ${context} không hợp lệ`
    );
  }
}

function collectProviderDeliveryLines(value: unknown): string[] {
  const lines: string[] = [];
  const visit = (item: unknown) => {
    if (item === null || item === undefined) return;

    if (Array.isArray(item)) {
      item.forEach(visit);
      return;
    }

    if (typeof item === 'object') {
      const object = item as Record<string, unknown>;
      const preferredKeys = [
        'data',
        'content',
        'file',
        'account',
        'accounts',
        'items',
        'products',
        'result',
      ];

      if (preferredKeys.some((key) => key in object)) {
        preferredKeys.forEach((key) => visit(object[key]));
        return;
      }

      const compact = JSON.stringify(object);
      if (compact && compact !== '{}') lines.push(compact);
      return;
    }

    const text = String(item || '').trim();
    if (!text) return;
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => lines.push(line));
  };

  visit(value);
  return Array.from(new Set(lines));
}

function getProviderOrderId(payload: Record<string, unknown>) {
  const nested = asObject(payload.data);
  const candidates = [
    payload.trans_id,
    payload.order_id,
    payload.order,
    payload.id,
    payload.transaction_id,
    payload.transactionId,
    nested?.trans_id,
    nested?.order_id,
    nested?.order,
    nested?.id,
    nested?.transaction_id,
    nested?.transactionId,
  ];

  return String(candidates.find((item) => String(item || '').trim()) || '').trim();
}

function readFirstEnv(names: string[]) {
  for (const name of names) {
    const value = String(process.env[name] || '').trim();
    if (value) return value;
  }
  return '';
}

function getProviderCloudflareCookie(provider: ProviderRecord) {
  const signature = `${provider.name || ''} ${provider.type || ''} ${provider.api_url || ''}`;
  const isShopreg = /shopreg61|shopreg/i.test(signature);
  const prefix = isShopreg ? 'SHOPREG61' : 'RANDOM1K';
  const cookie = readFirstEnv([
    `${prefix}_CLOUDFLARE_COOKIE`,
    `${prefix}_CF_COOKIE`,
    `${prefix}_COOKIE`,
  ]);
  if (cookie) return cookie;

  const clearance = readFirstEnv([
    `${prefix}_CF_CLEARANCE`,
    `${prefix}_CLOUDFLARE_CLEARANCE`,
  ]);
  return clearance ? `cf_clearance=${clearance}` : '';
}

function getProviderAccessToken(provider: ProviderRecord) {
  const signature = `${provider.name || ''} ${provider.type || ''} ${provider.api_url || ''}`;
  const isShopreg = /shopreg61|shopreg/i.test(signature);
  const prefix = isShopreg ? 'SHOPREG61' : 'RANDOM1K';
  return readFirstEnv([
    `${prefix}_ACCESS_TOKEN`,
    `${prefix}_ACCESSTOKEN`,
    `${prefix}_AUTH_TOKEN`,
  ]);
}

function getProviderUserAgent(provider: ProviderRecord) {
  const signature = `${provider.name || ''} ${provider.type || ''} ${provider.api_url || ''}`;
  const isShopreg = /shopreg61|shopreg/i.test(signature);
  const prefix = isShopreg ? 'SHOPREG61' : 'RANDOM1K';
  return readFirstEnv([
    `${prefix}_USER_AGENT`,
    `${prefix}_UA`,
    'GAME_ACCOUNT_PROVIDER_USER_AGENT',
  ]) || GAME_ACCOUNT_PROVIDER_USER_AGENT;
}

function buildProviderHeaders(provider: ProviderRecord) {
  const headers: Record<string, string> = {
    Accept: 'application/json, text/plain, */*',
    'User-Agent': getProviderUserAgent(provider),
  };
  const accessToken = getProviderAccessToken(provider);
  const cookie = getProviderCloudflareCookie(provider);
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
    headers['x-access-token'] = accessToken;
    headers['access-token'] = accessToken;
    headers.accesstoken = accessToken;
  }
  const cookieParts = [
    cookie,
    accessToken ? `accessToken=${accessToken}` : '',
  ].filter(Boolean);
  if (cookieParts.length > 0) {
    headers.Cookie = cookieParts.join('; ');
  }
  return headers;
}

function truthy(value: unknown) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function normalizeMoney(value: unknown, exchangeRate: number) {
  const amount = Math.max(0, toNumber(value, 0));
  return clampResourcePrice(amount * Math.max(exchangeRate, 1));
}

function buildCategoryKey(name: string, parentRemoteId: string | null) {
  return `${parentRemoteId || 'root'}::${slugify(name)}`;
}

function guessResourceType(categoryName: string, productName: string) {
  const normalized = `${categoryName} ${productName}`.toLowerCase();
  if (/(profile|clone|cookie|hotmail|outlook|fanpage|netflix|capcut|chat ?gpt|gmail|account|page|gpm)/.test(normalized)) {
    return 'account';
  }
  if (/(proxy|vpn|tool|script|software|grok|canva|gemini|microsoft|veo|api)/.test(normalized)) {
    return 'tool';
  }
  if (/(api|token|key)/.test(normalized)) {
    return 'api';
  }
  return 'other';
}

function buildProductCode(id: number) {
  return `TN${String(id).padStart(5, '0')}`;
}

async function getMmoProviders(providerId?: number) {
  await ensureGameAccountProvidersFromEnv();

  return db.api_providers.findMany({
    where: {
      service_type: 'mmo',
      status: 'active',
      ...(providerId ? { id: providerId } : {}),
    },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      name: true,
      type: true,
      api_url: true,
      api_key: true,
      exchange_rate: true,
      last_sync: true,
    },
  });
}

let gameAccountEnvProviderPromise: Promise<void> | null = null;
let gameAccountAutoSyncPromise: Promise<GameAccountAutoSyncSummary> | null = null;
let lastGameAccountAutoSyncAt = 0;
let lastGameAccountAutoSyncScheduleAt = 0;

type GameAccountEnvSeed = {
  kind: 'random1k' | 'shopreg61';
  apiUrl: string;
  apiKey: string;
  exchangeRate: number;
};

function getGameAccountEnvSeeds(): GameAccountEnvSeed[] {
  const seeds: GameAccountEnvSeed[] = [];
  const legacyApiKey = String(process.env.GAME_ACCOUNT_API_KEY || '').trim();
  const legacyApiUrl = String(process.env.GAME_ACCOUNT_API_URL || '').trim();
  const legacyExchangeRate = Math.max(1, toNumber(process.env.GAME_ACCOUNT_EXCHANGE_RATE, 1));

  const random1kApiKey = String(process.env.RANDOM1K_API_KEY || '').trim();
  const random1kApiUrl = String(process.env.RANDOM1K_API_URL || '').trim();
  const random1kExchangeRate = Math.max(1, toNumber(process.env.RANDOM1K_EXCHANGE_RATE || legacyExchangeRate, 1));

  const shopregApiKey = String(process.env.SHOPREG61_API_KEY || process.env.SHOPREG_API_KEY || '').trim();
  const shopregApiUrl = String(process.env.SHOPREG61_API_URL || process.env.SHOPREG_API_URL || '').trim();
  const shopregExchangeRate = Math.max(1, toNumber(process.env.SHOPREG61_EXCHANGE_RATE || process.env.SHOPREG_EXCHANGE_RATE || legacyExchangeRate, 1));

  if (random1kApiKey || (legacyApiKey && /random1k/i.test(legacyApiUrl))) {
    seeds.push({
      kind: 'random1k',
      apiKey: random1kApiKey || legacyApiKey,
      apiUrl: normalizeBaseUrl(random1kApiUrl || legacyApiUrl || 'https://random1k.com/api'),
      exchangeRate: random1kExchangeRate,
    });
  }

  if (shopregApiKey || (legacyApiKey && /shopreg61/i.test(legacyApiUrl))) {
    seeds.push({
      kind: 'shopreg61',
      apiKey: shopregApiKey || legacyApiKey,
      apiUrl: normalizeBaseUrl(shopregApiUrl || legacyApiUrl || 'https://www.shopreg61.com/api'),
      exchangeRate: shopregExchangeRate,
    });
  }

  if (seeds.length === 0 && legacyApiKey) {
    const kind = /shopreg61/i.test(legacyApiUrl) ? 'shopreg61' : 'random1k';
    seeds.push({
      kind,
      apiKey: legacyApiKey,
      apiUrl: normalizeBaseUrl(legacyApiUrl || (kind === 'shopreg61' ? 'https://www.shopreg61.com/api' : 'https://random1k.com/api')),
      exchangeRate: legacyExchangeRate,
    });
  }

  return seeds.filter((seed) => seed.apiKey && seed.apiUrl);
}

async function ensureGameAccountProvidersFromEnv() {
  if (gameAccountEnvProviderPromise) return gameAccountEnvProviderPromise;

  gameAccountEnvProviderPromise = (async () => {
    const seeds = getGameAccountEnvSeeds();
    if (seeds.length === 0) return;

    for (const seed of seeds) {
      const existing = await db.api_providers.findFirst({
        where: {
          service_type: 'mmo',
          OR: seed.kind === 'shopreg61'
            ? [
                { name: { contains: 'shopreg61' } },
                { api_url: { contains: 'shopreg61.com' } },
              ]
            : [
                { name: { contains: 'Random1k' } },
                { name: { contains: 'random 1k' } },
                { api_url: { contains: 'random1k.com' } },
              ],
        },
        select: { id: true },
      });

      const providerData = {
        name: GAME_ACCOUNT_PROVIDER_DISPLAY_NAME,
        type: seed.kind === 'shopreg61' ? 'GameAccountShopreg' : 'GameAccountRandom1k',
        api_url: seed.apiUrl,
        api_key: seed.apiKey,
        service_type: 'mmo' as const,
        exchange_rate: seed.exchangeRate,
        status: 'active' as const,
        health_status: 'online' as const,
      };

      if (existing?.id) {
        await db.api_providers.update({
          where: { id: existing.id },
          data: providerData,
        }).catch(() => undefined);
      } else {
        await db.api_providers.create({
          data: providerData,
        }).catch(() => undefined);
      }
    }
  })().catch((error) => {
    gameAccountEnvProviderPromise = null;
    throw error;
  });

  return gameAccountEnvProviderPromise;
}

async function getFallbackAdminId() {
  const rows = await db.$queryRawUnsafe<Array<{ id: number }>>(
    "SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1"
  );
  return Number(rows[0]?.id || 1);
}

async function requestCloneTut<T>(provider: ProviderRecord, endpoint: string, params: Record<string, string | number> = {}) {
  const apiUrl = normalizeBaseUrl(String(provider.api_url || ''));
  const apiKey = String(provider.api_key || '').trim();
  const displayName = providerDisplayName();

  if (!apiUrl || !apiKey) {
    throw new Error(`${displayName} chưa có api_url hoặc api_key`);
  }

  const url = new URL(`${apiUrl}/${endpoint.replace(/^\/+/, '')}`);
  url.searchParams.set('api_key', apiKey);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: buildProviderHeaders(provider),
    cache: 'no-store',
  });

  const text = await response.text();
  const payload = parseProviderJson(provider, text, 'phản hồi', response.status);

  if (!response.ok) {
    throw new Error(readProviderMessage(payload, `${displayName} trả về HTTP ${response.status}`));
  }

  const payloadObject = asObject(payload);
  if (payloadObject && typeof payloadObject.status === 'string' && payloadObject.status.toLowerCase() !== 'success') {
    throw new Error(readProviderMessage(payload, `${displayName} trả về lỗi`));
  }

  return payload as T;
}

async function requestCloneTutBuy(provider: ProviderRecord, input: { productId: string; amount: number; coupon?: string }) {
  const apiUrl = normalizeBaseUrl(String(provider.api_url || ''));
  const apiKey = String(provider.api_key || '').trim();
  const displayName = providerDisplayName();

  if (!apiUrl || !apiKey) {
    throw new Error(`${displayName} chưa có api_url hoặc api_key`);
  }

  const body = new FormData();
  body.set('api_key', apiKey);
  body.set('action', 'buyProduct');
  body.set('id', input.productId);
  body.set('amount', String(Math.max(1, Math.trunc(input.amount || 1))));

  if (input.coupon?.trim()) {
    body.set('coupon', input.coupon.trim());
  }

  const response = await fetch(`${apiUrl}/buy_product`, {
    method: 'POST',
    headers: buildProviderHeaders(provider),
    body,
    cache: 'no-store',
  });

  const text = await response.text();
  const payload = parseProviderJson(provider, text, 'mua hàng', response.status);

  if (!response.ok) {
    throw new Error(readProviderMessage(payload, `${displayName} trả về HTTP ${response.status}`));
  }

  const data = asObject(payload);
  if (!data) {
    throw new Error(`${displayName} không trả về dữ liệu mua hàng hợp lệ`);
  }

  if (String(data.status || '').toLowerCase() !== 'success') {
    throw new Error(readProviderMessage(data, 'Provider từ chối tạo đơn hàng'));
  }

  return data as CloneTutBuyResponse;
}

export async function getMmoProviderProfile(providerId: number) {
  const providers = await getMmoProviders(providerId);
  const provider = providers[0];
  if (!provider) throw new Error('Không tìm thấy MMO provider');

  const payload = await requestCloneTut<CloneTutProfileResponse>(provider, 'profile.php');
  const data = asObject(payload.data);

  return {
    providerId: provider.id,
    providerName: providerDisplayName(),
    username: String(data?.username || ''),
    balance: toNumber(data?.money, 0),
    raw: payload,
  };
}

export async function getMmoProviderProductDetail(providerId: number, productId: string) {
  const providers = await getMmoProviders(providerId);
  const provider = providers[0];
  if (!provider) throw new Error('Không tìm thấy MMO provider');

  const payload = await requestCloneTut<CloneTutProductResponse>(provider, 'product.php', { product: productId });
  const product = asArray<CloneTutProduct>(payload.product)[0];

  if (!product) {
    throw new Error(typeof payload.msg === 'string' && payload.msg.trim() ? payload.msg : 'Không tìm thấy sản phẩm từ provider');
  }

  return {
    providerId: provider.id,
    providerName: providerDisplayName(),
    product,
    raw: payload,
  };
}

export async function getMmoProviderOrderDetail(providerId: number, orderId: string) {
  const providers = await getMmoProviders(providerId);
  const provider = providers[0];
  if (!provider) throw new Error('Không tìm thấy MMO provider');

  const payload = await requestCloneTut<CloneTutOrderResponse>(provider, 'order.php', { order: orderId });
  return {
    providerId: provider.id,
    providerName: providerDisplayName(),
    orderId: String(payload.trans_id || orderId),
    raw: payload,
  };
}

export async function buyMmoProviderProduct(input: {
  providerId: number;
  productId: string;
  amount: number;
  coupon?: string;
}) {
  const providers = await getMmoProviders(input.providerId);
  const provider = providers[0];
  if (!provider) throw new Error('Không tìm thấy MMO provider');

  const payload = await requestCloneTutBuy(provider, {
    productId: input.productId,
    amount: input.amount,
    coupon: input.coupon,
  });
  const payloadObject = payload as Record<string, unknown>;
  const orderId = getProviderOrderId(payloadObject);
  const lines = collectProviderDeliveryLines([
    payloadObject.data,
    payloadObject.content,
    payloadObject.file,
    payloadObject.account,
    payloadObject.accounts,
    payloadObject.result,
  ]);

  if (!orderId) {
    throw new Error(`${providerDisplayName()} tạo đơn thành công nhưng không trả mã đơn`);
  }

  if (lines.length === 0) {
    throw new Error(`${providerDisplayName()} tạo đơn thành công nhưng không trả dữ liệu tài khoản`);
  }

  return {
    providerId: provider.id,
    providerName: providerDisplayName(),
    orderId,
    lines,
    raw: payload,
  };
}

function emptyAutoSyncSummary(reason: GameAccountAutoSyncSummary['reason']): GameAccountAutoSyncSummary {
  return {
    providers: 0,
    categories: 0,
    products: 0,
    disabled_categories: 0,
    disabled_products: 0,
    skipped: true,
    reason,
  };
}

function mergeSyncSummary(total: MmoProviderSyncSummary, next: MmoProviderSyncSummary) {
  total.providers += next.providers;
  total.categories += next.categories;
  total.products += next.products;
  total.disabled_categories += next.disabled_categories;
  total.disabled_products += next.disabled_products;
}

function providerLastSyncTime(provider: ProviderRecord) {
  if (!provider.last_sync) return 0;
  const time = new Date(provider.last_sync).getTime();
  return Number.isFinite(time) ? time : 0;
}

async function countGameAccountApiResources() {
  const rows = await db.$queryRawUnsafe<Array<{ total: number | bigint }>>(
    `
      SELECT COUNT(*) AS total
      FROM mmo_resources r
      LEFT JOIN api_providers ap ON ap.id = CAST(COALESCE(r.api_provider_id, 0) AS UNSIGNED)
      WHERE r.status IN ('active', 'out_of_stock')
        AND COALESCE(r.is_deleted, 0) = 0
        AND ${buildGameAccountProviderSourceWhereSql('all', 'r', 'ap')}
    `
  ).catch(() => [{ total: 0 }]);

  return Number(rows[0]?.total || 0);
}

export async function syncGameAccountResourcesOnUserVisit(input: { force?: boolean } = {}): Promise<GameAccountAutoSyncSummary> {
  if (getGameAccountEnvSeeds().length === 0) {
    return emptyAutoSyncSummary('missing-api-key');
  }

  if (!input.force && gameAccountAutoSyncPromise) {
    return gameAccountAutoSyncPromise;
  }

  const now = Date.now();
  const currentCount = await countGameAccountApiResources();
  if (!input.force && currentCount > 0 && lastGameAccountAutoSyncAt > 0 && now - lastGameAccountAutoSyncAt < GAME_ACCOUNT_AUTO_SYNC_INTERVAL_MS) {
    return emptyAutoSyncSummary('recent');
  }

  const providers = (await getMmoProviders()).filter(isRandom1kProviderLike);
  if (providers.length === 0) {
    return emptyAutoSyncSummary('missing-provider');
  }

  const newestProviderSync = Math.max(...providers.map(providerLastSyncTime), 0);
  if (!input.force && currentCount > 0 && newestProviderSync > 0 && now - newestProviderSync < GAME_ACCOUNT_AUTO_SYNC_INTERVAL_MS) {
    lastGameAccountAutoSyncAt = now;
    return emptyAutoSyncSummary('recent');
  }

  gameAccountAutoSyncPromise = (async () => {
    const summary: GameAccountAutoSyncSummary = {
      providers: 0,
      categories: 0,
      products: 0,
      disabled_categories: 0,
      disabled_products: 0,
    };

    for (const provider of providers) {
      const result = await syncMmoResourcesFromProviders({ providerId: provider.id });
      mergeSyncSummary(summary, result);
    }

    lastGameAccountAutoSyncAt = Date.now();
    return summary;
  })().finally(() => {
    gameAccountAutoSyncPromise = null;
  });

  return gameAccountAutoSyncPromise;
}

export function scheduleGameAccountResourcesSyncOnUserVisit(input: { force?: boolean } = {}): GameAccountAutoSyncSummary {
  if (getGameAccountEnvSeeds().length === 0) {
    return emptyAutoSyncSummary('missing-api-key');
  }

  if (!input.force && gameAccountAutoSyncPromise) {
    return emptyAutoSyncSummary('syncing');
  }

  const now = Date.now();
  if (!input.force && lastGameAccountAutoSyncScheduleAt > 0 && now - lastGameAccountAutoSyncScheduleAt < 30 * 1000) {
    return emptyAutoSyncSummary('recent');
  }

  lastGameAccountAutoSyncScheduleAt = now;
  const timer = setTimeout(() => {
    void syncGameAccountResourcesOnUserVisit(input).catch((error) => {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[mmo-provider] background game account sync failed', error);
      }
    });
  }, GAME_ACCOUNT_BACKGROUND_SYNC_DELAY_MS);
  timer.unref?.();

  return emptyAutoSyncSummary('syncing');
}

export async function syncMmoResourcesFromProviders(input: { providerId?: number } = {}): Promise<MmoProviderSyncSummary> {
  const providers = await getMmoProviders(input.providerId);
  if (providers.length === 0) {
    throw new Error('Không tìm thấy provider MMO đang hoạt động');
  }

  const adminId = await getFallbackAdminId();
  const summary: MmoProviderSyncSummary = {
    providers: 0,
    categories: 0,
    products: 0,
    disabled_categories: 0,
    disabled_products: 0,
  };

  for (const provider of providers) {
    const payload = await requestCloneTut<CloneTutProductsResponse>(provider, 'products.php');
    const categories = asArray<CloneTutCategory>(payload.categories);
    const exchangeRate = Math.max(1, toNumber(provider.exchange_rate, 1));
    const isRandom1kProvider = isRandom1kProviderLike(provider);
    const gameAccountProviderKind = getGameAccountProviderKind(provider);

    const existingCategories = await db.$queryRawUnsafe<ExistingCategoryRow[]>(
      `
        SELECT id, parent_id, name, slug, icon, image, api_category_id
        FROM resource_categories
        WHERE api_provider_id = ?
      `,
      String(provider.id)
    );
    const categoryByRemoteId = new Map<string, ExistingCategoryRow>();
    for (const category of existingCategories) {
      if (category.api_category_id) {
        categoryByRemoteId.set(String(category.api_category_id), category);
      }
    }

    const remoteToLocalCategoryId = new Map<string, number>();
    const sortedCategories = [...categories].sort((left, right) => {
      const leftParent = toNumber(left.parent_id, 0) > 0 ? 1 : 0;
      const rightParent = toNumber(right.parent_id, 0) > 0 ? 1 : 0;
      if (leftParent !== rightParent) return leftParent - rightParent;
      return String(left.name || '').localeCompare(String(right.name || ''));
    });

    let displayOrder = 1;
    const seenCategoryIds = new Set<string>();

    for (const remoteCategory of sortedCategories) {
      const remoteId = String(remoteCategory.id || '').trim();
      if (!remoteId) continue;

      const parentRemoteId = toNumber(remoteCategory.parent_id, 0) > 0 ? String(remoteCategory.parent_id) : null;
      const parentLocalId = parentRemoteId ? remoteToLocalCategoryId.get(parentRemoteId) || null : null;
      const fallbackKey = buildCategoryKey(String(remoteCategory.name || ''), parentRemoteId);
      const existing =
        categoryByRemoteId.get(remoteId) ||
        existingCategories.find((item) => buildCategoryKey(String(item.name || ''), parentRemoteId) === fallbackKey) ||
        null;

      const rawCategoryName = String(remoteCategory.name || `Category ${remoteId}`).trim();
      const categoryName = isRandom1kProvider ? hideProviderBranding(rawCategoryName, `Category ${remoteId}`) : rawCategoryName;
      const slug = existing?.slug || `${slugify(categoryName)}-${provider.id}-${remoteId}`;
      const remoteIcon = normalizeProviderAssetUrl(provider, remoteCategory.icon || '');
      const icon = String(remoteIcon || existing?.icon || 'package');
      const image = String(remoteIcon || existing?.image || '');

      if (existing?.id) {
        await db.$executeRawUnsafe(
          `
            UPDATE resource_categories
            SET parent_id = ?,
                name = ?,
                slug = ?,
                icon = ?,
                image = ?,
                display_order = ?,
                status = 'active',
                api_provider_id = ?,
                api_category_id = ?,
                is_deleted = 0,
                updated_at = NOW()
            WHERE id = ?
          `,
          parentLocalId,
          categoryName,
          slug,
          icon,
          image || null,
          displayOrder,
          String(provider.id),
          remoteId,
          existing.id
        );
        remoteToLocalCategoryId.set(remoteId, Number(existing.id));
      } else {
        await db.$executeRawUnsafe(
          `
            INSERT INTO resource_categories
              (parent_id, name, slug, icon, image, description, display_order, status, is_deleted, created_at, updated_at, api_provider_id, api_category_id)
            VALUES (?, ?, ?, ?, ?, NULL, ?, 'active', 0, NOW(), NOW(), ?, ?)
          `,
          parentLocalId,
          categoryName,
          slug,
          icon,
          image || null,
          displayOrder,
          String(provider.id),
          remoteId
        );
        const inserted = await db.$queryRawUnsafe<Array<{ id: number | bigint }>>('SELECT LAST_INSERT_ID() AS id');
        remoteToLocalCategoryId.set(remoteId, Number(inserted[0]?.id || 0));
      }

      seenCategoryIds.add(remoteId);
      displayOrder += 1;
    }

    if (seenCategoryIds.size > 0) {
      const inactiveCategories = await db.$executeRawUnsafe(
        `
          UPDATE resource_categories
          SET status = 'inactive', updated_at = NOW()
          WHERE api_provider_id = ?
            AND (
              api_category_id IS NULL
              OR api_category_id = ''
              OR api_category_id NOT IN (${Array.from(seenCategoryIds).map(() => '?').join(',')})
            )
        `,
        String(provider.id),
        ...Array.from(seenCategoryIds)
      ).catch(() => 0);
      summary.disabled_categories += Number(inactiveCategories || 0);
    }

    const existingResources = await db.$queryRawUnsafe<ExistingResourceRow[]>(
      `
        SELECT id, product_code, title, description, category, category_id, price, original_price, thumbnail, resource_type, stock, status,
               featured, is_pinned, api_product_id, is_auto, is_auto_margin, margin_percent, custom_badge, display_order, tags
        FROM mmo_resources
        WHERE api_provider_id = ?
      `,
      String(provider.id)
    );
    const resourceByRemoteId = new Map<string, ExistingResourceRow>();
    for (const row of existingResources) {
      if (row.api_product_id) {
        resourceByRemoteId.set(String(row.api_product_id), row);
      }
    }

    const flattenedProducts: Array<{ category: CloneTutCategory; product: CloneTutProduct }> = [];
    for (const category of categories) {
      for (const product of asArray<CloneTutProduct>(category.products)) {
        flattenedProducts.push({ category, product });
      }
    }

    const seenProductIds = new Set<string>();
    let productOrder = 1;

    for (const entry of flattenedProducts) {
      const remoteProductId = String(entry.product.id || '').trim();
      if (!remoteProductId) continue;

      const existing = resourceByRemoteId.get(remoteProductId);
      const categoryId = remoteToLocalCategoryId.get(String(entry.category.id || '')) || existing?.category_id || null;
      const rawTitle = String(entry.product.name || `Product ${remoteProductId}`).trim();
      const rawDescription = String(entry.product.description || '').trim();
      const rawCategoryName = String(entry.category.name || existing?.category || 'Tài nguyên').trim();
      const baseTitle = isRandom1kProvider ? hideProviderBranding(rawTitle, `Product ${remoteProductId}`) : rawTitle;
      const baseDescription = cleanResourceHtml(isRandom1kProvider ? hideProviderBranding(rawDescription) : rawDescription);
      const categoryName = isRandom1kProvider ? hideProviderBranding(rawCategoryName, 'Tài nguyên') : rawCategoryName;
      const providerPrice = normalizeMoney(entry.product.price, exchangeRate);
      const stock = Math.max(0, Math.trunc(toNumber(entry.product.amount, 0)));
      const isAutoMargin = truthy(existing?.is_auto_margin);
      const marginPercent = toNumber(existing?.margin_percent, 0);
      const rulePrice = isRandom1kProvider
        ? calculateGameAccountApiPrice(providerPrice, `${remoteProductId} ${categoryName} ${baseTitle}`)
        : providerPrice;
      const calculatedFinalPrice = isAutoMargin
        ? Math.round(providerPrice * (1 + marginPercent / 100) * 100) / 100
        : isRandom1kProvider
          ? Math.max(rulePrice, toNumber(existing?.price, rulePrice))
          : Math.max(providerPrice, toNumber(existing?.price, providerPrice));
      const finalPrice = clampResourcePrice(calculatedFinalPrice);
      const title = isRandom1kProvider
        ? rewriteGameAccountPriceMentions(baseTitle, { sourcePrice: providerPrice, displayPrice: finalPrice })
        : baseTitle;
      const description = isRandom1kProvider
        ? rewriteGameAccountPriceMentions(baseDescription, { sourcePrice: providerPrice, displayPrice: finalPrice })
        : baseDescription;
      const nextStatus = stock > 0 ? 'active' : 'out_of_stock';
      const remoteThumbnail = normalizeProviderAssetUrl(provider, entry.category.icon || '');
      const thumbnail = String(existing?.thumbnail || remoteThumbnail || '');
      const resourceType = String(existing?.resource_type || (
        isRandom1kProvider ? getRandom1kResourceType(categoryName, baseTitle) : guessResourceType(categoryName, baseTitle)
      ));
      const customBadge = existing?.custom_badge || ((isRandom1kProvider || gameAccountProviderKind) ? 'API tự động' : null);
      const tags = isRandom1kProvider
        ? buildRandom1kTags({ providerName: provider.name, categoryName, productName: baseTitle, resourceType })
        : existing?.tags || [categoryName, provider.name.replace(/\.com$/i, ''), resourceType].filter(Boolean).join(', ');

      if (existing?.id) {
        await db.$executeRawUnsafe(
          `
            UPDATE mmo_resources
            SET title = ?,
                description = ?,
                category = ?,
                category_id = ?,
                price = ?,
                original_price = ?,
                thumbnail = ?,
                resource_type = ?,
                stock = ?,
                status = ?,
                api_provider_id = ?,
                api_product_id = ?,
                is_auto = 1,
                custom_badge = ?,
                display_order = ?,
                tags = ?,
                is_deleted = 0,
                updated_at = NOW()
            WHERE id = ?
          `,
          title,
          description || null,
          categoryName,
          categoryId,
          finalPrice,
          providerPrice,
          thumbnail || null,
          resourceType,
          stock,
          nextStatus,
          String(provider.id),
          remoteProductId,
          customBadge,
          toNumber(existing.display_order, productOrder),
          tags || null,
          existing.id
        );
      } else {
        await db.$executeRawUnsafe(
          `
            INSERT INTO mmo_resources
              (product_code, title, description, category, category_id, price, original_price, thumbnail, resource_type, stock, sold_count, download_url, content, product_content, product_note, tags, status, featured, is_pinned, created_by, created_at, updated_at, api_provider_id, api_product_id, is_auto, is_auto_margin, margin_percent, custom_badge, display_order, is_deleted)
            VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, NULL, ?, ?, ?, 0, 0, ?, NOW(), NOW(), ?, ?, 1, 0, 0, NULL, ?, 0)
          `,
          title,
          description || null,
          categoryName,
          categoryId,
          finalPrice,
          providerPrice,
          thumbnail || null,
          resourceType,
          stock,
          description || null,
          tags || null,
          nextStatus,
          adminId,
          String(provider.id),
          remoteProductId,
          productOrder
        );
        const inserted = await db.$queryRawUnsafe<Array<{ id: number | bigint }>>('SELECT LAST_INSERT_ID() AS id');
        const insertedId = Number(inserted[0]?.id || 0);
        if (insertedId > 0) {
          await db.$executeRawUnsafe(
            'UPDATE mmo_resources SET product_code = ? WHERE id = ?',
            buildProductCode(insertedId),
            insertedId
          );
        }
      }

      seenProductIds.add(remoteProductId);
      productOrder += 1;
    }

    if (seenProductIds.size > 0) {
      const inactiveProducts = await db.$executeRawUnsafe(
        `
          UPDATE mmo_resources
          SET status = 'inactive',
              stock = 0,
              updated_at = NOW()
          WHERE api_provider_id = ?
            AND api_product_id IS NOT NULL
            AND api_product_id NOT IN (${Array.from(seenProductIds).map(() => '?').join(',')})
        `,
        String(provider.id),
        ...Array.from(seenProductIds)
      ).catch(() => 0);
      summary.disabled_products += Number(inactiveProducts || 0);
    }

    await db.api_providers.update({
      where: { id: provider.id },
      data: {
        last_sync: new Date(),
        health_status: 'online',
      },
    }).catch(() => undefined);

    summary.providers += 1;
    summary.categories += seenCategoryIds.size;
    summary.products += seenProductIds.size;
  }

  return summary;
}
