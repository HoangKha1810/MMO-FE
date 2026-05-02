import 'server-only';

import { db } from '@/lib/db';
import { serializeAbsoluteDateTime, serializeDatabaseDateTime } from '@/lib/date-time';
import { invalidateLegacySettingsCache } from '@/lib/legacy-settings';
import { toNumber } from '@/lib/utils';
import type {
  ProxyAdminDashboardData,
  ProxyMarketplaceOverview,
  ProxyMarketplaceStats,
  ProxyOrderSummary,
  ProxyOwnedItem,
  ProxyPackageRecord,
  ProxyPricingRule,
  ProxyProviderProfile,
  ProxyServiceSettings,
} from '@/types/proxy';

type Row = Record<string, unknown>;

type ProviderPackagePayload = {
  id?: string | number;
  location?: string;
  name?: string;
  type?: string;
  duration_days?: string | number;
  min_days?: string | number;
  max_quantity?: string | number;
  price?: string | number;
};

type ProviderProxyPayload = {
  id?: string | number;
  ip_address?: string;
  port?: string | number;
  username?: string;
  password?: string;
  type?: string;
  status?: string;
  expired_at?: string;
  created_at?: string;
};

type ProviderListResponse = {
  data?: ProviderProxyPayload[];
  failed_ids?: Array<string | number>;
};

type ProxyActionInput = {
  ids: number[];
  days?: number;
  username?: string;
  password?: string;
};

type ProxyAdminSaveInput = {
  serviceStatus?: string;
  serviceName?: string;
  serviceDescription?: string;
  serviceNote?: string;
  defaultProtocol?: string;
  priceMultiplier?: number;
  packagePricing?: Record<string, ProxyPricingRule>;
};

const DEFAULT_PROXY_BASE_URL = 'https://proxy.vncloud.net/api/v1';
const PROXY_SETTINGS_KEYS = {
  serviceStatus: 'proxy_service_status',
  serviceName: 'proxy_service_name',
  serviceDescription: 'proxy_service_desc',
  serviceNote: 'proxy_service_note',
  defaultProtocol: 'proxy_default_protocol',
  priceMultiplier: 'proxy_price_multiplier',
  packagePricing: 'proxy_package_pricing_json',
} as const;

const LEGACY_PROXY_SERVICE_NOTE =
  'Giá bán mặc định đang được quy đổi theo giá vendor và hệ số markup. Bạn có thể cấu hình giá / ngày riêng cho từng package ở admin.';
const REMOVED_PROXY_SERVICE_NOTE =
  'Bảng giá proxy đã được tối ưu sẵn để bạn mua nhanh hơn, và admin vẫn có thể tinh chỉnh riêng từng gói bất cứ lúc nào.';
const DEPRECATED_PROXY_SERVICE_NOTES = new Set([
  LEGACY_PROXY_SERVICE_NOTE,
  REMOVED_PROXY_SERVICE_NOTE,
]);

const DEFAULT_PROXY_SETTINGS = {
  serviceStatus: 'active',
  serviceName: 'Proxy Cloud',
  serviceDescription: 'Mua proxy residential và datacenter trực tiếp bằng số dư tài khoản.',
  serviceNote: '',
  defaultProtocol: 'HTTP' as const,
  priceMultiplier: 1.2,
};

let proxyTablesPromise: Promise<void> | null = null;
let providerPackagesCache:
  | {
      expiresAt: number;
      data: ProviderPackagePayload[];
    }
  | null = null;
let providerProfileCache:
  | {
      expiresAt: number;
      data: ProxyProviderProfile | null;
    }
  | null = null;

function normalizeRow<T extends Row>(row: T): T {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => {
    if (value instanceof Date) {
      return [key, serializeDatabaseDateTime(value)];
    }
    if (typeof value === 'bigint') {
      return [key, Number(value)];
    }
    if (value && typeof value === 'object' && 'toNumber' in value && typeof value.toNumber === 'function') {
      return [key, value.toNumber()];
    }
    return [key, value];
  })) as T;
}

async function safeRows<T extends Row>(query: string, ...values: unknown[]) {
  try {
    const rows = await db.$queryRawUnsafe<T[]>(query, ...values);
    return rows.map(normalizeRow);
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[proxy-service] query failed', error);
    }
    return [] as T[];
  }
}

function maskToken(value: string) {
  if (!value) return '';
  if (value.length <= 10) return `${value.slice(0, 2)}***${value.slice(-2)}`;
  return `${value.slice(0, 6)}${'*'.repeat(Math.max(4, value.length - 10))}${value.slice(-4)}`;
}

