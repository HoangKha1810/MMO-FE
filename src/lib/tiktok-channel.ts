import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { getVietnamDatabaseDateTime, serializeDatabaseDateTime } from '@/lib/date-time';
import { getLegacySettingsMap, invalidateLegacySettingsCache } from '@/lib/legacy-settings';
import { toNumber } from '@/lib/utils';

const DEFAULT_KENHGIARE_API_BASE_URL = 'https://kenhgiare.vn/api/partner/v1';
const DEFAULT_MARGIN_PERCENT = 80;
const DEFAULT_SYNC_PAGE_LIMIT = 100;
const MAX_SYNC_PAGES = 30;

export const KENHGIARE_SETTING_KEYS = [
  'kenhgiare_api_key',
  'kenhgiare_api_base_url',
  'kenhgiare_default_margin_percent',
] as const;

type KenhGiaReEnvelope<T> = {
  success?: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
  };
  message?: string;
};

type KenhGiaReProduct = {
  id?: string | number;
  slug?: string;
  title?: string;
  description?: string | null;
  niche?: string | null;
  followerCount?: number | string | null;
  likeCount?: number | string | null;
  listedPrice?: number | string | null;
  price?: number | string | null;
  discountPercent?: number | string | null;
  maskedUsername?: string | null;
  thumbnailUrl?: string | null;
  photos?: unknown;
  status?: string | null;
  shopStatus?: string | null;
  liveStatus?: string | null;
  hasCredentials?: boolean | number | string | null;
  createdAt?: string | null;
};

type KenhGiaReProductsResponse = {
  products?: KenhGiaReProduct[];
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
};

type KenhGiaReProductResponse = {
  product?: KenhGiaReProduct;
};

type KenhGiaReOrderCredentials = {
  username?: string | null;
  password?: string | null;
  email?: string | null;
  emailPassword?: string | null;
  twoFactor?: string | null;
  note?: string | null;
};

type KenhGiaReOrder = {
  id?: string | number;
  productId?: string | number;
  productTitle?: string;
  amount?: number | string;
  createdAt?: string;
  credentials?: KenhGiaReOrderCredentials | null;
};

type KenhGiaReCreateOrderResponse = {
  order?: KenhGiaReOrder;
  balance?: number | string;
  replayed?: boolean;
};

export type TikTokChannelProductRow = {
  id: number;
  provider_product_id: string;
  slug: string | null;
  title: string;
  description: string | null;
  niche: string | null;
  follower_count: number;
  like_count: number;
  listed_price_vnd: number;
  api_price_vnd: number;
  sale_price_vnd: number;
  margin_percent: number;
  is_auto_price: boolean;
  discount_percent: number;
  masked_username: string | null;
  thumbnail_url: string | null;
  photos_json: string | null;
  provider_status: string | null;
  shop_status: string | null;
  live_status: string | null;
  has_credentials: boolean;
  status: string;
  synced_at?: string | Date | null;
  created_at?: string | Date | null;
  updated_at?: string | Date | null;
};

export type PublicTikTokChannelProduct = Omit<TikTokChannelProductRow, 'api_price_vnd' | 'photos_json'> & {
  photos: string[];
};

export type TikTokChannelOrderRow = {
  id: number;
  order_code: string;
  user_id: number;
  username?: string | null;
  product_id: number;
  provider_product_id: string;
  provider_order_id: string | null;
  product_title: string;
  niche: string | null;
  follower_count: number;
  api_price_vnd: number;
  sale_price_vnd: number;
  provider_amount_vnd: number;
  profit_vnd: number;
  status: string;
  credentials_json: string | null;
  api_response_json?: string | null;
  admin_note: string | null;
  created_at?: string | Date | null;
  updated_at?: string | Date | null;
};

class KenhGiaReApiError extends Error {
  code: string;
  status: number;
  payload: unknown;

  constructor(message: string, code = 'KGR_ERROR', status = 500, payload?: unknown) {
    super(message);
    this.name = 'KenhGiaReApiError';
    this.code = code;
    this.status = status;
    this.payload = payload;
  }
}

let ensurePromise: Promise<void> | null = null;

