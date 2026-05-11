import 'server-only';

import { randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getGameAccountThumbnailUrl } from '@/lib/game-account-media';
import { getGameMarketCategoryMeta } from '@/lib/game-market-config';
import { purchaseGameItem } from '@/lib/game-market-actions';
import { getGameMarketGalleryUrls, parseGameMarketImageRefs } from '@/lib/game-market-media';
import { getLegacySettingsMap, getVatPercent } from '@/lib/legacy-settings';
import { buildPublicAssetUrl } from '@/lib/public-asset-url';
import { hideProviderBranding } from '@/lib/provider-branding';
import { cleanResourceHtml, resourceHtmlToText } from '@/lib/resource-content';
import { purchaseResource } from '@/lib/resource-actions';
import { toNumber } from '@/lib/utils';

type Row = Record<string, unknown>;
type GameResourceCollection = 'game-accounts' | 'random-game-accounts';
type GameApiKeyStatus = 'active' | 'inactive';
type CompatProductKind = 'resource' | 'market';

interface GameApiAccountRow extends Row {
  key_id: number;
  user_id: number;
  username: string;
  email: string;
  fullname: string | null;
  role: string | null;
  user_status: string | null;
  game_balance: unknown;
  api_key: string;
  api_status: string;
  last_used_at?: string | Date | null;
  last_used_ip?: string | null;
  created_at?: string | Date | null;
  updated_at?: string | Date | null;
}

let ensureSchemaPromise: Promise<void> | null = null;

function normalizeRow<T extends Row>(row: T): T {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => {
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
  const rows = await db.$queryRawUnsafe<T[]>(query, ...values);
  return rows.map(normalizeRow);
}

async function safeOne<T extends Row>(query: string, ...values: unknown[]) {
  const rows = await safeRows<T>(query, ...values);
  return rows[0] || null;
}

async function getTableColumns(table: string) {
  try {
    const rows = await db.$queryRawUnsafe<Array<{ Field: string }>>(`SHOW COLUMNS FROM \`${table}\``);
    return new Set(rows.map((row) => String(row.Field || '')));
  } catch {
    return new Set<string>();
  }
}

async function addColumnIfMissing(table: string, column: string, sqlDefinition: string) {
  const columns = await getTableColumns(table);
  if (columns.has(column)) {
    return;
  }

  await db.$executeRawUnsafe(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${sqlDefinition}`);
}

async function ensureGameApiKeySchema() {
  if (!ensureSchemaPromise) {
    ensureSchemaPromise = (async () => {
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS game_api_keys (
          id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          api_key VARCHAR(96) NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'active',
          note VARCHAR(255) NULL,
          last_used_at DATETIME NULL,
          last_used_ip VARCHAR(45) NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_game_api_keys_user (user_id),
          UNIQUE KEY uniq_game_api_keys_key (api_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      await addColumnIfMissing('game_api_keys', 'status', `VARCHAR(20) NOT NULL DEFAULT 'active' AFTER \`api_key\``);
      await addColumnIfMissing('game_api_keys', 'note', `VARCHAR(255) NULL AFTER \`status\``);
      await addColumnIfMissing('game_api_keys', 'last_used_at', `DATETIME NULL AFTER \`note\``);
      await addColumnIfMissing('game_api_keys', 'last_used_ip', `VARCHAR(45) NULL AFTER \`last_used_at\``);
      await addColumnIfMissing('game_api_keys', 'created_at', `DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER \`last_used_ip\``);
      await addColumnIfMissing('game_api_keys', 'updated_at', `DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER \`created_at\``);
    })().catch((error) => {
      ensureSchemaPromise = null;
      throw error;
    });
  }

  await ensureSchemaPromise;
}

function isDuplicateError(error: unknown) {
  return error instanceof Error && /duplicate entry/i.test(error.message);
}

function buildGameApiKey() {
  return `ttmmo_game_${randomBytes(24).toString('hex')}`;
}

function normalizeGameApiKeyStatus(value: unknown): GameApiKeyStatus {
  return String(value || '').trim().toLowerCase() === 'inactive' ? 'inactive' : 'active';
}

function getRequestIp(req: NextRequest) {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')?.trim()
    || 'unknown'
  );
}

async function selectGameApiAccountByUserId(userId: number) {
  await ensureGameApiKeySchema();
  return safeOne<GameApiAccountRow>(
    `
      SELECT
        g.id AS key_id,
        g.user_id,
        g.api_key,
        g.status AS api_status,
        g.note,
        g.last_used_at,
        g.last_used_ip,
        g.created_at,
        g.updated_at,
        u.username,
        u.email,
        u.fullname,
        u.role,
        u.status AS user_status,
        u.game_balance
      FROM game_api_keys g
      INNER JOIN users u ON u.id = g.user_id
      WHERE g.user_id = ?
      LIMIT 1
    `,
    userId
  );
}

async function selectGameApiAccountByKey(apiKey: string) {
  await ensureGameApiKeySchema();
  return safeOne<GameApiAccountRow>(
    `
      SELECT
        g.id AS key_id,
        g.user_id,
        g.api_key,
        g.status AS api_status,
        g.note,
        g.last_used_at,
        g.last_used_ip,
        g.created_at,
        g.updated_at,
        u.username,
        u.email,
        u.fullname,
        u.role,
        u.status AS user_status,
        u.game_balance
      FROM game_api_keys g
      INNER JOIN users u ON u.id = g.user_id
      WHERE g.api_key = ?
      LIMIT 1
    `,
    apiKey
  );
}

async function insertGameApiKey(userId: number) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const apiKey = buildGameApiKey();
    try {
      await db.$executeRawUnsafe(
        `
          INSERT INTO game_api_keys (user_id, api_key, status, created_at, updated_at)
          VALUES (?, ?, 'active', NOW(), NOW())
        `,
        userId,
        apiKey
      );

      return selectGameApiAccountByUserId(userId);
    } catch (error) {
      if (isDuplicateError(error)) {
        const existing = await selectGameApiAccountByUserId(userId);
        if (existing) {
          return existing;
        }
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Không thể tạo API key cho user #${userId}`);
}

export async function ensureGameApiKeyForUser(userId: number) {
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new Error('User không hợp lệ để cấp API key');
  }

  const existing = await selectGameApiAccountByUserId(userId);
  if (existing) {
    return existing;
  }

  return insertGameApiKey(userId);
}

