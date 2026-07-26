import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { getVietnamDatabaseDateTime, serializeDatabaseDateTime } from '@/lib/date-time';
import { toNumber } from '@/lib/utils';

export type VibeCodeProvider = 'cursor' | 'codex' | 'claude' | 'chatgpt' | 'kiro' | 'other';

export type VibeCodePackageRow = {
  id: number;
  vendor: string;
  vendor_product_id: string | null;
  provider: VibeCodeProvider;
  package_key: string;
  title: string;
  description: string | null;
  unit_label: string | null;
  unit_amount: number;
  source_price_vnd: number;
  sale_price_vnd: number;
  margin_percent: number;
  is_auto_price: boolean;
  stock_available: number;
  stock_total: number;
  sold_count: number;
  image_url: string | null;
  display_order: number;
  status: string;
  synced_at?: string | Date | null;
  created_at?: string | Date;
  updated_at?: string | Date;
};

export type PublicVibeCodePackage = Omit<
  VibeCodePackageRow,
  'vendor' | 'vendor_product_id' | 'source_price_vnd' | 'margin_percent' | 'is_auto_price' | 'stock_total' | 'sold_count'
>;

type GenzShopConfig = {
  apiKey: string;
  baseUrl: string;
  defaultMarginPercent: number;
};

type GenzShopProduct = {
  product_id?: unknown;
  name?: unknown;
  description?: unknown;
  type?: unknown;
  image?: unknown;
  walletPricing?: unknown;
  walletPricingText?: unknown;
  stats?: {
    total?: unknown;
    sold?: unknown;
    available?: unknown;
  } | null;
};

type GenzShopProductsResponse = {
  success?: unknown;
  products?: GenzShopProduct[];
  message?: unknown;
  error?: unknown;
  errorCode?: unknown;
};

type GenzShopDeliveredAccount = Record<string, unknown>;

type GenzShopPurchaseResponse = {
  success?: unknown;
  message?: unknown;
  error?: unknown;
  errorCode?: unknown;
  orderCode?: unknown;
  productType?: unknown;
  quantity?: unknown;
  amount?: unknown;
  amountText?: unknown;
  balance?: unknown;
  balanceText?: unknown;
  deliveredAccounts?: GenzShopDeliveredAccount[];
  replay?: unknown;
};

const GENZSHOP_VENDOR = 'genzshop';
const GENZSHOP_DEFAULT_BASE_URL = 'https://genzshop.vn/api/partner/v1';
const GENZSHOP_DEFAULT_MARGIN_PERCENT = 80;
const GENZSHOP_STALE_HOURS = 12;

let ensurePromise: Promise<void> | null = null;

class VibeCodeVendorError extends Error {
  public readonly debugMessage: string;
  public readonly status?: number;
  public readonly code?: string;

  constructor(publicMessage: string, options: { debugMessage?: string; status?: number; code?: string } = {}) {
    super(publicMessage);
    this.name = 'VibeCodeVendorError';
    this.debugMessage = options.debugMessage || publicMessage;
    this.status = options.status;
    this.code = options.code;
  }
}

class VibeCodeCheckoutError extends Error {
  public readonly balanceAfter?: number;
  public readonly orderCode?: string;

  constructor(message: string, options: { balanceAfter?: number; orderCode?: string } = {}) {
    super(message);
    this.name = 'VibeCodeCheckoutError';
    this.balanceAfter = options.balanceAfter;
    this.orderCode = options.orderCode;
  }
}

function normalizeProvider(value: unknown, fallbackText = ''): VibeCodeProvider {
  const raw = `${String(value || '')} ${fallbackText}`.toLowerCase();
  if (raw.includes('codex')) return 'codex';
  if (raw.includes('claude') || raw.includes('anthropic')) return 'claude';
  if (raw.includes('chatgpt') || raw.includes('openai') || raw.includes('gpt')) return 'chatgpt';
  if (raw.includes('kiro')) return 'kiro';
  if (raw.includes('cursor')) return 'cursor';
  return 'other';
}