async function ensureTableColumn(table: string, column: string, definition: string, afterColumn?: string) {
  const rows = await db.$queryRawUnsafe<Array<{ total: number | bigint }>>(
    `
      SELECT COUNT(*) AS total
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
    `,
    table,
    column
  );
  if (Number(rows[0]?.total || 0) > 0) return;

  const afterSql = afterColumn ? ` AFTER \`${afterColumn}\`` : '';
  await db.$executeRawUnsafe(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}${afterSql}`);
}

function normalizeBoolean(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'on', 'active'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off', 'inactive'].includes(normalized)) return false;
  return Boolean(value);
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== 'string') return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function parseJsonStringArray(value: unknown): string[] {
  if (!value) return [];
  const raw = Array.isArray(value) ? value : (() => {
    if (typeof value !== 'string') return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  return raw.map((item) => String(item || '').trim()).filter(Boolean);
}

function jsonStringify(value: unknown) {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return 'null';
  }
}

function normalizeMoney(value: unknown) {
  return Math.max(0, Math.round(toNumber(value, 0)));
}

function normalizeMarginPercent(value: unknown, fallback = DEFAULT_MARGIN_PERCENT) {
  const parsed = toNumber(value, fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(500, Math.max(0, parsed));
}

function calculateSalePrice(apiPrice: number, marginPercent: number) {
  return Math.max(0, Math.round(apiPrice * (1 + marginPercent / 100)));
}

function isApiProductAvailable(product: KenhGiaReProduct) {
  const statusText = [product.status, product.shopStatus, product.liveStatus]
    .map((item) => String(item || '').toLowerCase())
    .join(' ');

  if (/sold|unavailable|hidden|inactive|deleted|disabled|blocked/.test(statusText)) {
    return false;
  }

  return normalizeBoolean(product.hasCredentials);
}

function normalizeApiProduct(product: KenhGiaReProduct, defaultMarginPercent: number) {
  const providerProductId = String(product.id ?? '').trim();
  const apiPrice = normalizeMoney(product.price ?? product.listedPrice);
  const marginPercent = normalizeMarginPercent(defaultMarginPercent, DEFAULT_MARGIN_PERCENT);

  return {
    providerProductId,
    slug: product.slug ? String(product.slug) : null,
    title: String(product.title || providerProductId || 'Kênh TikTok'),
    description: product.description == null ? null : String(product.description),
    niche: product.niche == null ? null : String(product.niche),
    followerCount: Math.max(0, Math.trunc(toNumber(product.followerCount, 0))),
    likeCount: Math.max(0, Math.trunc(toNumber(product.likeCount, 0))),
    listedPrice: normalizeMoney(product.listedPrice ?? product.price),
    apiPrice,
    salePrice: calculateSalePrice(apiPrice, marginPercent),
    marginPercent,
    discountPercent: normalizeMarginPercent(product.discountPercent, 0),
    maskedUsername: product.maskedUsername == null ? null : String(product.maskedUsername),
    thumbnailUrl: product.thumbnailUrl == null ? null : String(product.thumbnailUrl),
    photosJson: jsonStringify(Array.isArray(product.photos) ? product.photos : []),
    providerStatus: product.status == null ? null : String(product.status),
    shopStatus: product.shopStatus == null ? null : String(product.shopStatus),
    liveStatus: product.liveStatus == null ? null : String(product.liveStatus),
    hasCredentials: isApiProductAvailable(product),
    providerData: jsonStringify(product),
  };
}

function normalizeProductRow(row: Record<string, unknown>): TikTokChannelProductRow {
  return {
    id: Math.trunc(toNumber(row.id, 0)),
    provider_product_id: String(row.provider_product_id || ''),
    slug: row.slug == null ? null : String(row.slug),
    title: String(row.title || ''),
    description: row.description == null ? null : String(row.description),
    niche: row.niche == null ? null : String(row.niche),
    follower_count: Math.trunc(toNumber(row.follower_count, 0)),
    like_count: Math.trunc(toNumber(row.like_count, 0)),
    listed_price_vnd: normalizeMoney(row.listed_price_vnd),
    api_price_vnd: normalizeMoney(row.api_price_vnd),
    sale_price_vnd: normalizeMoney(row.sale_price_vnd),
    margin_percent: normalizeMarginPercent(row.margin_percent, DEFAULT_MARGIN_PERCENT),
    is_auto_price: normalizeBoolean(row.is_auto_price),
    discount_percent: normalizeMarginPercent(row.discount_percent, 0),
    masked_username: row.masked_username == null ? null : String(row.masked_username),
    thumbnail_url: row.thumbnail_url == null ? null : String(row.thumbnail_url),
    photos_json: row.photos_json == null ? null : String(row.photos_json),
    provider_status: row.provider_status == null ? null : String(row.provider_status),
    shop_status: row.shop_status == null ? null : String(row.shop_status),
    live_status: row.live_status == null ? null : String(row.live_status),
    has_credentials: normalizeBoolean(row.has_credentials),
    status: String(row.status || 'active'),
    synced_at: row.synced_at as string | Date | null | undefined,
    created_at: row.created_at as string | Date | null | undefined,
    updated_at: row.updated_at as string | Date | null | undefined,
  };
}

function toPublicProduct(row: TikTokChannelProductRow): PublicTikTokChannelProduct {
  const { api_price_vnd: _apiPrice, photos_json: photosJson, ...publicRow } = row;
  return {
    ...publicRow,
    photos: parseJsonStringArray(photosJson),
  };
}

function normalizeOrderRow(row: Record<string, unknown>) {
  return {
    id: Math.trunc(toNumber(row.id, 0)),
    order_code: String(row.order_code || ''),
    user_id: Math.trunc(toNumber(row.user_id, 0)),
    username: row.username == null ? null : String(row.username),
    product_id: Math.trunc(toNumber(row.product_id, 0)),
    provider_product_id: String(row.provider_product_id || ''),
    provider_order_id: row.provider_order_id == null ? null : String(row.provider_order_id),
    product_title: String(row.product_title || ''),
    niche: row.niche == null ? null : String(row.niche),
    follower_count: Math.trunc(toNumber(row.follower_count, 0)),
    api_price_vnd: normalizeMoney(row.api_price_vnd),
    sale_price_vnd: normalizeMoney(row.sale_price_vnd),
    provider_amount_vnd: normalizeMoney(row.provider_amount_vnd),
    profit_vnd: Math.round(toNumber(row.profit_vnd, 0)),
    status: String(row.status || 'pending'),
    credentials_json: row.credentials_json == null ? null : String(row.credentials_json),
    credentials: parseJsonObject(row.credentials_json),
    api_response_json: row.api_response_json == null ? null : String(row.api_response_json),
    admin_note: row.admin_note == null ? null : String(row.admin_note),
    created_at: row.created_at == null ? null : serializeDatabaseDateTime(row.created_at),
    updated_at: row.updated_at == null ? null : serializeDatabaseDateTime(row.updated_at),
  };
}

function generateOrderCode() {
  const time = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `KT-${time}-${random}`;
}

async function ensureKenhGiaReSettings() {
  const defaults: Record<string, string> = {
    kenhgiare_api_key: '',
    kenhgiare_api_base_url: DEFAULT_KENHGIARE_API_BASE_URL,
    kenhgiare_default_margin_percent: String(DEFAULT_MARGIN_PERCENT),
  };

  for (const key of KENHGIARE_SETTING_KEYS) {
    const rows = await db.$queryRawUnsafe<Array<{ id: number }>>(
      'SELECT id FROM `settings` WHERE `setting_key` = ? LIMIT 1',
      key
    );
    if (rows.length === 0) {
      await db.$executeRawUnsafe(
        'INSERT INTO `settings` (`setting_key`, `setting_value`, `updated_at`) VALUES (?, ?, NOW())',
        key,
        defaults[key]
      );
    }
  }

  await db.$executeRawUnsafe(
    `
      UPDATE settings
      SET setting_value = ?, updated_at = NOW()
      WHERE setting_key = 'kenhgiare_default_margin_percent'
        AND (setting_value IS NULL OR setting_value = '' OR setting_value = '20')
    `,
    String(DEFAULT_MARGIN_PERCENT)
  );
}

export async function ensureTikTokChannelTables() {
  ensurePromise ||= (async () => {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS tiktok_channel_products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        provider_product_id VARCHAR(120) NOT NULL,
        slug VARCHAR(191) NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NULL,
        niche VARCHAR(120) NULL,
        follower_count INT NOT NULL DEFAULT 0,
        like_count INT NOT NULL DEFAULT 0,
        listed_price_vnd DECIMAL(15, 2) NOT NULL DEFAULT 0,
        api_price_vnd DECIMAL(15, 2) NOT NULL DEFAULT 0,
        sale_price_vnd DECIMAL(15, 2) NOT NULL DEFAULT 0,
        margin_percent DECIMAL(8, 2) NOT NULL DEFAULT 80,
        is_auto_price TINYINT(1) NOT NULL DEFAULT 1,
        discount_percent DECIMAL(8, 2) NOT NULL DEFAULT 0,
        masked_username VARCHAR(191) NULL,
        thumbnail_url TEXT NULL,
        photos_json TEXT NULL,
        provider_status VARCHAR(80) NULL,
        shop_status VARCHAR(80) NULL,
        live_status VARCHAR(80) NULL,
        has_credentials TINYINT(1) NOT NULL DEFAULT 0,
        provider_data LONGTEXT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'active',
        synced_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_tiktok_channel_product (provider_product_id),
        INDEX idx_tiktok_channel_products_status (status),
        INDEX idx_tiktok_channel_products_niche (niche),
        INDEX idx_tiktok_channel_products_price (sale_price_vnd),
        INDEX idx_tiktok_channel_products_sync (synced_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS tiktok_channel_orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_code VARCHAR(64) NOT NULL UNIQUE,
        user_id INT NOT NULL,
        product_id INT NOT NULL,
        provider_product_id VARCHAR(120) NOT NULL,
        provider_order_id VARCHAR(120) NULL,
        product_title VARCHAR(255) NOT NULL,
        niche VARCHAR(120) NULL,
        follower_count INT NOT NULL DEFAULT 0,
        api_price_vnd DECIMAL(15, 2) NOT NULL DEFAULT 0,
        sale_price_vnd DECIMAL(15, 2) NOT NULL DEFAULT 0,
        provider_amount_vnd DECIMAL(15, 2) NOT NULL DEFAULT 0,
        profit_vnd DECIMAL(15, 2) NOT NULL DEFAULT 0,
        status VARCHAR(32) NOT NULL DEFAULT 'pending',
        credentials_json LONGTEXT NULL,
        api_response_json LONGTEXT NULL,
        admin_note TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_tiktok_channel_orders_user (user_id),
        INDEX idx_tiktok_channel_orders_product (product_id),
        INDEX idx_tiktok_channel_orders_status (status),
        INDEX idx_tiktok_channel_orders_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await ensureTableColumn('tiktok_channel_products', 'provider_status', 'VARCHAR(80) NULL', 'photos_json');
    await ensureTableColumn('tiktok_channel_products', 'shop_status', 'VARCHAR(80) NULL', 'provider_status');
    await ensureTableColumn('tiktok_channel_products', 'live_status', 'VARCHAR(80) NULL', 'shop_status');

    await ensureKenhGiaReSettings();
  })();

  return ensurePromise;
}

export async function getKenhGiaReConfig() {
  await ensureTikTokChannelTables();
  const settings = await getLegacySettingsMap(true);
  const apiKey = String(process.env.KENHGIARE_API_KEY || settings.kenhgiare_api_key || '').trim();
  const baseUrl = String(
    process.env.KENHGIARE_API_BASE_URL ||
      settings.kenhgiare_api_base_url ||
      DEFAULT_KENHGIARE_API_BASE_URL
  ).trim().replace(/\/+$/, '');
  const configuredMargin = String(settings.kenhgiare_default_margin_percent ?? '').trim();
  const envMargin = String(process.env.KENHGIARE_DEFAULT_MARGIN_PERCENT ?? '').trim();
  const defaultMarginPercent = normalizeMarginPercent(
    configuredMargin || envMargin,
    DEFAULT_MARGIN_PERCENT
  );

  return {
    apiKey,
    baseUrl: baseUrl || DEFAULT_KENHGIARE_API_BASE_URL,
    defaultMarginPercent,
  };
}

async function kenhGiaReFetch<T>(
  path: string,
  options: RequestInit = {},
  config?: Awaited<ReturnType<typeof getKenhGiaReConfig>>
) {
  const effectiveConfig = config || await getKenhGiaReConfig();
  if (!effectiveConfig.apiKey) {
    throw new Error('Thiếu KENHGIARE_API_KEY hoặc setting kenhgiare_api_key trong admin.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const response = await fetch(`${effectiveConfig.baseUrl}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${effectiveConfig.apiKey}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
      cache: 'no-store',
    });

    const text = await response.text();
    let payload: KenhGiaReEnvelope<T> = {};
    if (text) {
      try {
        payload = JSON.parse(text) as KenhGiaReEnvelope<T>;
      } catch {
        throw new KenhGiaReApiError('Kênh Giá Rẻ trả về dữ liệu không phải JSON', 'INVALID_JSON', response.status, text);
      }
    }

    if (!response.ok || payload.success === false) {
      const message = payload.error?.message || payload.message || `Kênh Giá Rẻ lỗi HTTP ${response.status}`;
      throw new KenhGiaReApiError(message, payload.error?.code || 'KGR_HTTP_ERROR', response.status, payload);
    }

    return (payload.data ?? payload) as T;
  } catch (error) {
    if (error instanceof KenhGiaReApiError) {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new KenhGiaReApiError('Kết nối Kênh Giá Rẻ quá thời gian chờ', 'TIMEOUT', 408);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function upsertKenhGiaReProduct(
  product: KenhGiaReProduct,
  config: Awaited<ReturnType<typeof getKenhGiaReConfig>>
) {
  const normalized = normalizeApiProduct(product, config.defaultMarginPercent);
  if (!normalized.providerProductId) {
    return { skipped: true };
  }

  const syncedAt = getVietnamDatabaseDateTime();
  const nextStatus = normalized.hasCredentials ? 'active' : 'unavailable';

  await db.$executeRawUnsafe(
    `
      INSERT INTO tiktok_channel_products
        (provider_product_id, slug, title, description, niche, follower_count, like_count,
         listed_price_vnd, api_price_vnd, sale_price_vnd, margin_percent, is_auto_price,
         discount_percent, masked_username, thumbnail_url, photos_json, provider_status,
         shop_status, live_status, has_credentials, provider_data, status, synced_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        slug = VALUES(slug),
        title = VALUES(title),
        description = VALUES(description),
        niche = VALUES(niche),
        follower_count = VALUES(follower_count),
        like_count = VALUES(like_count),
        listed_price_vnd = VALUES(listed_price_vnd),
        api_price_vnd = VALUES(api_price_vnd),
        sale_price_vnd = CASE
          WHEN COALESCE(is_auto_price, 1) = 1 OR COALESCE(sale_price_vnd, 0) <= 0
            THEN ROUND(VALUES(api_price_vnd) * (1 + (VALUES(margin_percent) / 100)), 0)
          ELSE sale_price_vnd
        END,
        margin_percent = CASE
          WHEN COALESCE(is_auto_price, 1) = 1 OR COALESCE(margin_percent, 0) <= 0 THEN VALUES(margin_percent)
          ELSE margin_percent
        END,
        discount_percent = VALUES(discount_percent),
        masked_username = VALUES(masked_username),
        thumbnail_url = VALUES(thumbnail_url),
        photos_json = VALUES(photos_json),
        provider_status = VALUES(provider_status),
        shop_status = VALUES(shop_status),
        live_status = VALUES(live_status),
        has_credentials = VALUES(has_credentials),
        provider_data = VALUES(provider_data),
        status = CASE
          WHEN COALESCE(status, 'active') IN ('inactive', 'sold') THEN status
          WHEN VALUES(has_credentials) = 1 THEN 'active'
          ELSE 'unavailable'
        END,
        synced_at = VALUES(synced_at)
    `,
    normalized.providerProductId,
    normalized.slug,
    normalized.title,
    normalized.description,
    normalized.niche,
    normalized.followerCount,
    normalized.likeCount,
    normalized.listedPrice,
    normalized.apiPrice,
    normalized.salePrice,
    normalized.marginPercent,
    normalized.discountPercent,
    normalized.maskedUsername,
    normalized.thumbnailUrl,
    normalized.photosJson,
    normalized.providerStatus,
    normalized.shopStatus,
    normalized.liveStatus,
    normalized.hasCredentials ? 1 : 0,
    normalized.providerData,
    nextStatus,
    syncedAt
  );

  return { skipped: false };
}

async function fetchKenhGiaReProduct(providerProductId: string, config: Awaited<ReturnType<typeof getKenhGiaReConfig>>) {
  const data = await kenhGiaReFetch<KenhGiaReProductResponse | KenhGiaReProduct>(
    `/products/${encodeURIComponent(providerProductId)}`,
    {},
    config
  );
  return ('product' in data && data.product ? data.product : data) as KenhGiaReProduct;
}

async function createKenhGiaReOrder(providerProductId: string, config: Awaited<ReturnType<typeof getKenhGiaReConfig>>) {
  return kenhGiaReFetch<KenhGiaReCreateOrderResponse>(
    '/orders',
    {
      method: 'POST',
      body: JSON.stringify({ productId: providerProductId }),
    },
    config
  );
}

export async function syncKenhGiaReProducts(options: { maxPages?: number } = {}) {
  await ensureTikTokChannelTables();
  const config = await getKenhGiaReConfig();
  const maxPages = Math.min(MAX_SYNC_PAGES, Math.max(1, Math.trunc(toNumber(options.maxPages, MAX_SYNC_PAGES))));
  const syncStartedAt = getVietnamDatabaseDateTime();
  let fetched = 0;
  let upserted = 0;
  let pages = 0;
  const seenProviderIds: string[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(DEFAULT_SYNC_PAGE_LIMIT),
    });
    const data = await kenhGiaReFetch<KenhGiaReProductsResponse>(`/products?${params.toString()}`, {}, config);
    const products = Array.isArray(data.products) ? data.products : [];
    pages = page;
    fetched += products.length;

    for (const product of products) {
      const providerId = String(product.id ?? '').trim();
      if (providerId) seenProviderIds.push(providerId);
      const result = await upsertKenhGiaReProduct(product, config);
      if (!result.skipped) upserted += 1;
    }

    const totalPages = Math.max(1, Math.trunc(toNumber(data.pagination?.totalPages, 1)));
    if (products.length < DEFAULT_SYNC_PAGE_LIMIT || page >= totalPages) {
      break;
    }
  }

  if (seenProviderIds.length > 0) {
    await db.$executeRawUnsafe(
      `
        UPDATE tiktok_channel_products
        SET status = CASE WHEN status = 'sold' THEN status ELSE 'unavailable' END,
            provider_status = CASE WHEN provider_status IS NULL THEN 'missing_from_sync' ELSE provider_status END
        WHERE (synced_at IS NULL OR synced_at < ?)
          AND status NOT IN ('inactive', 'sold')
      `,
      syncStartedAt
    );
  }

  const repriced = await db.$executeRawUnsafe(
    `
      UPDATE tiktok_channel_products
      SET margin_percent = ?,
          sale_price_vnd = ROUND(COALESCE(api_price_vnd, 0) * (1 + (? / 100)), 0),
          updated_at = NOW()
      WHERE COALESCE(is_auto_price, 1) = 1
        AND status <> 'sold'
    `,
    config.defaultMarginPercent,
    config.defaultMarginPercent
  );

  return {
    fetched,
    upserted,
    repriced: Number(repriced || 0),
    pages,
    synced_at: syncStartedAt,
    keep_manual_web_price: true,
    auto_margin_percent: config.defaultMarginPercent,
  };
}