function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed as T : fallback;
  } catch {
    return fallback;
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function compactPreview(value: string, maxLength = 220) {
  const normalized = value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return '';
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function buildVendorResponseDebugMessage(response: Response, rawText: string) {
  const contentType = response.headers.get('content-type') || 'unknown';
  const server = response.headers.get('server') || 'unknown';
  const cfRay = response.headers.get('cf-ray') || '';
  const preview = compactPreview(rawText);
  const parts = [
    `HTTP ${response.status}`,
    `content-type: ${contentType}`,
    `server: ${server}`,
  ];

  if (cfRay) {
    parts.push(`cf-ray: ${cfRay}`);
  }

  if (preview) {
    parts.push(`body: ${preview}`);
  }

  return parts.join(' | ');
}

function normalizeProtocol(value: string) {
  return value.trim().toUpperCase() === 'SOCKS5' ? 'SOCKS5' : 'HTTP';
}

function normalizeLocation(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function normalizePackageId(value: unknown) {
  return String(value || '').trim();
}

function databaseDateOrNull(value: unknown) {
  const raw = String(value || '').trim();
  return raw ? serializeAbsoluteDateTime(raw) : null;
}

function sumOrderVolume(orders: ProxyOrderSummary[]) {
  return orders.reduce((sum, order) => sum + toNumber(order.totalPrice, 0), 0);
}

function buildStats(
  packages: ProxyPackageRecord[],
  proxies: ProxyOwnedItem[],
  orders: ProxyOrderSummary[]
): ProxyMarketplaceStats {
  const now = Date.now();
  const soonWindow = now + 3 * 24 * 60 * 60 * 1000;
  const expiringSoon = proxies.filter((item) => {
    const expiredAt = new Date(item.expiredAt).getTime();
    return Number.isFinite(expiredAt) && expiredAt > now && expiredAt <= soonWindow;
  }).length;

  return {
    totalPackages: packages.length,
    enabledPackages: packages.filter((item) => item.enabled).length,
    totalOwned: proxies.length,
    activeOwned: proxies.filter((item) => item.status.toLowerCase() === 'active').length,
    expiringSoon,
    totalOrders: orders.length,
  };
}

async function ensureProxyTables() {
  if (proxyTablesPromise) {
    return proxyTablesPromise;
  }

  proxyTablesPromise = (async () => {
    try {
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS proxy_orders (
          id INT NOT NULL AUTO_INCREMENT,
          user_id INT NOT NULL,
          kind VARCHAR(20) NOT NULL DEFAULT 'buy',
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          package_id VARCHAR(64) NULL,
          package_name VARCHAR(255) NULL,
          location VARCHAR(64) NULL,
          proxy_type VARCHAR(64) NULL,
          protocol VARCHAR(20) NULL,
          days INT NOT NULL DEFAULT 0,
          quantity INT NOT NULL DEFAULT 0,
          unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
          total_price DECIMAL(15,2) NOT NULL DEFAULT 0,
          provider_order_ref VARCHAR(100) NULL,
          provider_payload LONGTEXT NULL,
          target_proxy_ids TEXT NULL,
          note TEXT NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_proxy_orders_user_status (user_id, status),
          KEY idx_proxy_orders_kind_created (kind, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS proxy_items (
          id INT NOT NULL AUTO_INCREMENT,
          user_id INT NOT NULL,
          order_id INT NULL,
          provider_proxy_id VARCHAR(100) NOT NULL,
          package_id VARCHAR(64) NULL,
          package_name VARCHAR(255) NULL,
          location VARCHAR(64) NULL,
          proxy_type VARCHAR(64) NULL,
          protocol VARCHAR(20) NULL,
          ip_address VARCHAR(120) NULL,
          port INT NULL,
          username VARCHAR(255) NULL,
          password VARCHAR(255) NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'active',
          expired_at DATETIME NULL,
          provider_created_at DATETIME NULL,
          last_synced_at DATETIME NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uniq_provider_proxy_id (provider_proxy_id),
          KEY idx_proxy_items_user_status (user_id, status),
          KEY idx_proxy_items_order (order_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    } catch (error) {
      proxyTablesPromise = null;
      throw new Error(
        error instanceof Error
          ? `Không thể khởi tạo bảng proxy: ${error.message}`
          : 'Không thể khởi tạo bảng proxy'
      );
    }
  })();

  return proxyTablesPromise;
}

async function readSettingsMap() {
  const rows = await db.settings.findMany({
    where: {
      setting_key: {
        in: Object.values(PROXY_SETTINGS_KEYS),
      },
    },
    select: {
      setting_key: true,
      setting_value: true,
    },
  }).catch(() => []);

  return rows.reduce<Record<string, string>>((acc, row) => {
    acc[row.setting_key] = row.setting_value || '';
    return acc;
  }, {});
}

export async function getProxyServiceSettings(): Promise<ProxyServiceSettings> {
  const settings = await readSettingsMap();
  const token = String(process.env.PROXY_VNCLOUD_TOKEN || '').trim();
  const baseUrl = String(process.env.PROXY_VNCLOUD_BASE_URL || DEFAULT_PROXY_BASE_URL).trim().replace(/\/+$/, '');
  const packagePricing = safeJsonParse<Record<string, ProxyPricingRule>>(
    settings[PROXY_SETTINGS_KEYS.packagePricing] || '{}',
    {}
  );

  const rawServiceNote = String(settings[PROXY_SETTINGS_KEYS.serviceNote] || '').trim();
  const resolvedServiceNote =
    !rawServiceNote || DEPRECATED_PROXY_SERVICE_NOTES.has(rawServiceNote)
      ? DEFAULT_PROXY_SETTINGS.serviceNote
      : rawServiceNote;

  return {
    serviceStatus: settings[PROXY_SETTINGS_KEYS.serviceStatus] || DEFAULT_PROXY_SETTINGS.serviceStatus,
    serviceName: settings[PROXY_SETTINGS_KEYS.serviceName] || DEFAULT_PROXY_SETTINGS.serviceName,
    serviceDescription: settings[PROXY_SETTINGS_KEYS.serviceDescription] || DEFAULT_PROXY_SETTINGS.serviceDescription,
    serviceNote: resolvedServiceNote,
    defaultProtocol: normalizeProtocol(
      settings[PROXY_SETTINGS_KEYS.defaultProtocol] || DEFAULT_PROXY_SETTINGS.defaultProtocol
    ) as 'HTTP' | 'SOCKS5',
    priceMultiplier: Math.max(1, toNumber(settings[PROXY_SETTINGS_KEYS.priceMultiplier], DEFAULT_PROXY_SETTINGS.priceMultiplier)),
    envConfigured: Boolean(token),
    baseUrl,
    maskedToken: token ? maskToken(token) : '',
    packagePricing,
  };
}

async function saveProxyServiceSettings(input: ProxyAdminSaveInput) {
  const current = await getProxyServiceSettings();
  const nextValues: Record<string, string> = {
    [PROXY_SETTINGS_KEYS.serviceStatus]:
      input.serviceStatus === 'maintenance' ? 'maintenance' : (input.serviceStatus || current.serviceStatus || 'active'),
    [PROXY_SETTINGS_KEYS.serviceName]: String(input.serviceName || current.serviceName || '').trim() || DEFAULT_PROXY_SETTINGS.serviceName,
    [PROXY_SETTINGS_KEYS.serviceDescription]:
      String(input.serviceDescription || current.serviceDescription || '').trim() || DEFAULT_PROXY_SETTINGS.serviceDescription,
    [PROXY_SETTINGS_KEYS.serviceNote]:
      typeof input.serviceNote === 'string'
        ? String(input.serviceNote).trim()
        : String(current.serviceNote || '').trim(),
    [PROXY_SETTINGS_KEYS.defaultProtocol]: normalizeProtocol(
      String(input.defaultProtocol || current.defaultProtocol || DEFAULT_PROXY_SETTINGS.defaultProtocol)
    ),
    [PROXY_SETTINGS_KEYS.priceMultiplier]: String(
      Math.max(1, toNumber(input.priceMultiplier, current.priceMultiplier || DEFAULT_PROXY_SETTINGS.priceMultiplier))
    ),
    [PROXY_SETTINGS_KEYS.packagePricing]: JSON.stringify(input.packagePricing || current.packagePricing || {}),
  };

  await db.$transaction(async (tx) => {
    for (const [settingKey, settingValue] of Object.entries(nextValues)) {
      const updated = await tx.settings.updateMany({
        where: { setting_key: settingKey },
        data: {
          setting_value: settingValue,
          updated_at: new Date(),
        },
      });

      if (!updated.count) {
        await tx.settings.create({
          data: {
            setting_key: settingKey,
            setting_value: settingValue,
          },
        });
      }
    }
  });

  invalidateLegacySettingsCache();
  return getProxyServiceSettings();
}

function ensureProviderConfigured(settings: ProxyServiceSettings) {
  if (!settings.envConfigured) {
    throw new Error('Thiếu PROXY_VNCLOUD_TOKEN trong env');
  }

  return {
    baseUrl: settings.baseUrl,
    token: String(process.env.PROXY_VNCLOUD_TOKEN || '').trim(),
  };
}

async function providerRequest<T>(
  path: string,
  init?: { method?: 'GET' | 'POST'; query?: Record<string, string>; body?: Record<string, unknown> },
  options?: { unwrapData?: boolean }
) {
  const settings = await getProxyServiceSettings();
  const config = ensureProviderConfigured(settings);
  const url = new URL(`${config.baseUrl}${path.startsWith('/') ? path : `/${path}`}`);

  if (init?.query) {
    for (const [key, value] of Object.entries(init.query)) {
      if (String(value || '').trim()) {
        url.searchParams.set(key, value);
      }
    }
  }

  const response = await fetch(url.toString(), {
    method: init?.method || 'GET',
    cache: 'no-store',
    headers: {
      'X-Api-Token': config.token,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: init?.method === 'POST' ? JSON.stringify(init.body || {}) : undefined,
    signal: AbortSignal.timeout(Number(process.env.PROXY_VNCLOUD_TIMEOUT_MS || 15000)),
  });

  const rawText = await response.text();
  let payload: Record<string, unknown> | null = null;
  try {
    payload = rawText ? JSON.parse(rawText) as Record<string, unknown> : {};
  } catch {
    const debugMessage = buildVendorResponseDebugMessage(response, rawText);
    const trimmed = rawText.trim();
    if (!trimmed) {
      throw new Error(`Proxy vendor không trả dữ liệu. ${debugMessage}`);
    }
    if (trimmed.startsWith('<')) {
      throw new Error(
        `Proxy vendor trả về HTML thay vì JSON. ${debugMessage}`
      );
    }
    throw new Error(`Proxy vendor trả về JSON không hợp lệ. ${debugMessage}`);
  }

  const statusValue = String(payload?.status || '').toLowerCase();
  const successValue =
    typeof payload?.success === 'boolean'
      ? payload.success
      : statusValue === 'success';

  if (!response.ok || !successValue) {
    const message =
      String(payload?.message || payload?.error || '').trim() ||
      `Proxy vendor xử lý thất bại (HTTP ${response.status})`;
    throw new Error(message);
  }

  if (options?.unwrapData === false) {
    return payload as T;
  }

  return payload?.data as T;
}

async function getProviderPackages() {
  if (providerPackagesCache && providerPackagesCache.expiresAt > Date.now()) {
    return providerPackagesCache.data;
  }

  const data = await providerRequest<ProviderPackagePayload[]>('/packages');
  const packages = Array.isArray(data) ? data : [];
  providerPackagesCache = {
    expiresAt: Date.now() + 60 * 1000,
    data: packages,
  };

  return packages;
}

async function getProviderProfile() {
  if (providerProfileCache && providerProfileCache.expiresAt > Date.now()) {
    return providerProfileCache.data;
  }

  try {
    const payload = await providerRequest<Record<string, unknown>>('/profile');
    const profile: ProxyProviderProfile = {
      name: String(payload?.name || ''),
      email: String(payload?.email || ''),
      role: String(payload?.role || ''),
      cash: toNumber(payload?.cash, 0),
      discount: toNumber(payload?.discount, 0),
    };
    providerProfileCache = {
      expiresAt: Date.now() + 60 * 1000,
      data: profile,
    };
    return profile;
  } catch {
    providerProfileCache = {
      expiresAt: Date.now() + 15 * 1000,
      data: null,
    };
    return null;
  }
}

function mapPackageRecord(input: ProviderPackagePayload, rules: Record<string, ProxyPricingRule>, multiplier: number) {
  const id = normalizePackageId(input.id);
  const location = normalizeLocation(input.location || input.type || '');
  const durationDays = Math.max(1, Math.trunc(toNumber(input.duration_days, 1)));
  const minDays = Math.max(1, Math.trunc(toNumber(input.min_days, durationDays)));
  const maxQuantity = Math.max(1, Math.trunc(toNumber(input.max_quantity, 1)));
  const providerPrice = Math.max(0, toNumber(input.price, 0));
  const providerDailyPrice = providerPrice > 0 ? providerPrice / Math.max(durationDays, 1) : 0;
  const suggestedPricePerDay = Math.max(0, Math.ceil(providerDailyPrice * Math.max(multiplier, 1)));
  const rule = rules[id] || {};
  const sellPricePerDay = Math.max(0, Math.ceil(toNumber(rule.sellPricePerDay, suggestedPricePerDay)));
  const renewPricePerDay = Math.max(0, Math.ceil(toNumber(rule.renewPricePerDay, sellPricePerDay)));

  return {
    id,
    location,
    name: String(input.name || `Package #${id}`),
    type: String(input.type || input.location || 'residential'),
    durationDays,
    minDays,
    maxQuantity,
    providerPrice,
    providerDailyPrice,
    suggestedPricePerDay,
    sellPricePerDay,
    renewPricePerDay,
    enabled: rule.enabled !== false,
    label: String(rule.label || ''),
    note: String(rule.note || ''),
  } satisfies ProxyPackageRecord;
}

export async function listProxyPackages() {
  const settings = await getProxyServiceSettings();
  const packages = await getProviderPackages();

  return packages
    .map((item) => mapPackageRecord(item, settings.packagePricing, settings.priceMultiplier))
    .filter((item) => Boolean(item.id))
    .sort((left, right) => {
      if (left.location !== right.location) {
        return left.location.localeCompare(right.location);
      }
      return left.sellPricePerDay - right.sellPricePerDay;
    });
}

async function listProxyOrders(whereUserId?: number) {
  await ensureProxyTables();
  const values: unknown[] = [];
  const where = [];

  if (whereUserId) {
    where.push('user_id = ?');
    values.push(whereUserId);
  }

  const rows = await safeRows<Row>(
    `
      SELECT
        id,
        kind,
        status,
        package_id,
        package_name,
        location,
        proxy_type,
        protocol,
        days,
        quantity,
        unit_price,
        total_price,
        target_proxy_ids,
        note,
        created_at,
        updated_at
      FROM proxy_orders
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY created_at DESC, id DESC
      LIMIT 120
    `,
    ...values
  );

  return rows.map((row) => ({
    id: Number(row.id || 0),
    kind: String(row.kind || 'buy') === 'renew' ? 'renew' : 'buy',
    status: String(row.status || 'pending'),
    packageId: String(row.package_id || ''),
    packageName: String(row.package_name || ''),
    location: String(row.location || ''),
    proxyType: String(row.proxy_type || ''),
    protocol: String(row.protocol || ''),
    days: Math.max(0, Math.trunc(toNumber(row.days, 0))),
    quantity: Math.max(0, Math.trunc(toNumber(row.quantity, 0))),
    unitPrice: toNumber(row.unit_price, 0),
    totalPrice: toNumber(row.total_price, 0),
    targetProxyIds: String(row.target_proxy_ids || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    note: String(row.note || ''),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  })) satisfies ProxyOrderSummary[];
}

async function listProxyItems(whereUserId?: number) {
  await ensureProxyTables();
  const values: unknown[] = [];
  const where = [];

  if (whereUserId) {
    where.push('user_id = ?');
    values.push(whereUserId);
  }

  const rows = await safeRows<Row>(
    `
      SELECT
        id,
        order_id,
        provider_proxy_id,
        package_id,
        package_name,
        location,
        proxy_type,
        protocol,
        ip_address,
        port,
        username,
        password,
        status,
        expired_at,
        provider_created_at,
        last_synced_at,
        created_at,
        updated_at
      FROM proxy_items
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY COALESCE(expired_at, created_at) ASC, id DESC
      LIMIT 500
    `,
    ...values
  );

  return rows.map((row) => ({
    id: Number(row.id || 0),
    orderId: row.order_id ? Number(row.order_id) : null,
    providerProxyId: String(row.provider_proxy_id || ''),
    packageId: String(row.package_id || ''),
    packageName: String(row.package_name || ''),
    location: String(row.location || ''),
    proxyType: String(row.proxy_type || ''),
    protocol: String(row.protocol || ''),
    ipAddress: String(row.ip_address || ''),
    port: Math.max(0, Math.trunc(toNumber(row.port, 0))),
    username: String(row.username || ''),
    password: String(row.password || ''),
    status: String(row.status || 'active'),
    expiredAt: String(row.expired_at || ''),
    providerCreatedAt: String(row.provider_created_at || ''),
    lastSyncedAt: String(row.last_synced_at || ''),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  })) satisfies ProxyOwnedItem[];
}

function normalizeProviderProxy(
  item: ProviderProxyPayload,
  fallback: {
    packageId?: string;
    packageName?: string;
    location?: string;
    proxyType?: string;
    protocol?: string;
  } = {}
) {
  return {
    providerProxyId: String(item.id || '').trim(),
    packageId: fallback.packageId || '',
    packageName: fallback.packageName || '',
    location: normalizeLocation(fallback.location || item.type || ''),
    proxyType: String(item.type || fallback.proxyType || '').trim(),
    protocol: normalizeProtocol(fallback.protocol || 'HTTP'),
    ipAddress: String(item.ip_address || '').trim(),
    port: Math.max(0, Math.trunc(toNumber(item.port, 0))),
    username: String(item.username || '').trim(),
    password: String(item.password || '').trim(),
    status: String(item.status || 'active').trim() || 'active',
    expiredAt: databaseDateOrNull(item.expired_at),
    providerCreatedAt: databaseDateOrNull(item.created_at),
  };
}

async function upsertProxyItems(
  userId: number,
  orderId: number | null,
  items: Array<ReturnType<typeof normalizeProviderProxy>>,
  executor: Pick<typeof db, '$executeRawUnsafe'> = db
) {
  if (!items.length) {
    return;
  }

  for (const item of items) {
    await executor.$executeRawUnsafe(
      `
        INSERT INTO proxy_items (
          user_id,
          order_id,
          provider_proxy_id,
          package_id,
          package_name,
          location,
          proxy_type,
          protocol,
          ip_address,
          port,
          username,
          password,
          status,
          expired_at,
          provider_created_at,
          last_synced_at,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())
        ON DUPLICATE KEY UPDATE
          user_id = VALUES(user_id),
          order_id = VALUES(order_id),
          package_id = VALUES(package_id),
          package_name = VALUES(package_name),
          location = VALUES(location),
          proxy_type = VALUES(proxy_type),
          protocol = VALUES(protocol),
          ip_address = VALUES(ip_address),
          port = VALUES(port),
          username = VALUES(username),
          password = VALUES(password),
          status = VALUES(status),
          expired_at = VALUES(expired_at),
          provider_created_at = VALUES(provider_created_at),
          last_synced_at = NOW(),
          updated_at = NOW()
      `,
      userId,
      orderId,
      item.providerProxyId,
      item.packageId,
      item.packageName,
      item.location,
      item.proxyType,
      item.protocol,
      item.ipAddress,
      item.port,
      item.username,
      item.password,
      item.status,
      item.expiredAt,
      item.providerCreatedAt
    );
  }
}

async function getUserBalance(userId: number) {
  const user = await db.users.findUnique({
    where: { id: userId },
    select: {
      id: true,
      balance: true,
      username: true,
      status: true,
    },
  });

  if (!user || user.status !== 'active') {
    throw new Error('Không tìm thấy tài khoản người dùng hợp lệ');
  }

  return user;
}

async function fetchProviderProxyDetails(providerIds: string[], location: string) {
  if (!providerIds.length) {
    return {
      data: [],
      failed_ids: [],
    } satisfies ProviderListResponse;
  }

  const payload = await providerRequest<Record<string, unknown>>(
    '/proxies',
    {
      method: 'GET',
      query: {
        ids: providerIds.join(','),
        location,
      },
    },
    { unwrapData: false }
  );

  if (Array.isArray(payload?.data)) {
    return {
      data: payload.data as ProviderProxyPayload[],
      failed_ids: Array.isArray(payload?.failed_ids) ? payload.failed_ids as Array<string | number> : [],
    } satisfies ProviderListResponse;
  }

  return {
    data: [],
    failed_ids: Array.isArray(payload?.failed_ids) ? payload.failed_ids as Array<string | number> : [],
  } satisfies ProviderListResponse;
}

function collectRequestedIds(input: number[]) {
  return Array.from(new Set(input.map((item) => Math.trunc(item)).filter((item) => item > 0)));
}

export async function getProxyMarketplaceOverview(userId: number): Promise<ProxyMarketplaceOverview> {
  const settings = await getProxyServiceSettings();
  let packages: ProxyPackageRecord[] = [];
  let vendorError: string | null = null;

  if (settings.envConfigured) {
    try {
      packages = await listProxyPackages();
    } catch (error) {
      vendorError = getErrorMessage(error, 'Không thể tải package proxy từ vendor');
    }
  }

  const [proxies, orders] = await Promise.all([listProxyItems(userId), listProxyOrders(userId)]);
  const stats = buildStats(packages, proxies, orders);

  return {
    settings: {
      serviceStatus: settings.serviceStatus,
      serviceName: settings.serviceName,
      serviceDescription: settings.serviceDescription,
      serviceNote: settings.serviceNote,
      defaultProtocol: settings.defaultProtocol,
      priceMultiplier: settings.priceMultiplier,
      envConfigured: settings.envConfigured,
      baseUrl: settings.baseUrl,
    },
    packages,
    proxies,
    orders,
    stats,
    vendorError,
  };
}

export async function getProxyAdminDashboardData(): Promise<ProxyAdminDashboardData> {
  const settings = await getProxyServiceSettings();
  let packages: ProxyPackageRecord[] = [];
  let vendorError: string | null = null;

  if (settings.envConfigured) {
    try {
      packages = await listProxyPackages();
    } catch (error) {
      vendorError = getErrorMessage(error, 'Không thể tải package proxy từ vendor');
    }
  }

  const [profile, orders, proxies] = await Promise.all([
    settings.envConfigured ? getProviderProfile() : Promise.resolve(null),
    listProxyOrders(),
    listProxyItems(),
  ]);
  const stats = buildStats(packages, proxies, orders);

  return {
    settings,
    profile,
    packages,
    orders,
    stats: {
      ...stats,
      providerCash: toNumber(profile?.cash, 0),
      providerDiscount: toNumber(profile?.discount, 0),
    },
    vendorError,
  };
}

export async function saveProxyAdminSettings(input: ProxyAdminSaveInput) {
  return saveProxyServiceSettings(input);
}

export async function purchaseProxy(userId: number, input: {
  packageId: string;
  days: number;
  quantity: number;
  protocol?: string;
  username?: string;
  password?: string;
}) {
  await ensureProxyTables();
  const settings = await getProxyServiceSettings();

  if (settings.serviceStatus === 'maintenance') {
    throw new Error('Dịch vụ proxy đang bảo trì');
  }

  const packages = await listProxyPackages();
  const selectedPackage = packages.find((item) => item.id === normalizePackageId(input.packageId));

  if (!selectedPackage || !selectedPackage.enabled) {
    throw new Error('Gói proxy không tồn tại hoặc đang tạm ẩn');
  }

  const days = Math.max(1, Math.trunc(toNumber(input.days, selectedPackage.minDays)));
  const quantity = Math.max(1, Math.trunc(toNumber(input.quantity, 1)));

  if (days < selectedPackage.minDays) {
    throw new Error(`Gói này yêu cầu tối thiểu ${selectedPackage.minDays} ngày`);
  }

  if (quantity > selectedPackage.maxQuantity) {
    throw new Error(`Gói này chỉ cho phép tối đa ${selectedPackage.maxQuantity} proxy mỗi lần mua`);
  }
  const protocol = normalizeProtocol(input.protocol || settings.defaultProtocol);
  const username = String(input.username || 'random').trim() || 'random';
  const password = String(input.password || 'random').trim() || 'random';
  const unitPrice = selectedPackage.sellPricePerDay;
  const totalPrice = unitPrice * days * quantity;

  const pending = await db.$transaction(async (tx) => {
    const user = await tx.users.findUnique({
      where: { id: userId },
      select: { balance: true, username: true, status: true },
    });

    if (!user || user.status !== 'active') {
      throw new Error('Không tìm thấy người dùng');
    }

    const currentBalance = toNumber(user.balance, 0);
    const nextBalance = currentBalance - totalPrice;

    if (nextBalance < 0) {
      throw new Error('Số dư không đủ để mua proxy');
    }

    await tx.users.update({
      where: { id: userId },
      data: {
        balance: nextBalance,
        last_activity: new Date(),
      },
    });

    await tx.transactions.create({
      data: {
        user_id: userId,
        amount: totalPrice,
        balance_after: nextBalance,
        type: 'order',
        status: 'success',
        content: `Mua proxy ${selectedPackage.name} x${quantity} / ${days} ngày`,
      },
    }).catch(() => undefined);

    await tx.$executeRawUnsafe(
      `
        INSERT INTO proxy_orders (
          user_id,
          kind,
          status,
          package_id,
          package_name,
          location,
          proxy_type,
          protocol,
          days,
          quantity,
          unit_price,
          total_price,
          note,
          created_at,
          updated_at
        )
        VALUES (?, 'buy', 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `,
      userId,
      selectedPackage.id,
      selectedPackage.name,
      selectedPackage.location,
      selectedPackage.type,
      protocol,
      days,
      quantity,
      unitPrice,
      totalPrice,
      'Đang gửi yêu cầu sang vendor'
    );

    const inserted = await tx.$queryRawUnsafe<Array<{ id: number | bigint }>>(
      'SELECT LAST_INSERT_ID() AS id'
    );
    const orderId = Number(inserted[0]?.id || 0);

    await tx.activity_logs.create({
      data: {
        user_id: userId,
        activity: `Tạo đơn mua proxy #${orderId}`,
      },
    }).catch(() => undefined);

    return {
      orderId,
      totalPrice,
      quantity,
      nextBalance,
    };
  });

  try {
    const providerData = await providerRequest<ProviderProxyPayload[]>('/proxies/buy', {
      method: 'POST',
      body: {
        package_id: selectedPackage.id,
        days,
        quantity,
        protocol,
        username,
        password,
      },
    });

    const returnedItems = Array.isArray(providerData) ? providerData : [];
    const normalizedItems = returnedItems
      .map((item) =>
        normalizeProviderProxy(item, {
          packageId: selectedPackage.id,
          packageName: selectedPackage.name,
          location: selectedPackage.location,
          proxyType: selectedPackage.type,
          protocol,
        })
      )
      .filter((item) => item.providerProxyId);

    const successCount = normalizedItems.length;
    const successTotal = unitPrice * days * successCount;
    const refundAmount = Math.max(0, totalPrice - successTotal);
    const finalStatus = successCount === quantity ? 'completed' : successCount > 0 ? 'partial' : 'failed';

    await db.$transaction(async (tx) => {
      if (normalizedItems.length) {
        await upsertProxyItems(userId, pending.orderId, normalizedItems, tx);
      }

      await tx.$executeRawUnsafe(
        `
          UPDATE proxy_orders
          SET status = ?,
              quantity = ?,
              total_price = ?,
              provider_payload = ?,
              note = ?,
              updated_at = NOW()
          WHERE id = ?
        `,
        finalStatus,
        successCount,
        successTotal,
        JSON.stringify(returnedItems),
        successCount === quantity
          ? 'Mua proxy thành công'
          : successCount > 0
            ? `Mua thành công ${successCount}/${quantity} proxy`
            : 'Vendor không trả về proxy hợp lệ',
        pending.orderId
      );

      if (refundAmount > 0) {
        const currentUser = await tx.users.findUnique({
          where: { id: userId },
          select: { balance: true },
        });
        const refundedBalance = toNumber(currentUser?.balance, 0) + refundAmount;

        await tx.users.update({
          where: { id: userId },
          data: {
            balance: refundedBalance,
            last_activity: new Date(),
          },
        });

        await tx.transactions.create({
          data: {
            user_id: userId,
            amount: refundAmount,
            balance_after: refundedBalance,
            type: 'refund',
            status: 'success',
            content: `Hoàn tiền mua proxy #${pending.orderId}`,
          },
        }).catch(() => undefined);
      }
    });

    if (!successCount) {
      throw new Error('Vendor không trả về proxy hợp lệ');
    }

    return {
      orderId: pending.orderId,
      successCount,
      requestedQuantity: quantity,
      totalPrice: successTotal,
      refundedAmount: refundAmount,
      balanceAfter: pending.nextBalance + refundAmount,
      status: finalStatus,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể mua proxy';

    await db.$transaction(async (tx) => {
      const currentUser = await tx.users.findUnique({
        where: { id: userId },
        select: { balance: true },
      });
      const refundedBalance = toNumber(currentUser?.balance, 0) + totalPrice;

      await tx.users.update({
        where: { id: userId },
        data: {
          balance: refundedBalance,
          last_activity: new Date(),
        },
      });

      await tx.transactions.create({
        data: {
          user_id: userId,
          amount: totalPrice,
          balance_after: refundedBalance,
          type: 'refund',
          status: 'success',
          content: `Hoàn tiền lỗi mua proxy #${pending.orderId}`,
        },
      }).catch(() => undefined);

      await tx.$executeRawUnsafe(
        `
          UPDATE proxy_orders
          SET status = 'failed',
              note = ?,
              updated_at = NOW()
          WHERE id = ?
        `,
        message,
        pending.orderId
      ).catch(() => undefined);
    });

    throw new Error(message);
  }
}

async function resolveOwnedItems(userId: number, ids: number[]) {
  const selectedIds = collectRequestedIds(ids);
  if (!selectedIds.length) {
    throw new Error('Bạn chưa chọn proxy nào');
  }

  await ensureProxyTables();
  const placeholders = selectedIds.map(() => '?').join(', ');
  const rows = await safeRows<Row>(
    `
      SELECT
        id,
        provider_proxy_id,
        package_id,
        package_name,
        location,
        proxy_type,
        protocol,
        ip_address,
        port,
        username,
        password,
        status,
        expired_at,
        provider_created_at
      FROM proxy_items
      WHERE user_id = ?
        AND id IN (${placeholders})
    `,
    userId,
    ...selectedIds
  );

  if (!rows.length) {
    throw new Error('Không tìm thấy proxy thuộc tài khoản của bạn');
  }

  return rows.map((row) => ({
    id: Number(row.id || 0),
    providerProxyId: String(row.provider_proxy_id || ''),
    packageId: String(row.package_id || ''),
    packageName: String(row.package_name || ''),
    location: String(row.location || ''),
    proxyType: String(row.proxy_type || ''),
    protocol: String(row.protocol || ''),
    ipAddress: String(row.ip_address || ''),
    port: Math.max(0, Math.trunc(toNumber(row.port, 0))),
    username: String(row.username || ''),
    password: String(row.password || ''),
    status: String(row.status || ''),
    expiredAt: String(row.expired_at || ''),
    providerCreatedAt: String(row.provider_created_at || ''),
  }));
}

function groupByLocation(items: Awaited<ReturnType<typeof resolveOwnedItems>>) {
  const map = new Map<string, typeof items>();
  for (const item of items) {
    const key = normalizeLocation(item.location || item.proxyType || 'residential') || 'residential';
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(item);
  }
  return Array.from(map.entries());
}

export async function renewProxy(userId: number, input: ProxyActionInput) {
  await ensureProxyTables();
  const items = await resolveOwnedItems(userId, input.ids);
  const days = Math.max(1, Math.trunc(toNumber(input.days, 1)));
  const packages = await listProxyPackages();
  const packageMap = new Map(packages.map((item) => [item.id, item]));

  const totalPrice = items.reduce((sum, item) => {
    const pack = packageMap.get(item.packageId);
    return sum + (pack?.renewPricePerDay || 0) * days;
  }, 0);

  if (totalPrice <= 0) {
    throw new Error('Chưa cấu hình giá gia hạn cho các proxy đã chọn');
  }

  const firstItem = items[0];

  const pending = await db.$transaction(async (tx) => {
    const user = await tx.users.findUnique({
      where: { id: userId },
      select: { balance: true, status: true },
    });

    if (!user || user.status !== 'active') {
      throw new Error('Không tìm thấy người dùng');
    }

    const currentBalance = toNumber(user.balance, 0);
    const nextBalance = currentBalance - totalPrice;

    if (nextBalance < 0) {
      throw new Error('Số dư không đủ để gia hạn proxy');
    }

    await tx.users.update({
      where: { id: userId },
      data: {
        balance: nextBalance,
        last_activity: new Date(),
      },
    });

    await tx.transactions.create({
      data: {
        user_id: userId,
        amount: totalPrice,
        balance_after: nextBalance,
        type: 'order',
        status: 'success',
        content: `Gia hạn ${items.length} proxy / ${days} ngày`,
      },
    }).catch(() => undefined);

    await tx.$executeRawUnsafe(
      `
        INSERT INTO proxy_orders (
          user_id,
          kind,
          status,
          package_name,
          location,
          proxy_type,
          protocol,
          days,
          quantity,
          unit_price,
          total_price,
          target_proxy_ids,
          note,
          created_at,
          updated_at
        )
        VALUES (?, 'renew', 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `,
      userId,
      'Gia hạn proxy',
      firstItem.location,
      firstItem.proxyType,
      firstItem.protocol,
      days,
      items.length,
      Math.ceil(totalPrice / Math.max(items.length * days, 1)),
      totalPrice,
      items.map((item) => item.providerProxyId).join(','),
      'Đang gửi yêu cầu gia hạn'
    );

    const inserted = await tx.$queryRawUnsafe<Array<{ id: number | bigint }>>(
      'SELECT LAST_INSERT_ID() AS id'
    );
    return {
      orderId: Number(inserted[0]?.id || 0),
      balanceAfter: nextBalance,
    };
  });

  try {
    const updatedItems: Array<ReturnType<typeof normalizeProviderProxy>> = [];
    const failedProviderIds = new Set<string>();

    for (const [location, group] of groupByLocation(items)) {
      const payload = await providerRequest<Record<string, unknown>>(
        '/proxies/renew',
        {
          method: 'POST',
          body: {
            ids: group.map((item) => Number(item.providerProxyId)),
            days,
            location,
          },
        },
        { unwrapData: false }
      );

      const response = {
        data: Array.isArray(payload?.data) ? payload.data as ProviderProxyPayload[] : [],
        failed_ids: Array.isArray(payload?.failed_ids) ? payload.failed_ids as Array<string | number> : [],
      };

      const groupMap = new Map(group.map((item) => [item.providerProxyId, item]));
      for (const item of response.data || []) {
        const providerId = String(item.id || '').trim();
        const source = groupMap.get(providerId);
        if (!source) {
          continue;
        }
        updatedItems.push(normalizeProviderProxy(item, source));
      }

      for (const failedId of response.failed_ids || []) {
        failedProviderIds.add(String(failedId));
      }
    }

    const successIds = new Set(updatedItems.map((item) => item.providerProxyId));
    const successSourceItems = items.filter((item) => successIds.has(item.providerProxyId));
    const successTotal = successSourceItems.reduce((sum, item) => {
      const pack = packageMap.get(item.packageId);
      return sum + (pack?.renewPricePerDay || 0) * days;
    }, 0);
    const refundAmount = Math.max(0, totalPrice - successTotal);
    const finalStatus = successSourceItems.length === items.length ? 'completed' : successSourceItems.length > 0 ? 'partial' : 'failed';

    await db.$transaction(async (tx) => {
      if (updatedItems.length) {
        await upsertProxyItems(userId, null, updatedItems, tx);
      }

      await tx.$executeRawUnsafe(
        `
          UPDATE proxy_orders
          SET status = ?,
              quantity = ?,
              total_price = ?,
              provider_payload = ?,
              note = ?,
              updated_at = NOW()
          WHERE id = ?
        `,
        finalStatus,
        successSourceItems.length,
        successTotal,
        JSON.stringify(updatedItems),
        finalStatus === 'completed'
          ? 'Gia hạn proxy thành công'
          : finalStatus === 'partial'
            ? `Gia hạn thành công ${successSourceItems.length}/${items.length} proxy`
            : 'Không proxy nào gia hạn thành công',
        pending.orderId
      );

      if (refundAmount > 0) {
        const currentUser = await tx.users.findUnique({
          where: { id: userId },
          select: { balance: true },
        });
        const refundedBalance = toNumber(currentUser?.balance, 0) + refundAmount;

        await tx.users.update({
          where: { id: userId },
          data: {
            balance: refundedBalance,
            last_activity: new Date(),
          },
        });

        await tx.transactions.create({
          data: {
            user_id: userId,
            amount: refundAmount,
            balance_after: refundedBalance,
            type: 'refund',
            status: 'success',
            content: `Hoàn tiền gia hạn proxy #${pending.orderId}`,
          },
        }).catch(() => undefined);
      }
    });

    if (!successSourceItems.length) {
      throw new Error('Không proxy nào được gia hạn thành công');
    }

    return {
      orderId: pending.orderId,
      successCount: successSourceItems.length,
      refundedAmount: refundAmount,
      failedProviderIds: Array.from(failedProviderIds),
      balanceAfter: pending.balanceAfter + refundAmount,
      status: finalStatus,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể gia hạn proxy';

    await db.$transaction(async (tx) => {
      const currentUser = await tx.users.findUnique({
        where: { id: userId },
        select: { balance: true },
      });
      const refundedBalance = toNumber(currentUser?.balance, 0) + totalPrice;

      await tx.users.update({
        where: { id: userId },
        data: {
          balance: refundedBalance,
          last_activity: new Date(),
        },
      });

      await tx.transactions.create({
        data: {
          user_id: userId,
          amount: totalPrice,
          balance_after: refundedBalance,
          type: 'refund',
          status: 'success',
          content: `Hoàn tiền lỗi gia hạn proxy #${pending.orderId}`,
        },
      }).catch(() => undefined);

      await tx.$executeRawUnsafe(
        `
          UPDATE proxy_orders
          SET status = 'failed',
              note = ?,
              updated_at = NOW()
          WHERE id = ?
        `,
        message,
        pending.orderId
      ).catch(() => undefined);
    });

    throw new Error(message);
  }
}

async function refreshProxyItemsFromVendor(userId: number, items: Awaited<ReturnType<typeof resolveOwnedItems>>) {
  const refreshed: Array<ReturnType<typeof normalizeProviderProxy>> = [];
  const failedIds = new Set<string>();

  for (const [location, group] of groupByLocation(items)) {
    const payload = await fetchProviderProxyDetails(
      group.map((item) => item.providerProxyId),
      location
    );
    const groupMap = new Map(group.map((item) => [item.providerProxyId, item]));

    for (const detail of payload.data || []) {
      const providerId = String(detail.id || '').trim();
      const source = groupMap.get(providerId);
      if (!source) {
        continue;
      }
      refreshed.push(normalizeProviderProxy(detail, source));
    }

    for (const failedId of payload.failed_ids || []) {
      failedIds.add(String(failedId));
    }
  }

  if (refreshed.length) {
    await upsertProxyItems(userId, null, refreshed);
  }

  return {
    refreshedCount: refreshed.length,
    failedProviderIds: Array.from(failedIds),
  };
}

export async function syncProxyIp(userId: number, input: ProxyActionInput) {
  await ensureProxyTables();
  const items = await resolveOwnedItems(userId, input.ids);

  for (const [location, group] of groupByLocation(items)) {
    await providerRequest<Record<string, unknown>>('/proxies/sync-ip', {
      method: 'POST',
      body: {
        ids: group.map((item) => Number(item.providerProxyId)),
        location,
      },
    });
  }

  return refreshProxyItemsFromVendor(userId, items);
}

export async function updateProxySecurity(userId: number, input: ProxyActionInput) {
  await ensureProxyTables();
  const items = await resolveOwnedItems(userId, input.ids);
  const username = String(input.username || 'random').trim() || 'random';
  const password = String(input.password || 'random').trim() || 'random';

  for (const [location, group] of groupByLocation(items)) {
    await providerRequest<Record<string, unknown>>('/proxies/update-security', {
      method: 'POST',
      body: {
        ids: group.map((item) => Number(item.providerProxyId)),
        username,
        password,
        location,
      },
    });
  }

  return refreshProxyItemsFromVendor(userId, items);
}

export async function runProxyUserAction(userId: number, body: Record<string, unknown>) {
  const action = String(body.action || '').trim();

  if (action === 'buy') {
    return purchaseProxy(userId, {
      packageId: String(body.packageId || ''),
      days: toNumber(body.days, 0),
      quantity: toNumber(body.quantity, 1),
      protocol: String(body.protocol || ''),
      username: String(body.username || ''),
      password: String(body.password || ''),
    });
  }

  if (action === 'renew') {
    return renewProxy(userId, {
      ids: Array.isArray(body.ids) ? body.ids.map((item) => Number(item || 0)) : [],
      days: toNumber(body.days, 1),
    });
  }

  if (action === 'sync-ip') {
    return syncProxyIp(userId, {
      ids: Array.isArray(body.ids) ? body.ids.map((item) => Number(item || 0)) : [],
    });
  }

  if (action === 'update-security') {
    return updateProxySecurity(userId, {
      ids: Array.isArray(body.ids) ? body.ids.map((item) => Number(item || 0)) : [],
      username: String(body.username || ''),
      password: String(body.password || ''),
    });
  }

  throw new Error('Action proxy không hợp lệ');
}