export async function provisionMissingGameApiKeys() {
  await ensureGameApiKeySchema();

  const rows = await safeRows<Array<{ id: number }> extends infer _T ? { id: number } : never>(
    `
      SELECT u.id
      FROM users u
      LEFT JOIN game_api_keys g ON g.user_id = u.id
      WHERE g.user_id IS NULL
      ORDER BY u.id ASC
    `
  );

  let created = 0;
  for (const row of rows) {
    const result = await ensureGameApiKeyForUser(Number(row.id || 0)).catch(() => null);
    if (result) {
      created += 1;
    }
  }

  return {
    missing_before: rows.length,
    created,
  };
}

export async function rotateGameApiKeyForUser(userId: number) {
  await ensureGameApiKeyForUser(userId);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const apiKey = buildGameApiKey();

    try {
      await db.$executeRawUnsafe(
        `
          UPDATE game_api_keys
          SET api_key = ?, status = 'active', updated_at = NOW()
          WHERE user_id = ?
        `,
        apiKey,
        userId
      );

      const updated = await selectGameApiAccountByUserId(userId);
      if (!updated) {
        throw new Error('Không đọc lại được API key sau khi rotate');
      }
      return updated;
    } catch (error) {
      if (isDuplicateError(error)) {
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Không thể rotate API key cho user #${userId}`);
}

export async function updateGameApiKeyStatus(userId: number, status: GameApiKeyStatus) {
  await ensureGameApiKeyForUser(userId);

  await db.$executeRawUnsafe(
    `
      UPDATE game_api_keys
      SET status = ?, updated_at = NOW()
      WHERE user_id = ?
    `,
    normalizeGameApiKeyStatus(status),
    userId
  );

  const updated = await selectGameApiAccountByUserId(userId);
  if (!updated) {
    throw new Error('Không tìm thấy API key sau khi cập nhật trạng thái');
  }

  return updated;
}

export function maskGameApiKey(apiKey: string) {
  const normalized = String(apiKey || '').trim();
  if (normalized.length <= 16) {
    return normalized;
  }
  return `${normalized.slice(0, 10)}...${normalized.slice(-8)}`;
}

export async function listAdminGameApiAccounts(input: {
  search?: string;
  page?: number;
  perPage?: number;
  syncMissing?: boolean;
}) {
  await ensureGameApiKeySchema();

  if (input.syncMissing) {
    await provisionMissingGameApiKeys();
  }

  const search = String(input.search || '').trim();
  const page = Math.max(1, Math.trunc(input.page || 1));
  const perPage = Math.min(100, Math.max(10, Math.trunc(input.perPage || 25)));
  const offset = (page - 1) * perPage;
  const values: unknown[] = [];
  const conditions: string[] = [];

  if (search) {
    conditions.push('(u.username LIKE ? OR u.email LIKE ? OR u.fullname LIKE ? OR CAST(u.id AS CHAR) = ?)');
    values.push(`%${search}%`, `%${search}%`, `%${search}%`, search);
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows, countRows, statsRows, catalogRows] = await Promise.all([
    safeRows<Row>(
      `
        SELECT
          u.id,
          u.username,
          u.email,
          u.fullname,
          u.role,
          u.status,
          u.game_balance,
          u.created_at,
          g.api_key,
          g.status AS api_status,
          g.note,
          g.last_used_at,
          g.last_used_ip,
          g.updated_at AS api_updated_at
        FROM users u
        LEFT JOIN game_api_keys g ON g.user_id = u.id
        ${whereSql}
        ORDER BY u.created_at DESC, u.id DESC
        LIMIT ? OFFSET ?
      `,
      ...values,
      perPage,
      offset
    ),
    safeRows<Array<{ total: number }> extends infer _T ? { total: number } : never>(
      `
        SELECT COUNT(*) AS total
        FROM users u
        ${whereSql}
      `,
      ...values
    ),
    safeRows<Row>(
      `
        SELECT
          (SELECT COUNT(*) FROM users) AS total_users,
          (SELECT COUNT(*) FROM game_api_keys WHERE status = 'active') AS active_keys,
          (SELECT COUNT(*) FROM game_api_keys WHERE status <> 'active') AS inactive_keys,
          (
            SELECT COUNT(*)
            FROM users u
            LEFT JOIN game_api_keys g ON g.user_id = u.id
            WHERE g.user_id IS NULL
          ) AS missing_keys
      `
    ),
    safeRows<Row>(
      `
        SELECT
          (SELECT COUNT(*) FROM mmo_resources WHERE COALESCE(is_deleted, 0) = 0 AND status IN ('active', 'out_of_stock') AND api_account_kind = 'game') AS game_accounts,
          (SELECT COUNT(*) FROM mmo_resources WHERE COALESCE(is_deleted, 0) = 0 AND status IN ('active', 'out_of_stock') AND api_account_kind = 'random') AS random_accounts,
          (SELECT COUNT(*) FROM game_market_items WHERE status = 'selling') AS market_items
      `
    ),
  ]);

  return {
    success: true,
    data: rows.map((row) => ({
      ...row,
      game_balance: toNumber(row.game_balance, 0),
      api_status: normalizeGameApiKeyStatus(row.api_status),
      api_key_masked: maskGameApiKey(String(row.api_key || '')),
    })),
    pagination: {
      page,
      per_page: perPage,
      total: Number(countRows[0]?.total || 0),
      total_pages: Math.max(1, Math.ceil(Number(countRows[0]?.total || 0) / perPage)),
    },
    stats: {
      total_users: Number(statsRows[0]?.total_users || 0),
      active_keys: Number(statsRows[0]?.active_keys || 0),
      inactive_keys: Number(statsRows[0]?.inactive_keys || 0),
      missing_keys: Number(statsRows[0]?.missing_keys || 0),
      game_accounts: Number(catalogRows[0]?.game_accounts || 0),
      random_accounts: Number(catalogRows[0]?.random_accounts || 0),
      market_items: Number(catalogRows[0]?.market_items || 0),
    },
  };
}

function getGameApiKeyFromAuthorizationHeader(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return '';
  }

  return normalized
    .replace(/^bearer\s+/i, '')
    .replace(/^apikey\s+/i, '')
    .trim();
}

function extractGameApiKey(req: NextRequest, body?: Record<string, unknown>) {
  const headerKey = String(req.headers.get('x-api-key') || '').trim();
  if (headerKey) {
    return headerKey;
  }

  const authorization = String(req.headers.get('authorization') || '').trim();
  if (authorization) {
    const authKey = getGameApiKeyFromAuthorizationHeader(authorization);
    if (authKey) {
      return authKey;
    }
  }

  const queryKey = String(
    req.nextUrl.searchParams.get('api_key')
    || req.nextUrl.searchParams.get('key')
    || ''
  ).trim();
  if (queryKey) {
    return queryKey;
  }

  const bodyKey = String(body?.api_key || body?.key || '').trim();
  return bodyKey;
}

export async function authenticateGameApiRequest(req: NextRequest, body?: Record<string, unknown>) {
  const apiKey = extractGameApiKey(req, body);
  if (!apiKey) {
    return {
      success: false as const,
      status: 401,
      message: 'Thiếu API key',
      account: null,
    };
  }

  let account: GameApiAccountRow | null = null;
  try {
    account = await selectGameApiAccountByKey(apiKey);
  } catch (error) {
    return {
      success: false as const,
      status: 503,
      message: error instanceof Error ? error.message : 'Không thể kiểm tra API key lúc này',
      account: null,
    };
  }

  if (!account) {
    return {
      success: false as const,
      status: 401,
      message: 'API key không hợp lệ',
      account: null,
    };
  }

  if (normalizeGameApiKeyStatus(account.api_status) !== 'active') {
    return {
      success: false as const,
      status: 403,
      message: 'API key đang bị tắt',
      account: null,
    };
  }

  if (String(account.user_status || '').trim().toLowerCase() !== 'active') {
    return {
      success: false as const,
      status: 403,
      message: 'Tài khoản API hiện không hoạt động',
      account: null,
    };
  }

  await db.$executeRawUnsafe(
    `
      UPDATE game_api_keys
      SET last_used_at = NOW(), last_used_ip = ?, updated_at = NOW()
      WHERE id = ?
    `,
    getRequestIp(req),
    account.key_id
  ).catch(() => undefined);

  return {
    success: true as const,
    status: 200,
    message: 'OK',
    account: {
      keyId: Number(account.key_id || 0),
      userId: Number(account.user_id || 0),
      username: String(account.username || ''),
      email: String(account.email || ''),
      fullname: String(account.fullname || ''),
      role: String(account.role || 'member'),
      gameBalance: toNumber(account.game_balance, 0),
      apiKey: String(account.api_key || ''),
      apiStatus: normalizeGameApiKeyStatus(account.api_status),
    },
  };
}

function resolveResourceCollection(value: unknown): GameResourceCollection {
  return String(value || '').trim() === 'random-game-accounts'
    ? 'random-game-accounts'
    : 'game-accounts';
}

function resolveResourceCollectionFromKind(value: unknown): GameResourceCollection {
  return String(value || '').trim().toLowerCase() === 'random'
    ? 'random-game-accounts'
    : 'game-accounts';
}

function buildPagination(params: URLSearchParams) {
  const page = Math.max(1, Math.trunc(toNumber(params.get('page'), 1)));
  const perPage = Math.min(100, Math.max(1, Math.trunc(toNumber(params.get('per_page'), 24))));
  return {
    page,
    perPage,
    offset: (page - 1) * perPage,
  };
}

function parseStringList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }

  const text = String(value || '').trim();
  if (!text) {
    return [];
  }

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item || '').trim()).filter(Boolean);
    }
  } catch {
    return text
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function formatExternalResource(row: Row, vatPercent: number) {
  const apiKind = String(row.api_account_kind || 'game').trim().toLowerCase();
  const collection = resolveResourceCollectionFromKind(apiKind);
  const basePrice = toNumber(row.price, 0);
  const originalBasePrice = toNumber(row.original_price, 0);
  const displayPrice = Math.round(basePrice * (1 + (vatPercent / 100)));
  const originalDisplayPrice = originalBasePrice > 0
    ? Math.round(originalBasePrice * (1 + (vatPercent / 100)))
    : 0;
  const title = hideProviderBranding(row.title, `Sản phẩm #${String(row.id || '')}`);
  const category = hideProviderBranding(row.category, 'Tài khoản game');
  const categoryName = hideProviderBranding(row.category_name || row.category, category);
  const descriptionHtml = cleanResourceHtml(row.description, 'Sản phẩm game đang được bán trên hệ thống.');
  const contentSource = String(row.product_content || row.content || '').trim();
  const contentHtml = cleanResourceHtml(contentSource);
  const thumbnail = getGameAccountThumbnailUrl({
    title: row.title,
    category: row.category,
    categoryName: row.category_name,
    tags: row.tags,
    description: row.description,
    customBadge: row.custom_badge,
    primary: row.thumbnail,
    fallback: row.category_image,
  });

  return {
    id: Number(row.id || 0),
    product_code: String(row.product_code || ''),
    collection,
    api_account_kind: apiKind === 'random' ? 'random' : 'game',
    title,
    category,
    category_id: Number(row.category_id || 0),
    category_name: categoryName,
    category_slug: String(row.category_slug || ''),
    status: String(row.status || 'active'),
    price: displayPrice,
    base_price: basePrice,
    original_price: originalDisplayPrice,
    original_base_price: originalBasePrice,
    vat_percent: vatPercent,
    thumbnail: thumbnail || buildPublicAssetUrl(String(row.thumbnail || '').trim()) || '',
    images: (thumbnail ? [thumbnail] : []).filter(Boolean),
    resource_type: String(row.resource_type || ''),
    stock: toNumber(row.stock, 0),
    sold_count: toNumber(row.sold_count, 0),
    tags: String(row.tags || ''),
    custom_badge: hideProviderBranding(row.custom_badge),
    description_html: descriptionHtml,
    description_text: resourceHtmlToText(descriptionHtml),
    content_html: contentHtml,
    content_text: resourceHtmlToText(contentHtml),
    product_note: String(row.product_note || '').trim(),
    provider_name: hideProviderBranding(row.provider_name),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function formatGameMarketItem(row: Row) {
  const categoryMeta = getGameMarketCategoryMeta(String(row.category || ''));
  const imageUrls = getGameMarketGalleryUrls({
    thumbnail: row.thumbnail,
    images: row.images,
  }, 6);

  return {
    id: Number(row.id || 0),
    code: String(row.code || ''),
    title: String(row.title || `Game #${String(row.id || '')}`),
    category: categoryMeta.slug,
    category_name: categoryMeta.label,
    category_description: categoryMeta.description,
    tag: String(row.tag || ''),
    badge: String(row.badge || ''),
    badge_color: String(row.badge_color || ''),
    status: String(row.status || 'selling'),
    price: Math.round(toNumber(row.price, 0)),
    original_price: Math.round(toNumber(row.original_price, 0)),
    stock: toNumber(row.stock, 0),
    prep_time: String(row.prep_time || ''),
    delivery_method: String(row.delivery_method || 'manual'),
    thumbnail: imageUrls[0] || buildPublicAssetUrl(String(row.thumbnail || '').trim()) || '',
    images: imageUrls,
    image_refs: parseGameMarketImageRefs(row.images),
    description: String(row.description || '').trim(),
    features: parseStringList(row.features),
    rank: String(row.rank || '').trim(),
    skins: String(row.skins || '').trim(),
    champs: String(row.champs || '').trim(),
    account_details: String(row.account_details || '').trim(),
    seller_id: Number(row.seller_id || 0),
    seller_username: String(row.seller_username || ''),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getGameApiAccountSummary(userId: number) {
  const account = await ensureGameApiKeyForUser(userId);

  return {
    user_id: Number(account.user_id || 0),
    username: String(account.username || ''),
    email: String(account.email || ''),
    fullname: String(account.fullname || ''),
    role: String(account.role || 'member'),
    game_balance: toNumber(account.game_balance, 0),
    api_status: normalizeGameApiKeyStatus(account.api_status),
    api_key_last_used_at: account.last_used_at || null,
    api_key_created_at: account.created_at || null,
  };
}

export async function listExternalGameResources(params: URLSearchParams) {
  const collection = resolveResourceCollection(params.get('collection'));
  const search = String(params.get('search') || '').trim();
  const category = String(params.get('category') || '').trim();
  const { page, perPage, offset } = buildPagination(params);
  const values: unknown[] = [];
  const conditions = [
    "r.status IN ('active', 'out_of_stock')",
    '(COALESCE(r.is_deleted, 0) = 0)',
    collection === 'random-game-accounts'
      ? "r.api_account_kind = 'random'"
      : "r.api_account_kind = 'game'",
  ];

  if (search) {
    conditions.push('(r.title LIKE ? OR r.description LIKE ? OR r.tags LIKE ? OR r.category LIKE ?)');
    values.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (category) {
    conditions.push('(r.category = ? OR rc.slug = ? OR rc.name = ? OR CAST(r.category_id AS CHAR) = ?)');
    values.push(category, category, category, category);
  }

  const whereSql = `WHERE ${conditions.join(' AND ')}`;
  const settings = await getLegacySettingsMap();
  const vatPercent = getVatPercent(settings);

  const [rows, countRows] = await Promise.all([
    safeRows<Row>(
      `
        SELECT
          r.id,
          r.product_code,
          r.title,
          r.description,
          r.price,
          r.original_price,
          r.thumbnail,
          r.resource_type,
          r.stock,
          r.sold_count,
          r.tags,
          r.custom_badge,
          r.category,
          r.category_id,
          r.api_account_kind,
          r.product_note,
          r.product_content,
          r.content,
          r.status,
          r.created_at,
          r.updated_at,
          rc.name AS category_name,
          rc.slug AS category_slug,
          rc.image AS category_image,
          ap.name AS provider_name
        FROM mmo_resources r
        LEFT JOIN resource_categories rc ON rc.id = r.category_id
        LEFT JOIN api_providers ap ON ap.id = CAST(COALESCE(r.api_provider_id, 0) AS UNSIGNED)
        ${whereSql}
        ORDER BY
          CASE WHEN COALESCE(r.stock, 0) > 0 THEN 0 ELSE 1 END ASC,
          COALESCE(r.is_pinned, 0) DESC,
          COALESCE(r.featured, 0) DESC,
          COALESCE(r.stock, 0) DESC,
          COALESCE(r.display_order, 0) ASC,
          r.created_at DESC,
          r.id DESC
        LIMIT ? OFFSET ?
      `,
      ...values,
      perPage,
      offset
    ),
    safeRows<Array<{ total: number }> extends infer _T ? { total: number } : never>(
      `
        SELECT COUNT(*) AS total
        FROM mmo_resources r
        LEFT JOIN resource_categories rc ON rc.id = r.category_id
        ${whereSql}
      `,
      ...values
    ),
  ]);

  return {
    success: true,
    data: rows.map((row) => formatExternalResource(row, vatPercent)),
    pagination: {
      page,
      per_page: perPage,
      total: Number(countRows[0]?.total || 0),
      total_pages: Math.max(1, Math.ceil(Number(countRows[0]?.total || 0) / perPage)),
    },
    meta: {
      collection,
      vat_percent: vatPercent,
    },
  };
}

export async function getExternalGameResourceDetail(resourceId: number) {
  const settings = await getLegacySettingsMap();
  const vatPercent = getVatPercent(settings);
  const row = await safeOne<Row>(
    `
      SELECT
        r.id,
        r.product_code,
        r.title,
        r.description,
        r.price,
        r.original_price,
        r.thumbnail,
        r.resource_type,
        r.stock,
        r.sold_count,
        r.tags,
        r.custom_badge,
        r.category,
        r.category_id,
        r.api_account_kind,
        r.product_note,
        r.product_content,
        r.content,
        r.status,
        r.created_at,
        r.updated_at,
        rc.name AS category_name,
        rc.slug AS category_slug,
        rc.image AS category_image,
        ap.name AS provider_name
      FROM mmo_resources r
      LEFT JOIN resource_categories rc ON rc.id = r.category_id
      LEFT JOIN api_providers ap ON ap.id = CAST(COALESCE(r.api_provider_id, 0) AS UNSIGNED)
      WHERE r.id = ?
        AND r.status IN ('active', 'out_of_stock')
        AND COALESCE(r.is_deleted, 0) = 0
        AND r.api_account_kind IN ('game', 'random')
      LIMIT 1
    `,
    resourceId
  );

  if (!row) {
    throw new Error('Không tìm thấy tài khoản game hoặc random game');
  }

  return {
    success: true,
    data: formatExternalResource(row, vatPercent),
  };
}

async function getExternalGameResourceOrderSnapshot(userId: number, orderId: number) {
  const settings = await getLegacySettingsMap();
  const vatPercent = getVatPercent(settings);
  const row = await safeOne<Row>(
    `
      SELECT
        o.id,
        o.user_id,
        o.resource_id,
        o.quantity,
        o.total_price,
        o.status,
        o.payment_method,
        o.download_count,
        o.max_downloads,
        o.expires_at,
        o.delivery_data,
        o.exported_at,
        o.is_exported,
        o.created_at,
        o.updated_at,
        r.title,
        r.product_code,
        r.price,
        r.original_price,
        r.thumbnail,
        r.api_account_kind,
        r.download_url,
        r.product_content,
        r.content
      FROM resource_orders o
      INNER JOIN mmo_resources r ON r.id = o.resource_id
      WHERE o.id = ?
        AND o.user_id = ?
        AND r.api_account_kind IN ('game', 'random')
      LIMIT 1
    `,
    orderId,
    userId
  );

  if (!row) {
    throw new Error('Không tìm thấy đơn tài khoản game/random');
  }

  const displayUnitPrice = Math.round(toNumber(row.price, 0) * (1 + (vatPercent / 100)));
  const thumbnail = getGameAccountThumbnailUrl({
    title: row.title,
    primary: row.thumbnail,
  });

  return {
    id: Number(row.id || 0),
    order_type: 'resource',
    collection: resolveResourceCollectionFromKind(row.api_account_kind),
    status: String(row.status || 'pending'),
    quantity: toNumber(row.quantity, 1),
    total_price: Math.round(toNumber(row.total_price, 0)),
    unit_price: displayUnitPrice,
    vat_percent: vatPercent,
    payment_method: String(row.payment_method || 'game_balance'),
    download_count: toNumber(row.download_count, 0),
    max_downloads: toNumber(row.max_downloads, 0),
    expires_at: row.expires_at,
    delivery_data: String(row.delivery_data || '').trim(),
    download_url: String(row.download_url || '').trim(),
    exported_at: row.exported_at,
    is_exported: Boolean(toNumber(row.is_exported, 0)),
    created_at: row.created_at,
    updated_at: row.updated_at,
    product: {
      id: Number(row.resource_id || 0),
      product_code: String(row.product_code || ''),
      title: hideProviderBranding(row.title, `Sản phẩm #${String(row.resource_id || '')}`),
      thumbnail: thumbnail || buildPublicAssetUrl(String(row.thumbnail || '').trim()) || '',
    },
  };
}

export async function createExternalGameResourceOrder(userId: number, input: {
  resourceId: number;
  quantity?: number;
}) {
  const resourceId = Math.max(1, Math.trunc(input.resourceId || 0));
  if (!resourceId) {
    throw new Error('Thiếu resource_id');
  }

  const resource = await safeOne<Row>(
    `
      SELECT id, api_account_kind
      FROM mmo_resources
      WHERE id = ?
        AND COALESCE(is_deleted, 0) = 0
      LIMIT 1
    `,
    resourceId
  );

  if (!resource || !['game', 'random'].includes(String(resource.api_account_kind || '').trim().toLowerCase())) {
    throw new Error('Resource này không thuộc nhóm tài khoản game/random cho API');
  }

  const purchase = await purchaseResource(userId, resourceId, Math.max(1, Math.trunc(input.quantity || 1)));
  const order = await getExternalGameResourceOrderSnapshot(userId, Number(purchase.orderId || 0));
  const summary = await getGameApiAccountSummary(userId);

  return {
    success: true,
    data: {
      purchase,
      order,
      account: summary,
    },
  };
}

export async function getExternalGameResourceOrder(userId: number, orderId: number) {
  return {
    success: true,
    data: await getExternalGameResourceOrderSnapshot(userId, orderId),
  };
}

export async function listExternalGameMarketItems(params: URLSearchParams) {
  const search = String(params.get('search') || '').trim();
  const category = String(params.get('category') || '').trim();
  const { page, perPage, offset } = buildPagination(params);
  const values: unknown[] = [];
  const conditions = ["i.status = 'selling'"];

  if (search) {
    conditions.push('(i.title LIKE ? OR i.description LIKE ? OR i.tag LIKE ? OR i.rank LIKE ? OR i.skins LIKE ? OR i.champs LIKE ?)');
    values.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (category) {
    conditions.push('i.category = ?');
    values.push(category);
  }

  const whereSql = `WHERE ${conditions.join(' AND ')}`;
  const [rows, countRows] = await Promise.all([
    safeRows<Row>(
      `
        SELECT
          i.*,
          u.username AS seller_username
        FROM game_market_items i
        LEFT JOIN users u ON u.id = i.seller_id
        ${whereSql}
        ORDER BY COALESCE(i.is_pinned, 0) DESC, i.created_at DESC, i.id DESC
        LIMIT ? OFFSET ?
      `,
      ...values,
      perPage,
      offset
    ),
    safeRows<Array<{ total: number }> extends infer _T ? { total: number } : never>(
      `
        SELECT COUNT(*) AS total
        FROM game_market_items i
        ${whereSql}
      `,
      ...values
    ),
  ]);

  return {
    success: true,
    data: rows.map(formatGameMarketItem),
    pagination: {
      page,
      per_page: perPage,
      total: Number(countRows[0]?.total || 0),
      total_pages: Math.max(1, Math.ceil(Number(countRows[0]?.total || 0) / perPage)),
    },
  };
}

export async function getExternalGameMarketItemDetail(itemId: number) {
  const row = await safeOne<Row>(
    `
      SELECT
        i.*,
        u.username AS seller_username
      FROM game_market_items i
      LEFT JOIN users u ON u.id = i.seller_id
      WHERE i.id = ?
        AND i.status = 'selling'
      LIMIT 1
    `,
    itemId
  );

  if (!row) {
    throw new Error('Không tìm thấy sản phẩm game market');
  }

  return {
    success: true,
    data: formatGameMarketItem(row),
  };
}

async function getExternalGameMarketOrderSnapshot(userId: number, orderId: number) {
  const row = await safeOne<Row>(
    `
      SELECT
        o.id,
        o.buyer_id,
        o.seller_id,
        o.item_id,
        o.amount,
        o.status,
        o.rating,
        o.review,
        o.delivered_data,
        o.created_at,
        i.code,
        i.title,
        i.category,
        i.thumbnail,
        i.delivery_method,
        u.username AS seller_username
      FROM game_market_orders o
      INNER JOIN game_market_items i ON i.id = o.item_id
      LEFT JOIN users u ON u.id = o.seller_id
      WHERE o.id = ?
        AND o.buyer_id = ?
      LIMIT 1
    `,
    orderId,
    userId
  );

  if (!row) {
    throw new Error('Không tìm thấy đơn game market');
  }

  const categoryMeta = getGameMarketCategoryMeta(String(row.category || ''));
  return {
    id: Number(row.id || 0),
    order_type: 'game_market',
    status: String(row.status || 'processing'),
    amount: Math.round(toNumber(row.amount, 0)),
    delivered_data: String(row.delivered_data || '').trim(),
    rating: toNumber(row.rating, 0),
    review: String(row.review || '').trim(),
    created_at: row.created_at,
    product: {
      id: Number(row.item_id || 0),
      code: String(row.code || ''),
      title: String(row.title || `Game #${String(row.item_id || '')}`),
      category: categoryMeta.slug,
      category_name: categoryMeta.label,
      thumbnail: getGameMarketGalleryUrls({
        thumbnail: row.thumbnail,
        images: row.thumbnail,
      }, 1)[0] || buildPublicAssetUrl(String(row.thumbnail || '').trim()) || '',
      delivery_method: String(row.delivery_method || 'manual'),
    },
    seller: {
      id: Number(row.seller_id || 0),
      username: String(row.seller_username || ''),
    },
  };
}

export async function createExternalGameMarketOrder(userId: number, input: {
  itemId: number;
}) {
  const itemId = Math.max(1, Math.trunc(input.itemId || 0));
  if (!itemId) {
    throw new Error('Thiếu item_id');
  }

  const purchase = await purchaseGameItem(userId, itemId);
  const order = await getExternalGameMarketOrderSnapshot(userId, Number(purchase.orderId || 0));
  const summary = await getGameApiAccountSummary(userId);

  return {
    success: true,
    data: {
      purchase,
      order,
      account: summary,
      notes: [
        'Đơn game market thường cần seller bàn giao thủ công.',
        'Hãy poll endpoint trạng thái đơn để lấy delivered_data và trạng thái mới nhất.',
      ],
    },
  };
}

export async function getExternalGameMarketOrder(userId: number, orderId: number) {
  return {
    success: true,
    data: await getExternalGameMarketOrderSnapshot(userId, orderId),
  };
}

function compatSuccess(message: string, data: Record<string, unknown> = {}) {
  return {
    status: 'success',
    msg: message,
    ...data,
  };
}

function compatError(message: string, data: Record<string, unknown> = {}) {
  return {
    status: 'error',
    msg: message,
    ...data,
  };
}

function buildCompatProductId(kind: CompatProductKind, id: number) {
  return `${kind === 'market' ? 'GM' : 'RES'}-${Math.max(1, Math.trunc(id || 0))}`;
}

function buildCompatOrderId(kind: CompatProductKind, id: number) {
  return `${kind === 'market' ? 'GM' : 'RES'}-${Math.max(1, Math.trunc(id || 0))}`;
}

function parseCompatPrefixedId(value: unknown): { kind: CompatProductKind; id: number } | null {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) {
    return null;
  }

  const match = raw.match(/^(RES|GM)[-_]?(\d+)$/i);
  if (!match) {
    return null;
  }

  const id = Math.max(1, Math.trunc(toNumber(match[2], 0)));
  if (!id) {
    return null;
  }

  return {
    kind: match[1].toUpperCase() === 'GM' ? 'market' : 'resource',
    id,
  };
}

function buildCompatCategoryId(prefix: string, value: unknown) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-');
  return `${prefix}:${normalized || 'khac'}`;
}

function splitCompatContentLines(value: unknown) {
  return String(value || '')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function detectFileUrl(input: { downloadUrl?: unknown; content?: unknown; lines?: string[] }) {
  const directUrl = String(input.downloadUrl || '').trim();
  if (directUrl) {
    return directUrl;
  }

  const lines = input.lines || splitCompatContentLines(input.content);
  const lineUrl = lines.find((item) => /^https?:\/\//i.test(item));
  return lineUrl || '';
}

function buildCompatProductPayload(input: {
  kind: CompatProductKind;
  id: number;
  title: string;
  price: number;
  stock: number;
  description: string;
  flag: string;
  thumbnail?: string;
  content?: string;
  categoryName?: string;
  categorySlug?: string;
  min?: number;
  max?: number;
}) {
  return {
    id: buildCompatProductId(input.kind, input.id),
    name: input.title,
    price: input.price,
    amount: input.stock,
    description: input.description,
    flag: input.flag,
    min: Math.max(1, Math.trunc(input.min || 1)),
    max: Math.max(1, Math.trunc(input.max || 1)),
    thumbnail: String(input.thumbnail || ''),
    image: String(input.thumbnail || ''),
    content: String(input.content || ''),
    category_name: String(input.categoryName || ''),
    category_slug: String(input.categorySlug || ''),
    source_type: input.kind,
  };
}

async function listCompatCatalogRows() {
  const settings = await getLegacySettingsMap();
  const vatPercent = getVatPercent(settings);

  const [resourceRows, marketRows] = await Promise.all([
    safeRows<Row>(
      `
        SELECT
          r.id,
          r.product_code,
          r.title,
          r.description,
          r.price,
          r.original_price,
          r.thumbnail,
          r.stock,
          r.status,
          r.tags,
          r.custom_badge,
          r.category,
          r.category_id,
          r.api_account_kind,
          r.product_note,
          r.product_content,
          r.content,
          rc.name AS category_name,
          rc.slug AS category_slug,
          rc.image AS category_image
        FROM mmo_resources r
        LEFT JOIN resource_categories rc ON rc.id = r.category_id
        WHERE r.status IN ('active', 'out_of_stock')
          AND COALESCE(r.is_deleted, 0) = 0
          AND r.api_account_kind IN ('game', 'random')
        ORDER BY
          CASE WHEN COALESCE(r.stock, 0) > 0 THEN 0 ELSE 1 END ASC,
          COALESCE(r.is_pinned, 0) DESC,
          COALESCE(r.featured, 0) DESC,
          COALESCE(r.stock, 0) DESC,
          COALESCE(r.display_order, 0) ASC,
          r.created_at DESC,
          r.id DESC
      `
    ),
    safeRows<Row>(
      `
        SELECT
          i.*,
          u.username AS seller_username
        FROM game_market_items i
        LEFT JOIN users u ON u.id = i.seller_id
        WHERE i.status = 'selling'
        ORDER BY COALESCE(i.is_pinned, 0) DESC, i.created_at DESC, i.id DESC
      `
    ),
  ]);

  return { resourceRows, marketRows, vatPercent };
}

export async function getCompatProviderProfile(userId: number) {
  const account = await ensureGameApiKeyForUser(userId);

  return compatSuccess('Lấy thông tin tài khoản thành công', {
    data: {
      username: String(account.username || ''),
      money: toNumber(account.game_balance, 0),
      email: String(account.email || ''),
      fullname: String(account.fullname || ''),
      user_id: Number(account.user_id || 0),
    },
  });
}

export async function getCompatProductsCatalog() {
  const { resourceRows, marketRows, vatPercent } = await listCompatCatalogRows();

  const categories: Array<Record<string, unknown>> = [
    {
      id: 'resource-game',
      parent_id: null,
      name: 'Tai khoan game API',
      icon: '/assets/game-thumbnails/pubg-mobile.png',
      products: [],
    },
    {
      id: 'resource-random',
      parent_id: null,
      name: 'Random game API',
      icon: '/assets/game-thumbnails/lien-quan-mobile.png',
      products: [],
    },
    {
      id: 'game-market',
      parent_id: null,
      name: 'Mua ban game',
      icon: '/assets/game-thumbnails/fc-mobile.png',
      products: [],
    },
  ];

  const categoryMap = new Map<string, Record<string, unknown>>();
  for (const item of categories) {
    categoryMap.set(String(item.id), item);
  }

  for (const row of resourceRows) {
    const kind = String(row.api_account_kind || 'game').trim().toLowerCase() === 'random' ? 'random' : 'game';
    const parentId = kind === 'random' ? 'resource-random' : 'resource-game';
    const categoryName = hideProviderBranding(row.category_name || row.category, 'Tai khoan game');
    const categorySlug = String(row.category_slug || row.category_id || row.category || '').trim();
    const categoryId = buildCompatCategoryId(parentId, categorySlug || categoryName);
    const existing = categoryMap.get(categoryId);
    const thumbnail = getGameAccountThumbnailUrl({
      title: row.title,
      category: row.category,
      categoryName: row.category_name,
      tags: row.tags,
      description: row.description,
      customBadge: row.custom_badge,
      primary: row.thumbnail,
      fallback: row.category_image,
    }) || '';

    if (!existing) {
      const nextCategory = {
        id: categoryId,
        parent_id: parentId,
        name: categoryName,
        icon: thumbnail,
        products: [] as Array<Record<string, unknown>>,
      };
      categoryMap.set(categoryId, nextCategory);
      categories.push(nextCategory);
    }

    const price = Math.round(toNumber(row.price, 0) * (1 + (vatPercent / 100)));
    const stock = Math.max(0, Math.trunc(toNumber(row.stock, 0)));
    const description = resourceHtmlToText(row.description, 'San pham game API');
    const content = resourceHtmlToText(String(row.product_content || row.content || row.product_note || '').trim());
    const product = buildCompatProductPayload({
      kind: 'resource',
      id: Number(row.id || 0),
      title: hideProviderBranding(row.title, `San pham #${String(row.id || '')}`),
      price,
      stock,
      description,
      flag: kind === 'random' ? 'random-account' : 'game-account',
      thumbnail,
      content,
      categoryName,
      categorySlug,
      min: 1,
      max: Math.max(1, Math.min(stock > 0 ? stock : 1, 10)),
    });

    const target = categoryMap.get(categoryId);
    if (target && Array.isArray(target.products)) {
      (target.products as Array<Record<string, unknown>>).push(product);
    }
  }

  for (const row of marketRows) {
    const categoryMeta = getGameMarketCategoryMeta(String(row.category || ''));
    const categoryId = buildCompatCategoryId('game-market', categoryMeta.slug);
    const existing = categoryMap.get(categoryId);
    const thumbnail = getGameMarketGalleryUrls({
      thumbnail: row.thumbnail,
      images: row.images,
    }, 1)[0] || buildPublicAssetUrl(String(row.thumbnail || '').trim()) || '';

    if (!existing) {
      const nextCategory = {
        id: categoryId,
        parent_id: 'game-market',
        name: categoryMeta.label,
        icon: thumbnail,
        products: [] as Array<Record<string, unknown>>,
      };
      categoryMap.set(categoryId, nextCategory);
      categories.push(nextCategory);
    }

    const stock = Math.max(0, Math.trunc(toNumber(row.stock, 0)));
    const product = buildCompatProductPayload({
      kind: 'market',
      id: Number(row.id || 0),
      title: String(row.title || `Game #${String(row.id || '')}`),
      price: Math.round(toNumber(row.price, 0)),
      stock,
      description: String(row.description || '').trim() || categoryMeta.description,
      flag: 'game-market',
      thumbnail,
      content: [
        String(row.rank || '').trim(),
        String(row.skins || '').trim(),
        String(row.champs || '').trim(),
        String(row.account_details || '').trim(),
      ].filter(Boolean).join('\n'),
      categoryName: categoryMeta.label,
      categorySlug: categoryMeta.slug,
      min: 1,
      max: 1,
    });

    const target = categoryMap.get(categoryId);
    if (target && Array.isArray(target.products)) {
      (target.products as Array<Record<string, unknown>>).push(product);
    }
  }

  return compatSuccess('Lấy danh sách sản phẩm thành công', {
    categories,
    source: {
      vat_percent: vatPercent,
      resource_total: resourceRows.length,
      market_total: marketRows.length,
    },
  });
}

export async function getCompatProductDetail(externalProductId: string) {
  const parsed = parseCompatPrefixedId(externalProductId);
  if (!parsed) {
    return compatError('ID sản phẩm không hợp lệ');
  }

  if (parsed.kind === 'resource') {
    const detail = await getExternalGameResourceDetail(parsed.id).catch((error) => {
      throw error instanceof Error ? error : new Error('Không tìm thấy sản phẩm resource');
    });
    const item = detail.data as Record<string, unknown>;
    return compatSuccess('Lấy chi tiết sản phẩm thành công', {
      product: [
        buildCompatProductPayload({
          kind: 'resource',
          id: Number(item.id || 0),
          title: String(item.title || ''),
          price: Math.round(toNumber(item.price, 0)),
          stock: Math.max(0, Math.trunc(toNumber(item.stock, 0))),
          description: String(item.description_text || item.description_html || ''),
          flag: String(item.api_account_kind || 'game-account'),
          thumbnail: String(item.thumbnail || ''),
          content: String(item.content_text || item.product_note || ''),
          categoryName: String(item.category_name || ''),
          categorySlug: String(item.category_slug || ''),
          min: 1,
          max: Math.max(1, Math.min(Math.max(0, Math.trunc(toNumber(item.stock, 0))) || 1, 10)),
        }),
      ],
    });
  }

  const detail = await getExternalGameMarketItemDetail(parsed.id).catch((error) => {
    throw error instanceof Error ? error : new Error('Không tìm thấy sản phẩm game market');
  });
  const item = detail.data as Record<string, unknown>;

  return compatSuccess('Lấy chi tiết sản phẩm thành công', {
    product: [
      buildCompatProductPayload({
        kind: 'market',
        id: Number(item.id || 0),
        title: String(item.title || ''),
        price: Math.round(toNumber(item.price, 0)),
        stock: Math.max(0, Math.trunc(toNumber(item.stock, 0))),
        description: String(item.description || ''),
        flag: 'game-market',
        thumbnail: String(item.thumbnail || ''),
        content: String(item.account_details || ''),
        categoryName: String(item.category_name || ''),
        categorySlug: String(item.category || ''),
        min: 1,
        max: 1,
      }),
    ],
  });
}

function buildCompatResourceOrderPayload(order: Record<string, unknown>) {
  const lines = splitCompatContentLines(order.delivery_data || order.download_url || '');
  const fallbackLines = lines.length > 0
    ? lines
    : String(order.status || '').toLowerCase() === 'completed'
      ? ['Đơn hàng hoàn tất nhưng chưa có nội dung bàn giao cụ thể.']
      : ['Đơn hàng đang xử lý. Vui lòng poll lại sau để lấy dữ liệu bàn giao.'];
  const file = detectFileUrl({
    downloadUrl: order.download_url,
    content: order.delivery_data,
    lines: fallbackLines,
  });

  return compatSuccess('Lấy trạng thái đơn thành công', {
    trans_id: buildCompatOrderId('resource', Number(order.id || 0)),
    order_status: String(order.status || 'pending'),
    data: fallbackLines,
    file,
    content: String(order.delivery_data || order.download_url || fallbackLines.join('\n')).trim(),
    source_type: 'resource',
    product: order.product,
    quantity: toNumber(order.quantity, 1),
    total_price: Math.round(toNumber(order.total_price, 0)),
    created_at: order.created_at,
    updated_at: order.updated_at,
  });
}

function buildCompatMarketOrderPayload(order: Record<string, unknown>) {
  const delivered = String(order.delivered_data || '').trim();
  const lines = splitCompatContentLines(delivered);
  const fallbackLines = lines.length > 0
    ? lines
    : String(order.status || '').toLowerCase() === 'completed'
      ? ['Seller đã xác nhận bàn giao, nhưng chưa có delivered_data chi tiết.']
      : ['Đơn game market đang chờ seller bàn giao. Vui lòng poll lại order.php để nhận thông tin.'];
  const file = detectFileUrl({
    content: delivered,
    lines: fallbackLines,
  });

  return compatSuccess('Lấy trạng thái đơn thành công', {
    trans_id: buildCompatOrderId('market', Number(order.id || 0)),
    order_status: String(order.status || 'processing'),
    data: fallbackLines,
    file,
    content: delivered || fallbackLines.join('\n'),
    source_type: 'game-market',
    product: order.product,
    amount: Math.round(toNumber(order.amount, 0)),
    created_at: order.created_at,
  });
}

export async function createCompatProductOrder(userId: number, input: {
  externalProductId: string;
  amount?: number;
}) {
  const parsed = parseCompatPrefixedId(input.externalProductId);
  if (!parsed) {
    return compatError('ID sản phẩm không hợp lệ');
  }

  if (parsed.kind === 'resource') {
    const result = await createExternalGameResourceOrder(userId, {
      resourceId: parsed.id,
      quantity: Math.max(1, Math.trunc(input.amount || 1)),
    });
    return buildCompatResourceOrderPayload(result.data.order as Record<string, unknown>);
  }

  if (Math.max(1, Math.trunc(input.amount || 1)) > 1) {
    return compatError('Game market chỉ hỗ trợ mua từng sản phẩm một lần', {
      source_type: 'game-market',
    });
  }

  const result = await createExternalGameMarketOrder(userId, {
    itemId: parsed.id,
  });
  return buildCompatMarketOrderPayload(result.data.order as Record<string, unknown>);
}

export async function getCompatOrderDetail(userId: number, externalOrderId: string) {
  const parsed = parseCompatPrefixedId(externalOrderId);
  if (!parsed) {
    return compatError('ID đơn hàng không hợp lệ');
  }

  if (parsed.kind === 'resource') {
    const result = await getExternalGameResourceOrder(userId, parsed.id);
    return buildCompatResourceOrderPayload(result.data as Record<string, unknown>);
  }

  const result = await getExternalGameMarketOrder(userId, parsed.id);
  return buildCompatMarketOrderPayload(result.data as Record<string, unknown>);
}