export async function syncKenhGiaReProductsIfStale(options: {
  intervalHours?: number;
  maxPages?: number;
  force?: boolean;
} = {}) {
  await ensureTikTokChannelTables();
  const intervalHours = Math.max(1, Math.trunc(toNumber(options.intervalHours, 24)));
  const staleAfterSeconds = intervalHours * 60 * 60;
  const [state] = await db.$queryRawUnsafe<Array<{
    total: number | bigint;
    active_total: number | bigint | null;
    last_synced_at: Date | string | null;
    age_seconds: number | bigint | null;
  }>>(
    `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_total,
        MAX(synced_at) AS last_synced_at,
        TIMESTAMPDIFF(SECOND, MAX(synced_at), NOW()) AS age_seconds
      FROM tiktok_channel_products
    `
  );

  const total = Math.trunc(toNumber(state?.total, 0));
  const activeTotal = Math.trunc(toNumber(state?.active_total, 0));
  const ageSeconds = state?.age_seconds == null ? Number.POSITIVE_INFINITY : toNumber(state.age_seconds, Number.POSITIVE_INFINITY);
  const lastSyncedAt = state?.last_synced_at ? serializeDatabaseDateTime(state.last_synced_at) : null;
  const shouldSync = Boolean(options.force) || total === 0 || activeTotal === 0 || ageSeconds >= staleAfterSeconds;

  if (!shouldSync) {
    return {
      synced: false,
      skipped: true,
      reason: `Dữ liệu Kênh TikTok chưa quá ${intervalHours}h`,
      total,
      active_total: activeTotal,
      last_synced_at: lastSyncedAt,
      next_sync_after_seconds: Math.max(0, staleAfterSeconds - Math.max(0, ageSeconds)),
    };
  }

  const result = await syncKenhGiaReProducts({ maxPages: options.maxPages });
  return {
    synced: true,
    skipped: false,
    reason: options.force ? 'Force refresh Kênh TikTok' : `Auto refresh vì dữ liệu quá ${intervalHours}h hoặc chưa có kênh active`,
    previous_total: total,
    previous_active_total: activeTotal,
    previous_last_synced_at: lastSyncedAt,
    ...result,
  };
}