function normalizePackage(row: Record<string, unknown>): VibeCodePackageRow {
  const provider = normalizeProvider(row.provider, String(row.title || row.package_key || row.description || ''));
  const sourcePrice = toNumber(row.source_price_vnd, 0);
  const rawUnitAmount = toNumber(row.unit_amount, 0);
  const unitAmount = provider === 'codex' && rawUnitAmount <= 1
    ? sourcePriceToUsdAmount(sourcePrice) || rawUnitAmount
    : rawUnitAmount;

  return {
    id: Math.trunc(toNumber(row.id, 0)),
    vendor: String(row.vendor || GENZSHOP_VENDOR),
    vendor_product_id: row.vendor_product_id == null ? null : String(row.vendor_product_id),
    provider,
    package_key: String(row.package_key || ''),
    title: String(row.title || ''),
    description: row.description == null ? null : String(row.description),
    unit_label: row.unit_label == null ? null : String(row.unit_label),
    unit_amount: unitAmount,
    source_price_vnd: sourcePrice,
    sale_price_vnd: toNumber(row.sale_price_vnd, 0),
    margin_percent: toNumber(row.margin_percent, GENZSHOP_DEFAULT_MARGIN_PERCENT),
    is_auto_price: toNumber(row.is_auto_price, 1) !== 0,
    stock_available: Math.max(0, Math.trunc(toNumber(row.stock_available, 0))),
    stock_total: Math.max(0, Math.trunc(toNumber(row.stock_total, 0))),
    sold_count: Math.max(0, Math.trunc(toNumber(row.sold_count, 0))),
    image_url: row.image_url == null ? null : String(row.image_url),
    display_order: Math.trunc(toNumber(row.display_order, 0)),
    status: String(row.status || 'active'),
    synced_at: row.synced_at as string | Date | null | undefined,
    created_at: row.created_at as string | Date | undefined,
    updated_at: row.updated_at as string | Date | undefined,
  };
}

function sanitizePublicVibeCodeText(value: unknown) {
  return String(value || '')
    .replace(/genz\s*shop/gi, 'hệ thống')
    .replace(/genzshop\.vn/gi, 'hệ thống')
    .replace(/\bgenz\b/gi, 'hệ thống')
    .replace(/\s+/g, ' ')
    .trim();
}

function toPublicPackage(row: VibeCodePackageRow): PublicVibeCodePackage {
  const {
    vendor: _vendor,
    vendor_product_id: _vendorProductId,
    source_price_vnd: _sourcePrice,
    margin_percent: _marginPercent,
    is_auto_price: _isAutoPrice,
    stock_total: _stockTotal,
    sold_count: _soldCount,
    ...publicRow
  } = row;
  return {
    ...publicRow,
    title: sanitizePublicVibeCodeText(publicRow.title) || publicRow.title,
    description: publicRow.description == null ? null : sanitizePublicVibeCodeText(publicRow.description),
  };
}

function generateOrderCode() {
  const time = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `VC-${time}-${random}`;
}

function sanitizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, '') || GENZSHOP_DEFAULT_BASE_URL;
}

function getGenzShopConfig(): GenzShopConfig {
  const apiKey = String(process.env.GENZSHOP_API_KEY || process.env.GENZSHOP_VIBE_CODE_API_KEY || '').trim();
  const baseUrl = sanitizeBaseUrl(String(process.env.GENZSHOP_API_BASE_URL || GENZSHOP_DEFAULT_BASE_URL));
  const defaultMarginPercent = Math.max(
    0,
    toNumber(process.env.GENZSHOP_DEFAULT_MARGIN_PERCENT, GENZSHOP_DEFAULT_MARGIN_PERCENT)
  );

  return { apiKey, baseUrl, defaultMarginPercent };
}

function requireGenzShopConfig() {
  const config = getGenzShopConfig();
  if (!config.apiKey) {
    throw new VibeCodeVendorError('Nguồn cấp gói tự động chưa được cấu hình.', {
      debugMessage: 'Missing GENZSHOP_API_KEY for Vibe Code GenZ Shop integration',
      code: 'MISSING_GENZSHOP_API_KEY',
    });
  }
  return config;
}

async function genzShopFetch<T>(path: string, init: RequestInit = {}, inputConfig?: GenzShopConfig): Promise<T> {
  const config = inputConfig || requireGenzShopConfig();
  const url = `${config.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      'X-API-Key': config.apiKey,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });

  const text = await response.text();
  let payload: Record<string, unknown> = {};
  if (text.trim()) {
    try {
      payload = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new VibeCodeVendorError('Nguồn cấp gói đang bận, vui lòng thử lại sau.', {
        debugMessage: `GenZ Shop returned non-JSON response (${response.status}): ${text.slice(0, 240)}`,
        status: response.status,
        code: 'GENZSHOP_NON_JSON',
      });
    }
  }

  if (!response.ok || payload.success === false) {
    const message = String(payload.message || payload.error || '').trim();
    const code = String(payload.errorCode || '').trim();
    throw new VibeCodeVendorError('Nguồn cấp gói chưa xử lý được yêu cầu lúc này.', {
      debugMessage: `GenZ Shop error ${response.status}${code ? ` ${code}` : ''}${message ? `: ${message}` : ''}`,
      status: response.status,
      code,
    });
  }

  return payload as T;
}

async function tableColumns(table: string) {
  const rows = await db.$queryRawUnsafe<Array<{ Field: string }>>(`SHOW COLUMNS FROM \`${table}\``);
  return new Set(rows.map((row) => row.Field));
}