export async function listTikTokChannelProducts(params: {
  page?: number;
  perPage?: number;
  search?: string;
  niche?: string;
  minFollowers?: number;
  maxFollowers?: number;
} = {}) {
  await ensureTikTokChannelTables();

  await syncKenhGiaReProductsIfStale({ intervalHours: 24, maxPages: 3 }).catch(() => undefined);

  const page = Math.max(1, Math.trunc(toNumber(params.page, 1)));
  const perPage = Math.min(48, Math.max(8, Math.trunc(toNumber(params.perPage, 16))));
  const skip = (page - 1) * perPage;
  const values: unknown[] = [];
  const conditions = ["status = 'active'", 'has_credentials = 1'];
  const search = String(params.search || '').trim();
  const niche = String(params.niche || '').trim();
  const minFollowers = Math.max(0, Math.trunc(toNumber(params.minFollowers, 0)));
  const maxFollowers = Math.max(0, Math.trunc(toNumber(params.maxFollowers, 0)));

  if (search) {
    conditions.push('(title LIKE ? OR COALESCE(niche, \'\') LIKE ? OR COALESCE(masked_username, \'\') LIKE ?)');
    values.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (niche) {
    conditions.push('COALESCE(niche, \'\') = ?');
    values.push(niche);
  }

  if (minFollowers > 0) {
    conditions.push('follower_count >= ?');
    values.push(minFollowers);
  }

  if (maxFollowers > 0) {
    conditions.push('follower_count <= ?');
    values.push(maxFollowers);
  }

  const whereSql = `WHERE ${conditions.join(' AND ')}`;
  const [rows, countRows, nicheRows] = await Promise.all([
    db.$queryRawUnsafe<Record<string, unknown>[]>(
      `
        SELECT *
        FROM tiktok_channel_products
        ${whereSql}
        ORDER BY follower_count DESC, sale_price_vnd ASC, id DESC
        LIMIT ? OFFSET ?
      `,
      ...values,
      perPage,
      skip
    ),
    db.$queryRawUnsafe<Array<{ total: number | bigint }>>(
      `SELECT COUNT(*) AS total FROM tiktok_channel_products ${whereSql}`,
      ...values
    ),
    db.$queryRawUnsafe<Array<{ niche: string | null; total: number | bigint }>>(
      `
        SELECT niche, COUNT(*) AS total
        FROM tiktok_channel_products
        WHERE status = 'active' AND has_credentials = 1 AND COALESCE(niche, '') <> ''
        GROUP BY niche
        ORDER BY total DESC, niche ASC
        LIMIT 60
      `
    ),
  ]);

  const total = Number(countRows[0]?.total || 0);
  return {
    data: rows.map((row) => toPublicProduct(normalizeProductRow(row))),
    meta: {
      niches: nicheRows.map((row) => ({
        value: String(row.niche || ''),
        label: String(row.niche || ''),
        total: Number(row.total || 0),
      })),
    },
    pagination: {
      page,
      per_page: perPage,
      total,
      total_pages: Math.max(1, Math.ceil(total / perPage)),
    },
  };
}

export async function listUserTikTokChannelOrders(userId: number) {
  await ensureTikTokChannelTables();
  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
    `
      SELECT o.*
      FROM tiktok_channel_orders o
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC, o.id DESC
      LIMIT 40
    `,
    userId
  );

  return rows.map(normalizeOrderRow);
}

export async function listAdminTikTokChannelOrders(params: URLSearchParams, page: number, perPage: number, skip: number) {
  await ensureTikTokChannelTables();
  const search = (params.get('search') || '').trim();
  const status = (params.get('status') || '').trim();
  const values: unknown[] = [];
  const conditions: string[] = [];

  if (search) {
    conditions.push('(o.order_code LIKE ? OR o.product_title LIKE ? OR o.provider_product_id LIKE ? OR COALESCE(u.username, \'\') LIKE ?)');
    values.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (status) {
    conditions.push('o.status = ?');
    values.push(status);
  }

  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const fromSql = `
    FROM tiktok_channel_orders o
    LEFT JOIN users u ON u.id = o.user_id
    ${whereSql}
  `;

  const [rows, countRows] = await Promise.all([
    db.$queryRawUnsafe<Record<string, unknown>[]>(
      `
        SELECT o.*, u.username
        ${fromSql}
        ORDER BY o.created_at DESC, o.id DESC
        LIMIT ? OFFSET ?
      `,
      ...values,
      perPage,
      skip
    ),
    db.$queryRawUnsafe<Array<{ total: number | bigint }>>(
      `SELECT COUNT(*) AS total ${fromSql}`,
      ...values
    ),
  ]);

  const total = Number(countRows[0]?.total || 0);
  return {
    success: true,
    title: 'Đơn Kênh TikTok',
    data: rows.map(normalizeOrderRow),
    pagination: {
      page,
      per_page: perPage,
      total,
      total_pages: Math.max(1, Math.ceil(total / perPage)),
    },
    readonly: false,
    create_fields: [],
    update_fields: ['status', 'admin_note', 'sale_price_vnd'],
  };
}

export async function listKenhGiaReSettings(params: URLSearchParams, page: number, perPage: number, skip: number) {
  await ensureTikTokChannelTables();
  const search = (params.get('search') || '').trim();
  const placeholders = KENHGIARE_SETTING_KEYS.map(() => '?').join(', ');
  const values: unknown[] = [...KENHGIARE_SETTING_KEYS];
  const conditions = [`setting_key IN (${placeholders})`];

  if (search) {
    conditions.push('(setting_key LIKE ? OR COALESCE(setting_value, \'\') LIKE ?)');
    values.push(`%${search}%`, `%${search}%`);
  }

  const whereSql = `WHERE ${conditions.join(' AND ')}`;
  const [rows, countRows] = await Promise.all([
    db.$queryRawUnsafe<Record<string, unknown>[]>(
      `
        SELECT id, setting_key, setting_value, updated_at
        FROM settings
        ${whereSql}
        ORDER BY FIELD(setting_key, ${placeholders}), id ASC
        LIMIT ? OFFSET ?
      `,
      ...values,
      ...KENHGIARE_SETTING_KEYS,
      perPage,
      skip
    ),
    db.$queryRawUnsafe<Array<{ total: number | bigint }>>(
      `SELECT COUNT(*) AS total FROM settings ${whereSql}`,
      ...values
    ),
  ]);

  const total = Number(countRows[0]?.total || 0);
  return {
    success: true,
    title: 'Cấu hình Kênh Giá Rẻ',
    data: rows.map((row) => ({
      ...row,
      id: Math.trunc(toNumber(row.id, 0)),
      updated_at: row.updated_at == null ? null : serializeDatabaseDateTime(row.updated_at),
    })),
    pagination: {
      page,
      per_page: perPage,
      total,
      total_pages: Math.max(1, Math.ceil(total / perPage)),
    },
    readonly: false,
    create_fields: ['setting_key', 'setting_value'],
    update_fields: ['setting_value'],
  };
}

async function getProductForCheckout(productId: number) {
  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
    `
      SELECT *
      FROM tiktok_channel_products
      WHERE id = ?
      LIMIT 1
    `,
    productId
  );
  return rows[0] ? normalizeProductRow(rows[0]) : null;
}