async function ensureColumn(table: string, column: string, definition: string, afterColumn?: string) {
  const columns = await tableColumns(table);
  if (columns.has(column)) return;

  const afterSql = afterColumn && columns.has(afterColumn) ? ` AFTER \`${afterColumn}\`` : '';
  await db.$executeRawUnsafe(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}${afterSql}`);
}

function calculateAutoSalePrice(sourcePrice: unknown, marginPercent: unknown) {
  const source = Math.max(0, Math.round(toNumber(sourcePrice, 0)));
  const margin = Math.max(0, toNumber(marginPercent, GENZSHOP_DEFAULT_MARGIN_PERCENT));
  return Math.round(source * (1 + margin / 100));
}

function sourcePriceToUsdAmount(sourcePrice: unknown) {
  const source = Math.max(0, Math.round(toNumber(sourcePrice, 0)));
  return source > 0 ? Math.round(source / 1000) : 0;
}

function productSearchText(product: GenzShopProduct, ...extra: unknown[]) {
  return [
    product.name,
    product.description,
    product.type,
    product.walletPricingText,
    ...extra,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' ');
}

function isHiddenVibeCodeProduct(...values: unknown[]) {
  const text = values.map((value) => String(value || '').trim()).filter(Boolean).join(' ');
  return /\btest\s*api\b/i.test(text);
}

function productUnitAmount(product: GenzShopProduct, provider: VibeCodeProvider, sourcePrice: number) {
  const text = productSearchText(product);
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*(?:\$|usd|credit|request|ngày|day|tháng|month)\b/i);
  const parsedAmount = match ? toNumber(match[1], 0) : 0;
  if (parsedAmount > 0) return parsedAmount;
  if (provider === 'codex') return sourcePriceToUsdAmount(sourcePrice);
  return 0;
}

function productUnitLabel(product: GenzShopProduct) {
  const name = productSearchText(product).toLowerCase();
  if (name.includes('request')) return 'request';
  if (name.includes('credit') || name.includes('$') || name.includes('usd')) return 'Credit';
  if (name.includes('ngày') || name.includes('day')) return 'ngày';
  if (name.includes('tháng') || name.includes('month')) return 'tháng';
  return 'gói';
}

function normalizeGenzProduct(product: GenzShopProduct, index: number, config: GenzShopConfig) {
  const productId = String(product.product_id || '').trim();
  if (!productId) return null;

  const sourcePrice = Math.max(0, Math.round(toNumber(product.walletPricing, 0)));
  const available = Math.max(0, Math.trunc(toNumber(product.stats?.available, 0)));
  const total = Math.max(0, Math.trunc(toNumber(product.stats?.total, available)));
  const sold = Math.max(0, Math.trunc(toNumber(product.stats?.sold, 0)));
  const title = String(product.name || productId).trim();
  if (isHiddenVibeCodeProduct(productSearchText(product, productId), title, productId)) return null;
  const provider = normalizeProvider(product.type, productSearchText(product, title, productId));

  return {
    provider,
    packageKey: productId,
    vendorProductId: productId,
    title,
    description: String(product.description || '').trim() || `Gói ${title} đồng bộ từ API.`,
    unitLabel: provider === 'codex' ? 'USD' : productUnitLabel(product),
    unitAmount: productUnitAmount(product, provider, sourcePrice),
    sourcePrice,
    salePrice: calculateAutoSalePrice(sourcePrice, config.defaultMarginPercent),
    marginPercent: config.defaultMarginPercent,
    stockAvailable: available,
    stockTotal: total,
    soldCount: sold,
    imageUrl: String(product.image || '').trim(),
    status: available > 0 ? 'active' : 'unavailable',
    displayOrder: (index + 1) * 10,
    vendorPayload: JSON.stringify(product),
  };
}

async function getOrderForUser(orderCode: string) {
  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
    `
      SELECT id, order_code, package_id, provider, package_key, package_title,
             unit_amount, sale_price_vnd, status, admin_note, credentials, created_at, updated_at
      FROM vibe_code_orders
      WHERE order_code = ?
      LIMIT 1
    `,
    orderCode
  );
  return rows[0] || null;
}

export async function ensureVibeCodeTables() {
  ensurePromise ||= (async () => {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS vibe_code_packages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        vendor VARCHAR(32) NOT NULL DEFAULT 'genzshop',
        vendor_product_id VARCHAR(120) NULL,
        provider VARCHAR(32) NOT NULL,
        package_key VARCHAR(120) NOT NULL,
        title VARCHAR(191) NOT NULL,
        description TEXT NULL,
        unit_label VARCHAR(80) NULL,
        unit_amount DECIMAL(12, 2) NOT NULL DEFAULT 1,
        source_price_vnd DECIMAL(15, 2) NOT NULL DEFAULT 0,
        sale_price_vnd DECIMAL(15, 2) NOT NULL DEFAULT 0,
        margin_percent DECIMAL(8, 2) NOT NULL DEFAULT 80,
        is_auto_price TINYINT(1) NOT NULL DEFAULT 1,
        stock_available INT NOT NULL DEFAULT 0,
        stock_total INT NOT NULL DEFAULT 0,
        sold_count INT NOT NULL DEFAULT 0,
        image_url VARCHAR(500) NULL,
        vendor_payload LONGTEXT NULL,
        display_order INT NOT NULL DEFAULT 0,
        status VARCHAR(32) NOT NULL DEFAULT 'active',
        synced_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_vibe_code_package (provider, package_key),
        INDEX idx_vibe_code_packages_provider_status (provider, status),
        INDEX idx_vibe_code_packages_vendor_product (vendor, vendor_product_id),
        INDEX idx_vibe_code_packages_order (display_order, id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS vibe_code_orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_code VARCHAR(64) NOT NULL UNIQUE,
        user_id INT NOT NULL,
        package_id INT NOT NULL,
        provider VARCHAR(32) NOT NULL,
        package_key VARCHAR(120) NOT NULL,
        package_title VARCHAR(191) NOT NULL,
        unit_amount DECIMAL(12, 2) NOT NULL DEFAULT 1,
        quantity INT NOT NULL DEFAULT 1,
        vendor VARCHAR(32) NOT NULL DEFAULT 'genzshop',
        vendor_product_id VARCHAR(120) NULL,
        vendor_order_code VARCHAR(120) NULL,
        source_price_vnd DECIMAL(15, 2) NOT NULL DEFAULT 0,
        sale_price_vnd DECIMAL(15, 2) NOT NULL DEFAULT 0,
        provider_amount_vnd DECIMAL(15, 2) NOT NULL DEFAULT 0,
        profit_vnd DECIMAL(15, 2) NOT NULL DEFAULT 0,
        credentials LONGTEXT NULL,
        vendor_payload LONGTEXT NULL,
        failure_reason TEXT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'pending',
        admin_note TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_vibe_code_orders_user (user_id),
        INDEX idx_vibe_code_orders_package (package_id),
        INDEX idx_vibe_code_orders_status (status),
        INDEX idx_vibe_code_orders_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await ensureColumn('vibe_code_packages', 'vendor', "VARCHAR(32) NOT NULL DEFAULT 'genzshop'", 'id');
    await ensureColumn('vibe_code_packages', 'vendor_product_id', 'VARCHAR(120) NULL', 'vendor');
    await ensureColumn('vibe_code_packages', 'margin_percent', 'DECIMAL(8, 2) NOT NULL DEFAULT 80', 'sale_price_vnd');
    await ensureColumn('vibe_code_packages', 'is_auto_price', 'TINYINT(1) NOT NULL DEFAULT 1', 'margin_percent');
    await ensureColumn('vibe_code_packages', 'stock_available', 'INT NOT NULL DEFAULT 0', 'is_auto_price');
    await ensureColumn('vibe_code_packages', 'stock_total', 'INT NOT NULL DEFAULT 0', 'stock_available');
    await ensureColumn('vibe_code_packages', 'sold_count', 'INT NOT NULL DEFAULT 0', 'stock_total');
    await ensureColumn('vibe_code_packages', 'image_url', 'VARCHAR(500) NULL', 'sold_count');
    await ensureColumn('vibe_code_packages', 'vendor_payload', 'LONGTEXT NULL', 'image_url');
    await ensureColumn('vibe_code_packages', 'synced_at', 'DATETIME NULL', 'status');

    await ensureColumn('vibe_code_orders', 'quantity', 'INT NOT NULL DEFAULT 1', 'unit_amount');
    await ensureColumn('vibe_code_orders', 'vendor', "VARCHAR(32) NOT NULL DEFAULT 'genzshop'", 'quantity');
    await ensureColumn('vibe_code_orders', 'vendor_product_id', 'VARCHAR(120) NULL', 'vendor');
    await ensureColumn('vibe_code_orders', 'vendor_order_code', 'VARCHAR(120) NULL', 'vendor_product_id');
    await ensureColumn('vibe_code_orders', 'provider_amount_vnd', 'DECIMAL(15, 2) NOT NULL DEFAULT 0', 'sale_price_vnd');
    await ensureColumn('vibe_code_orders', 'profit_vnd', 'DECIMAL(15, 2) NOT NULL DEFAULT 0', 'provider_amount_vnd');
    await ensureColumn('vibe_code_orders', 'credentials', 'LONGTEXT NULL', 'profit_vnd');
    await ensureColumn('vibe_code_orders', 'vendor_payload', 'LONGTEXT NULL', 'credentials');
    await ensureColumn('vibe_code_orders', 'failure_reason', 'TEXT NULL', 'vendor_payload');

    await db.$executeRawUnsafe('ALTER TABLE vibe_code_packages MODIFY COLUMN package_key VARCHAR(120) NOT NULL').catch(() => undefined);
    await db.$executeRawUnsafe('ALTER TABLE vibe_code_orders MODIFY COLUMN package_key VARCHAR(120) NOT NULL').catch(() => undefined);
    await db.$executeRawUnsafe(`
      DELETE newer
      FROM vibe_code_packages newer
      INNER JOIN vibe_code_packages older
        ON older.provider = newer.provider
       AND older.package_key = newer.package_key
       AND older.id < newer.id
    `).catch(() => undefined);
    await db.$executeRawUnsafe(
      'ALTER TABLE vibe_code_packages ADD UNIQUE KEY uniq_vibe_code_package (provider, package_key)'
    ).catch(() => undefined);

    await db.$executeRawUnsafe(`
      UPDATE vibe_code_packages
      SET vendor = COALESCE(NULLIF(vendor, ''), 'genzshop'),
          vendor_product_id = COALESCE(NULLIF(vendor_product_id, ''), package_key),
          margin_percent = CASE WHEN COALESCE(margin_percent, 0) <= 0 THEN 80 ELSE margin_percent END,
          is_auto_price = CASE WHEN COALESCE(is_auto_price, 1) = 0 THEN 0 ELSE 1 END
      WHERE vendor IS NULL OR vendor = '' OR vendor_product_id IS NULL OR vendor_product_id = '' OR COALESCE(margin_percent, 0) <= 0
    `).catch(() => undefined);
  })();

  return ensurePromise;
}

export async function syncGenzShopVibeCodeProducts() {
  await ensureVibeCodeTables();
  const config = requireGenzShopConfig();
  const data = await genzShopFetch<GenzShopProductsResponse>('/products.php', {}, config);
  const products = Array.isArray(data.products) ? data.products : [];
  const syncedAt = getVietnamDatabaseDateTime();
  let upserted = 0;
  let skipped = 0;

  for (const [index, product] of products.entries()) {
    const item = normalizeGenzProduct(product, index, config);
    if (!item) {
      skipped += 1;
      continue;
    }

    await db.$executeRawUnsafe(
      `
        INSERT INTO vibe_code_packages
          (vendor, vendor_product_id, provider, package_key, title, description, unit_label, unit_amount,
           source_price_vnd, sale_price_vnd, margin_percent, is_auto_price,
           stock_available, stock_total, sold_count, image_url, vendor_payload, display_order, status, synced_at)
        VALUES ('genzshop', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          vendor = 'genzshop',
          vendor_product_id = VALUES(vendor_product_id),
          title = VALUES(title),
          description = VALUES(description),
          unit_label = VALUES(unit_label),
          unit_amount = VALUES(unit_amount),
          source_price_vnd = VALUES(source_price_vnd),
          margin_percent = CASE WHEN COALESCE(margin_percent, 0) <= 0 THEN VALUES(margin_percent) ELSE margin_percent END,
          sale_price_vnd = CASE
            WHEN COALESCE(is_auto_price, 1) = 1 OR COALESCE(sale_price_vnd, 0) <= 0
            THEN ROUND(VALUES(source_price_vnd) * (1 + (COALESCE(NULLIF(margin_percent, 0), VALUES(margin_percent)) / 100)), 0)
            ELSE sale_price_vnd
          END,
          stock_available = VALUES(stock_available),
          stock_total = VALUES(stock_total),
          sold_count = VALUES(sold_count),
          image_url = VALUES(image_url),
          vendor_payload = VALUES(vendor_payload),
          display_order = CASE WHEN COALESCE(display_order, 0) <= 0 THEN VALUES(display_order) ELSE display_order END,
          status = CASE
            WHEN status = 'inactive' THEN status
            WHEN VALUES(stock_available) <= 0 THEN 'unavailable'
            ELSE 'active'
          END,
          synced_at = VALUES(synced_at)
      `,
      item.vendorProductId,
      item.provider,
      item.packageKey,
      item.title,
      item.description,
      item.unitLabel,
      item.unitAmount,
      item.sourcePrice,
      item.salePrice,
      item.marginPercent,
      item.stockAvailable,
      item.stockTotal,
      item.soldCount,
      item.imageUrl || null,
      item.vendorPayload,
      item.displayOrder,
      item.status,
      syncedAt
    );
    upserted += 1;
  }

  if (upserted > 0) {
    await db.$executeRawUnsafe(
      `
        UPDATE vibe_code_packages
        SET status = CASE WHEN status = 'inactive' THEN status ELSE 'unavailable' END,
            stock_available = 0,
            updated_at = NOW()
        WHERE vendor = 'genzshop'
          AND (synced_at IS NULL OR synced_at < ?)
          AND status <> 'inactive'
      `,
      syncedAt
    );
  }

  return {
    fetched: products.length,
    upserted,
    skipped_products: skipped,
    synced_at: syncedAt,
    vendor: GENZSHOP_VENDOR,
    auto_margin_percent: config.defaultMarginPercent,
    keep_manual_web_price: true,
  };
}

export async function syncGenzShopVibeCodeProductsIfStale(options: { force?: boolean; intervalHours?: number } = {}) {
  await ensureVibeCodeTables();
  const intervalHours = Math.max(1, Math.trunc(toNumber(options.intervalHours, GENZSHOP_STALE_HOURS)));
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
      FROM vibe_code_packages
      WHERE vendor = 'genzshop'
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
      total,
      active_total: activeTotal,
      last_synced_at: lastSyncedAt,
    };
  }

  const result = await syncGenzShopVibeCodeProducts();
  return {
    synced: true,
    skipped: false,
    previous_total: total,
    previous_active_total: activeTotal,
    previous_last_synced_at: lastSyncedAt,
    ...result,
  };
}

export async function updateVibeCodePackageAutoPrice(packageId: number) {
  await ensureVibeCodeTables();
  const updated = await db.$executeRawUnsafe(
    `
      UPDATE vibe_code_packages
      SET sale_price_vnd = ROUND(COALESCE(source_price_vnd, 0) * (1 + (COALESCE(NULLIF(margin_percent, 0), ?) / 100)), 0),
          is_auto_price = 1,
          updated_at = NOW()
      WHERE id = ?
        AND COALESCE(is_auto_price, 1) = 1
    `,
    GENZSHOP_DEFAULT_MARGIN_PERCENT,
    packageId
  );

  if (Number(updated || 0) < 1) return null;
  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
    'SELECT * FROM vibe_code_packages WHERE id = ? LIMIT 1',
    packageId
  );
  return rows[0] ? normalizePackage(rows[0]) : null;
}

export async function listVibeCodePackages(options: { activeOnly?: boolean; publicOnly?: boolean } = {}) {
  await ensureVibeCodeTables();
  await syncGenzShopVibeCodeProductsIfStale({ intervalHours: GENZSHOP_STALE_HOURS }).catch(() => undefined);

  const statusSql = options.activeOnly
    ? "WHERE status = 'active' AND COALESCE(stock_available, 0) > 0"
    : '';
  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
    `
      SELECT *
      FROM vibe_code_packages
      ${statusSql}
      ORDER BY FIELD(provider, 'cursor', 'codex', 'claude', 'chatgpt', 'kiro', 'other'), display_order ASC, id ASC
    `
  );
  const normalized = rows.map(normalizePackage);
  const filtered = options.publicOnly
    ? normalized.filter((item) => !isHiddenVibeCodeProduct(item.title, item.package_key, item.description, item.provider))
    : normalized;
  return options.publicOnly ? filtered.map(toPublicPackage) : filtered;
}

export async function listUserVibeCodeOrders(userId: number) {
  await ensureVibeCodeTables();
  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
    `
      SELECT id, order_code, package_id, provider, package_key, package_title,
             unit_amount, sale_price_vnd, status, admin_note, credentials, created_at, updated_at
      FROM vibe_code_orders
      WHERE user_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 30
    `,
    userId
  );

  return rows.map((row) => ({
    ...row,
    id: Math.trunc(toNumber(row.id, 0)),
    package_id: Math.trunc(toNumber(row.package_id, 0)),
    unit_amount: toNumber(row.unit_amount, 0),
    sale_price_vnd: toNumber(row.sale_price_vnd, 0),
    admin_note: row.admin_note == null ? null : sanitizePublicVibeCodeText(row.admin_note),
  }));
}

async function purchaseGenzShopProduct(input: {
  productId: string;
  orderCode: string;
  customerEmail?: string | null;
}) {
  const body: Record<string, unknown> = {
    product_id: input.productId,
    quantity: 1,
    idempotency_key: input.orderCode,
  };
  if (input.customerEmail) body.customer_email = input.customerEmail;

  const response = await genzShopFetch<GenzShopPurchaseResponse>('/purchase.php', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  if (response.success === false) {
    throw new VibeCodeVendorError('Nguồn cấp gói chưa xử lý được yêu cầu lúc này.', {
      debugMessage: `GenZ Shop purchase failed: ${String(response.message || response.error || response.errorCode || '')}`,
      code: String(response.errorCode || ''),
    });
  }

  return response;
}

async function refundReservedVibeCodeOrder(input: {
  orderCode: string;
  userId: number;
  salePrice: number;
  reason: string;
}) {
  return db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `
        UPDATE vibe_code_orders
        SET status = 'refunded',
            failure_reason = ?,
            admin_note = ?,
            updated_at = ?
        WHERE order_code = ?
      `,
      input.reason,
      input.reason,
      getVietnamDatabaseDateTime(),
      input.orderCode
    );

    const updatedUser = await tx.users.update({
      where: { id: input.userId },
      data: {
        balance: { increment: input.salePrice },
        last_activity: new Date(),
      },
      select: { balance: true },
    });
    const balanceAfter = toNumber(updatedUser.balance, 0);

    await tx.transactions.create({
      data: {
        user_id: input.userId,
        amount: input.salePrice,
        balance_after: balanceAfter,
        wallet_type: 'main',
        type: 'refund',
        status: 'success',
        content: `Hoàn tiền đơn Vibe Code ${input.orderCode}`,
      },
    }).catch(() => undefined);

    return balanceAfter;
  });
}

export async function createVibeCodeOrder(userId: number, packageId: number) {
  await ensureVibeCodeTables();

  const reserved = await db.$transaction(async (tx) => {
    const packageRows = await tx.$queryRawUnsafe<Record<string, unknown>[]>(
      `
        SELECT *
        FROM vibe_code_packages
        WHERE id = ? AND status = 'active' AND COALESCE(stock_available, 0) > 0
        LIMIT 1
        FOR UPDATE
      `,
      packageId
    );
    const selectedPackage = packageRows[0] ? normalizePackage(packageRows[0]) : null;
    if (!selectedPackage) {
      throw new Error('Gói Vibe Code không tồn tại, đang tắt hoặc tạm hết hàng');
    }
    if (isHiddenVibeCodeProduct(selectedPackage.title, selectedPackage.package_key, selectedPackage.description)) {
      throw new Error('Gói Vibe Code không tồn tại, đang tắt hoặc tạm hết hàng');
    }

    const productId = String(selectedPackage.vendor_product_id || selectedPackage.package_key || '').trim();
    if (!productId) {
      throw new Error('Gói Vibe Code chưa có mã sản phẩm tự động');
    }

    const price = Math.max(0, Math.round(selectedPackage.sale_price_vnd));
    if (price <= 0) {
      throw new Error('Gói Vibe Code chưa có giá bán hợp lệ');
    }

    const createdAt = getVietnamDatabaseDateTime();
    const userRows = await tx.$queryRawUnsafe<Array<{ email: string | null }>>(
      'SELECT email FROM users WHERE id = ? LIMIT 1 FOR UPDATE',
      userId
    );
    if (userRows.length < 1) {
      throw new Error('Không tìm thấy tài khoản của bạn');
    }

    const updated = await tx.$executeRawUnsafe(
      `
        UPDATE users
        SET balance = balance - ?, last_activity = ?
        WHERE id = ? AND balance >= ?
      `,
      price,
      createdAt,
      userId,
      price
    );
    if (updated < 1) {
      throw new Error('Số dư ví chính không đủ để mua gói này');
    }

    const balanceRows = await tx.$queryRawUnsafe<Array<{ balance: Prisma.Decimal | number | string }>>(
      'SELECT balance FROM users WHERE id = ? LIMIT 1',
      userId
    );
    const balanceAfter = toNumber(balanceRows[0]?.balance, 0);
    const orderCode = generateOrderCode();

    await tx.$executeRawUnsafe(
      `
        INSERT INTO vibe_code_orders
          (order_code, user_id, package_id, provider, package_key, package_title, unit_amount, quantity,
           vendor, vendor_product_id, source_price_vnd, sale_price_vnd, provider_amount_vnd, profit_vnd,
           status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'genzshop', ?, ?, ?, 0, 0, 'processing', ?, ?)
      `,
      orderCode,
      userId,
      selectedPackage.id,
      selectedPackage.provider,
      selectedPackage.package_key,
      selectedPackage.title,
      selectedPackage.unit_amount,
      productId,
      selectedPackage.source_price_vnd,
      price,
      createdAt,
      createdAt
    );

    await tx.transactions.create({
      data: {
        user_id: userId,
        amount: price,
        balance_after: balanceAfter,
        wallet_type: 'main',
        type: 'order',
        status: 'success',
        content: `Mua ${selectedPackage.title} - mã ${orderCode}`,
      },
    }).catch(() => undefined);

    return {
      orderCode,
      productId,
      customerEmail: userRows[0]?.email || null,
      selectedPackage,
      price,
      balanceAfter,
    };
  });

  try {
    const vendorResult = await purchaseGenzShopProduct({
      productId: reserved.productId,
      orderCode: reserved.orderCode,
      customerEmail: reserved.customerEmail,
    });
    const providerAmount = Math.max(0, Math.round(toNumber(vendorResult.amount, reserved.selectedPackage.source_price_vnd)));
    const credentials = JSON.stringify(Array.isArray(vendorResult.deliveredAccounts) ? vendorResult.deliveredAccounts : []);
    const updatedAt = getVietnamDatabaseDateTime();

    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `
          UPDATE vibe_code_orders
          SET status = 'completed',
              vendor_order_code = ?,
              provider_amount_vnd = ?,
              profit_vnd = ?,
              credentials = ?,
              vendor_payload = ?,
              admin_note = ?,
              updated_at = ?
          WHERE order_code = ?
        `,
        String(vendorResult.orderCode || ''),
        providerAmount,
        reserved.price - providerAmount,
        credentials,
        JSON.stringify(vendorResult),
        vendorResult.replay ? 'GenZ replay idempotency, không trừ tiền nguồn lần hai.' : null,
        updatedAt,
        reserved.orderCode
      );

      await tx.$executeRawUnsafe(
        `
          UPDATE vibe_code_packages
          SET stock_available = GREATEST(COALESCE(stock_available, 0) - 1, 0),
              sold_count = COALESCE(sold_count, 0) + 1,
              status = CASE WHEN GREATEST(COALESCE(stock_available, 0) - 1, 0) <= 0 THEN 'unavailable' ELSE status END,
              updated_at = ?
          WHERE id = ?
        `,
        updatedAt,
        reserved.selectedPackage.id
      );
    });

    return {
      order: await getOrderForUser(reserved.orderCode),
      balance_after: reserved.balanceAfter,
    };
  } catch (error) {
    const vendorError = error instanceof VibeCodeVendorError
      ? error
      : new VibeCodeVendorError('Nguồn cấp gói chưa xử lý được yêu cầu lúc này.', {
          debugMessage: error instanceof Error ? error.message : String(error),
        });
    const balanceAfter = await refundReservedVibeCodeOrder({
      orderCode: reserved.orderCode,
      userId,
      salePrice: reserved.price,
      reason: vendorError.debugMessage,
    });
    throw new VibeCodeCheckoutError(
      'Không thể cấp gói tự động lúc này. Hệ thống đã hoàn tiền vào ví chính, vui lòng thử lại sau.',
      { balanceAfter, orderCode: reserved.orderCode }
    );
  }
}

export function isVibeCodeCheckoutError(error: unknown): error is VibeCodeCheckoutError {
  return error instanceof VibeCodeCheckoutError;
}