async function refreshProductBeforeCheckout(product: TikTokChannelProductRow, config: Awaited<ReturnType<typeof getKenhGiaReConfig>>) {
  const liveProduct = await fetchKenhGiaReProduct(product.provider_product_id, config);
  if (!isApiProductAvailable(liveProduct)) {
    await upsertKenhGiaReProduct(liveProduct, config).catch(() => undefined);
    throw new Error('Kênh này hiện không còn khả dụng trên Kênh Giá Rẻ.');
  }

  await upsertKenhGiaReProduct(liveProduct, config);
}

async function reserveTikTokChannelOrder(userId: number, productId: number) {
  const createdAt = getVietnamDatabaseDateTime();

  return db.$transaction(async (tx) => {
    const productRows = await tx.$queryRawUnsafe<Record<string, unknown>[]>(
      `
        SELECT *
        FROM tiktok_channel_products
        WHERE id = ? AND status = 'active' AND has_credentials = 1
        LIMIT 1
        FOR UPDATE
      `,
      productId
    );
    const product = productRows[0] ? normalizeProductRow(productRows[0]) : null;
    if (!product) {
      throw new Error('Kênh TikTok không tồn tại hoặc đã hết hàng.');
    }

    const salePrice = normalizeMoney(product.sale_price_vnd);
    if (salePrice <= 0) {
      throw new Error('Kênh TikTok chưa có giá bán hợp lệ.');
    }

    const updatedUser = await tx.$executeRawUnsafe(
      `
        UPDATE users
        SET balance = balance - ?, last_activity = ?
        WHERE id = ? AND balance >= ?
      `,
      salePrice,
      createdAt,
      userId,
      salePrice
    );
    if (Number(updatedUser || 0) < 1) {
      throw new Error('Số dư ví chính không đủ để mua kênh này.');
    }

    await tx.$executeRawUnsafe(
      `
        UPDATE tiktok_channel_products
        SET status = 'processing', updated_at = ?
        WHERE id = ?
      `,
      createdAt,
      product.id
    );

    const balanceRows = await tx.$queryRawUnsafe<Array<{ balance: Prisma.Decimal | number | string }>>(
      'SELECT balance FROM users WHERE id = ? LIMIT 1',
      userId
    );
    const balanceAfter = toNumber(balanceRows[0]?.balance, 0);
    const orderCode = generateOrderCode();
    const apiPrice = normalizeMoney(product.api_price_vnd);
    const profit = salePrice - apiPrice;

    await tx.$executeRawUnsafe(
      `
        INSERT INTO tiktok_channel_orders
          (order_code, user_id, product_id, provider_product_id, product_title, niche, follower_count,
           api_price_vnd, sale_price_vnd, profit_vnd, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'processing', ?, ?)
      `,
      orderCode,
      userId,
      product.id,
      product.provider_product_id,
      product.title,
      product.niche,
      product.follower_count,
      apiPrice,
      salePrice,
      profit,
      createdAt,
      createdAt
    );

    await tx.transactions.create({
      data: {
        user_id: userId,
        amount: salePrice,
        balance_after: balanceAfter,
        wallet_type: 'main',
        type: 'order',
        status: 'success',
        content: `Mua kênh TikTok ${product.title} - mã ${orderCode}`,
      },
    }).catch(() => undefined);

    const orderRows = await tx.$queryRawUnsafe<Record<string, unknown>[]>(
      'SELECT * FROM tiktok_channel_orders WHERE order_code = ? LIMIT 1',
      orderCode
    );
    const order = orderRows[0] ? normalizeOrderRow(orderRows[0]) : null;
    if (!order) {
      throw new Error('Không tạo được đơn Kênh TikTok.');
    }

    return { order, product, balanceAfter };
  });
}

async function completeTikTokChannelOrder(
  orderId: number,
  productId: number,
  apiResult: KenhGiaReCreateOrderResponse,
  fallbackApiPrice: number
) {
  const updatedAt = getVietnamDatabaseDateTime();
  const providerOrder = apiResult.order || {};
  const credentials = providerOrder.credentials || {};
  const providerAmount = normalizeMoney(providerOrder.amount ?? fallbackApiPrice);
  const providerOrderId = providerOrder.id == null ? null : String(providerOrder.id);

  return db.$transaction(async (tx) => {
    const orderRows = await tx.$queryRawUnsafe<Record<string, unknown>[]>(
      'SELECT * FROM tiktok_channel_orders WHERE id = ? LIMIT 1 FOR UPDATE',
      orderId
    );
    const currentOrder = orderRows[0] ? normalizeOrderRow(orderRows[0]) : null;
    if (!currentOrder) {
      throw new Error('Không tìm thấy đơn Kênh TikTok sau khi mua API.');
    }
    const salePrice = normalizeMoney(currentOrder.sale_price_vnd);

    await tx.$executeRawUnsafe(
      `
        UPDATE tiktok_channel_orders
        SET provider_order_id = ?,
            provider_amount_vnd = ?,
            profit_vnd = ?,
            status = 'completed',
            credentials_json = ?,
            api_response_json = ?,
            updated_at = ?
        WHERE id = ?
      `,
      providerOrderId,
      providerAmount,
      salePrice - providerAmount,
      jsonStringify(credentials),
      jsonStringify(apiResult),
      updatedAt,
      orderId
    );

    await tx.$executeRawUnsafe(
      `
        UPDATE tiktok_channel_products
        SET status = 'sold', updated_at = ?
        WHERE id = ?
      `,
      updatedAt,
      productId
    );

    const rows = await tx.$queryRawUnsafe<Record<string, unknown>[]>(
      'SELECT * FROM tiktok_channel_orders WHERE id = ? LIMIT 1',
      orderId
    );
    const balanceRows = await tx.$queryRawUnsafe<Array<{ balance: Prisma.Decimal | number | string }>>(
      'SELECT balance FROM users WHERE id = ? LIMIT 1',
      currentOrder.user_id
    );

    return {
      order: rows[0] ? normalizeOrderRow(rows[0]) : currentOrder,
      balance_after: toNumber(balanceRows[0]?.balance, 0),
    };
  });
}

async function refundReservedTikTokChannelOrder(input: {
  orderId: number;
  productId: number;
  userId: number;
  amount: number;
  reason: string;
  productStatus: 'active' | 'unavailable';
  apiResponse?: unknown;
}) {
  const updatedAt = getVietnamDatabaseDateTime();

  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `
        UPDATE users
        SET balance = balance + ?, last_activity = ?
        WHERE id = ?
      `,
      input.amount,
      updatedAt,
      input.userId
    );

    const balanceRows = await tx.$queryRawUnsafe<Array<{ balance: Prisma.Decimal | number | string }>>(
      'SELECT balance FROM users WHERE id = ? LIMIT 1',
      input.userId
    );
    const balanceAfter = toNumber(balanceRows[0]?.balance, 0);

    await tx.$executeRawUnsafe(
      `
        UPDATE tiktok_channel_orders
        SET status = 'failed',
            admin_note = ?,
            api_response_json = ?,
            updated_at = ?
        WHERE id = ?
      `,
      input.reason,
      input.apiResponse ? jsonStringify(input.apiResponse) : null,
      updatedAt,
      input.orderId
    );

    await tx.$executeRawUnsafe(
      `
        UPDATE tiktok_channel_products
        SET status = ?, updated_at = ?
        WHERE id = ? AND status = 'processing'
      `,
      input.productStatus,
      updatedAt,
      input.productId
    );

    await tx.transactions.create({
      data: {
        user_id: input.userId,
        amount: input.amount,
        balance_after: balanceAfter,
        wallet_type: 'main',
        type: 'refund',
        status: 'success',
        content: `Hoàn tiền đơn Kênh TikTok #${input.orderId}: ${input.reason}`,
      },
    }).catch(() => undefined);
  });
}

export async function createTikTokChannelOrder(userId: number, productId: number) {
  await ensureTikTokChannelTables();
  const config = await getKenhGiaReConfig();
  if (!config.apiKey) {
    throw new Error('Chưa cấu hình API key Kênh Giá Rẻ. Owner cần nhập kenhgiare_api_key trong admin.');
  }

  const localProduct = await getProductForCheckout(productId);
  if (!localProduct || localProduct.status !== 'active' || !localProduct.has_credentials) {
    throw new Error('Kênh TikTok không tồn tại hoặc đã hết hàng.');
  }

  await refreshProductBeforeCheckout(localProduct, config);
  const reserved = await reserveTikTokChannelOrder(userId, productId);

  try {
    const apiResult = await createKenhGiaReOrder(reserved.product.provider_product_id, config);
    return completeTikTokChannelOrder(
      reserved.order.id,
      reserved.product.id,
      apiResult,
      normalizeMoney(reserved.product.api_price_vnd)
    );
  } catch (error) {
    const apiError = error instanceof KenhGiaReApiError ? error : null;
    const unavailable = apiError && ['PRODUCT_UNAVAILABLE', 'NOT_FOUND'].includes(apiError.code);
    const message = error instanceof Error ? error.message : 'Kênh Giá Rẻ không tạo được đơn.';
    await refundReservedTikTokChannelOrder({
      orderId: reserved.order.id,
      productId: reserved.product.id,
      userId,
      amount: normalizeMoney(reserved.order.sale_price_vnd),
      reason: `KGR lỗi: ${message}. Hệ thống đã hoàn tiền.`,
      productStatus: unavailable ? 'unavailable' : 'active',
      apiResponse: apiError?.payload,
    });
    throw new Error(`KGR lỗi: ${message}. Hệ thống đã hoàn tiền vào ví chính.`);
  }
}

export async function updateTikTokChannelProductAutoPrice(id: number) {
  await ensureTikTokChannelTables();
  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
    'SELECT * FROM tiktok_channel_products WHERE id = ? LIMIT 1',
    id
  );
  const product = rows[0] ? normalizeProductRow(rows[0]) : null;
  if (!product || !product.is_auto_price) {
    return null;
  }

  const salePrice = calculateSalePrice(product.api_price_vnd, product.margin_percent);
  await db.$executeRawUnsafe(
    'UPDATE tiktok_channel_products SET sale_price_vnd = ?, updated_at = NOW() WHERE id = ?',
    salePrice,
    id
  );
  const nextRows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
    'SELECT * FROM tiktok_channel_products WHERE id = ? LIMIT 1',
    id
  );
  return nextRows[0] ? normalizeProductRow(nextRows[0]) : null;
}

export async function repriceTikTokChannelAutoProducts() {
  await ensureTikTokChannelTables();
  const config = await getKenhGiaReConfig();
  const repriced = await db.$executeRawUnsafe(
    `
      UPDATE tiktok_channel_products
      SET margin_percent = ?,
          sale_price_vnd = ROUND(COALESCE(api_price_vnd, 0) * (1 + (? / 100)), 0),
          updated_at = NOW()
      WHERE COALESCE(is_auto_price, 1) = 1
        AND status <> 'sold'
    `,
    config.defaultMarginPercent,
    config.defaultMarginPercent
  );

  return {
    repriced: Number(repriced || 0),
    auto_margin_percent: config.defaultMarginPercent,
  };
}

export async function invalidateKenhGiaReSettingsCache() {
  invalidateLegacySettingsCache();
}
