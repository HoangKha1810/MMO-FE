import 'server-only';

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { logAdminAction } from '@/lib/admin-auth';
import { serializeDatabaseDateTime } from '@/lib/date-time';
import { syncMmoResourcesFromProviders } from '@/lib/mmo-provider';
import { slugify, toNumber } from '@/lib/utils';

type Row = Record<string, unknown>;

const tableColumnsCache = new Map<string, Set<string>>();
const tableExistsCache = new Map<string, boolean>();

function normalizeValue(value: unknown): unknown {
  if (value instanceof Date) {
    return serializeDatabaseDateTime(value);
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }

  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      output[key] = normalizeValue(item);
    }
    return output;
  }

  return value;
}

async function tableExists(table: string) {
  if (tableExistsCache.has(table)) {
    return tableExistsCache.get(table) || false;
  }

  try {
    const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(`SHOW TABLES LIKE '${table}'`);
    const exists = rows.length > 0;
    tableExistsCache.set(table, exists);
    return exists;
  } catch {
    tableExistsCache.set(table, false);
    return false;
  }
}

async function getTableColumns(table: string) {
  if (tableColumnsCache.has(table)) {
    return tableColumnsCache.get(table) || new Set<string>();
  }

  if (!(await tableExists(table))) {
    const empty = new Set<string>();
    tableColumnsCache.set(table, empty);
    return empty;
  }

  try {
    const rows = await db.$queryRawUnsafe<Array<{ Field: string }>>(`SHOW COLUMNS FROM \`${table}\``);
    const columns = new Set(rows.map((row) => String(row.Field || '')));
    tableColumnsCache.set(table, columns);
    return columns;
  } catch {
    const empty = new Set<string>();
    tableColumnsCache.set(table, empty);
    return empty;
  }
}

async function hasColumn(table: string, column: string) {
  const columns = await getTableColumns(table);
  return columns.has(column);
}

function buildInClause(ids: number[]) {
  return ids.map(() => '?').join(',');
}

function parseInteger(value: unknown, fallback = 0) {
  return Math.trunc(toNumber(value, fallback));
}

function parseNullableInteger(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  return Math.trunc(toNumber(text, 0));
}

function parseFloatNumber(value: unknown, fallback = 0) {
  return toNumber(typeof value === 'string' ? value.replace(/[^\d.-]/g, '') : value, fallback);
}

function parseNullableString(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function parseFlag(value: unknown) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized) ? 1 : 0;
}

function productCodeFromId(id: number) {
  return `TN${String(id).padStart(5, '0')}`;
}

async function getCategoryName(categoryId: number | null) {
  if (!categoryId) return 'Khác';
  const rows = await db.$queryRawUnsafe<Array<{ name: string | null }>>(
    'SELECT name FROM resource_categories WHERE id = ? LIMIT 1',
    categoryId
  );
  return String(rows[0]?.name || 'Khác');
}

function buildResourcePrice(originalPrice: number | null, requestedPrice: number, isAutoMargin: number, marginPercent: number) {
  if (originalPrice !== null && originalPrice > 0) {
    if (isAutoMargin && marginPercent !== 0) {
      return Math.ceil(originalPrice * (1 + (marginPercent / 100)));
    }
    return originalPrice;
  }
  return Math.max(0, requestedPrice);
}

function keepDefinedEntries(input: Array<[string, unknown]>) {
  return input.filter((entry) => entry[1] !== undefined);
}

export async function listAdminMmoProducts(params: URLSearchParams) {
  const resourceColumns = await getTableColumns('mmo_resources');
  const categoryColumns = await getTableColumns('resource_categories');
  const orderColumns = await getTableColumns('resource_orders');
  const hasCategoryTable = await tableExists('resource_categories');

  const search = (params.get('search') || '').trim();
  const category = parseNullableInteger(params.get('category'));
  const status = (params.get('status') || '').trim();
  const stockStatus = (params.get('stock_status') || '').trim();
  const provider = (params.get('provider') || '').trim();
  const limit = Math.min(9999, Math.max(10, parseInteger(params.get('limit') || 50, 50)));
  const page = Math.max(1, parseInteger(params.get('page') || 1, 1));
  const offset = (page - 1) * limit;

  const values: unknown[] = [];
  const conditions: string[] = [];

  if (resourceColumns.has('api_provider_id')) {
    conditions.push(`(
      r.api_provider_id IS NULL
      OR r.api_provider_id = ''
      OR EXISTS (
        SELECT 1
        FROM api_providers p
        WHERE CAST(p.id AS CHAR) = CAST(r.api_provider_id AS CHAR)
          AND p.status = 'active'
      )
    )`);
  }

  if (search) {
    const searchableFields = ['title', resourceColumns.has('product_code') ? 'product_code' : null].filter(Boolean);
    if (searchableFields.length > 0) {
      conditions.push(`(${searchableFields.map((field) => `r.\`${field}\` LIKE ?`).join(' OR ')})`);
      values.push(...searchableFields.map(() => `%${search}%`));
    }
  }

  if (category !== null && resourceColumns.has('category_id')) {
    conditions.push('r.category_id = ?');
    values.push(category);
  }

  if (status && resourceColumns.has('status')) {
    conditions.push('r.status = ?');
    values.push(status);
  }

  if (stockStatus && resourceColumns.has('stock')) {
    if (stockStatus === 'out_of_stock') {
      conditions.push('COALESCE(r.stock, 0) <= 0');
    } else if (stockStatus === 'low_stock') {
      conditions.push('COALESCE(r.stock, 0) > 0 AND COALESCE(r.stock, 0) < 10');
    } else if (stockStatus === 'in_stock') {
      conditions.push('(r.stock IS NULL OR r.stock >= 10)');
    }
  }

  if (provider === 'api' && resourceColumns.has('api_provider_id')) {
    conditions.push("r.api_provider_id IS NOT NULL AND r.api_provider_id != ''");
  } else if (provider === 'local' && resourceColumns.has('api_provider_id')) {
    conditions.push("(r.api_provider_id IS NULL OR r.api_provider_id = '')");
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const categoryNameExpr = categoryColumns.has('name') ? 'c.name' : 'r.category';
  const categoryImageExpr = categoryColumns.has('image') ? 'c.image' : 'NULL';
  const categoryIconExpr = categoryColumns.has('icon') ? 'c.icon' : 'NULL';
  const orderSql = resourceColumns.has('display_order')
    ? 'COALESCE(r.display_order, 0) ASC, COALESCE(r.updated_at, r.created_at) DESC, r.id DESC'
    : 'COALESCE(r.updated_at, r.created_at) DESC, r.id DESC';

  const [rows, countRows, categories, totalProductsRows, totalSalesRows, totalRevenueRows, todaySalesRows] = await Promise.all([
    db.$queryRawUnsafe<Row[]>(
      `
        SELECT
          r.*,
          ${categoryNameExpr} AS category_name,
          ${categoryImageExpr} AS category_image,
          ${categoryIconExpr} AS category_icon
        FROM mmo_resources r
        LEFT JOIN resource_categories c ON c.id = r.category_id
        ${whereSql}
        ORDER BY ${orderSql}
        LIMIT ? OFFSET ?
      `,
      ...values,
      limit,
      offset
    ),
    db.$queryRawUnsafe<Array<{ total: number | bigint }>>(
      `
        SELECT COUNT(*) AS total
        FROM mmo_resources r
        ${whereSql}
      `,
      ...values
    ),
    hasCategoryTable
      ? db.$queryRawUnsafe<Array<{ id: number | bigint; name: string | null }>>(
        `
          SELECT id, name
          FROM resource_categories
          ORDER BY COALESCE(display_order, 0) ASC, id ASC
        `
      )
      : Promise.resolve([]),
    db.$queryRawUnsafe<Array<{ total: number | bigint }>>('SELECT COUNT(*) AS total FROM mmo_resources'),
    orderColumns.size > 0
      ? db.$queryRawUnsafe<Array<{ total: number | bigint }>>(
        `
          SELECT COUNT(*) AS total
          FROM resource_orders
          ${orderColumns.has('status') ? "WHERE status = 'completed'" : ''}
        `
      )
      : Promise.resolve([{ total: 0 }]),
    orderColumns.size > 0
      ? db.$queryRawUnsafe<Array<{ total: number | bigint }>>(
        `
          SELECT COALESCE(SUM(${orderColumns.has('total_price') ? 'total_price' : orderColumns.has('amount') ? 'amount' : '0'}), 0) AS total
          FROM resource_orders
          ${orderColumns.has('status') ? "WHERE status = 'completed'" : ''}
        `
      )
      : Promise.resolve([{ total: 0 }]),
    orderColumns.has('created_at')
      ? db.$queryRawUnsafe<Array<{ total: number | bigint }>>(
        `
          SELECT COUNT(*) AS total
          FROM resource_orders
          WHERE ${orderColumns.has('status') ? "status = 'completed' AND " : ''}DATE(created_at) = CURRENT_DATE()
        `
      )
      : Promise.resolve([{ total: 0 }]),
  ]);

  const total = Number(countRows[0]?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return {
    success: true,
    data: normalizeValue(rows),
    categories: normalizeValue(categories.map((item) => ({
      id: Number(item.id || 0),
      name: String(item.name || 'Không tên'),
    }))),
    filters: {
      search,
      category: category ?? '',
      status,
      stock_status: stockStatus,
      provider,
      limit,
      page,
    },
    stats: {
      total_products: Number(totalProductsRows[0]?.total || 0),
      total_sales: Number(totalSalesRows[0]?.total || 0),
      total_revenue: Number(totalRevenueRows[0]?.total || 0),
      today_sales: Number(todaySalesRows[0]?.total || 0),
    },
    pagination: {
      page,
      per_page: limit,
      total,
      total_pages: totalPages,
    },
  };
}

export async function createAdminMmoProduct(input: Record<string, unknown>, adminId: number, req?: NextRequest) {
  const columns = await getTableColumns('mmo_resources');
  const title = String(input.title || '').trim();
  if (!title) {
    throw new Error('Tiêu đề sản phẩm không được để trống');
  }

  const categoryId = parseNullableInteger(input.category_id);
  const categoryName = await getCategoryName(categoryId);
  const resourceType = String(input.resource_type || 'account').trim() || 'account';
  const originalPrice = parseNullableInteger(input.original_price);
  const requestedPrice = parseInteger(input.price, 0);
  const isAutoMargin = parseFlag(input.is_auto_margin);
  const marginPercent = parseFloatNumber(input.margin_percent, 0);
  const price = buildResourcePrice(originalPrice, requestedPrice, isAutoMargin, marginPercent);

  const payloadEntries = keepDefinedEntries([
    ['title', title],
    ['category', columns.has('category') ? categoryName : undefined],
    ['category_id', columns.has('category_id') ? categoryId : undefined],
    ['price', columns.has('price') ? price : undefined],
    ['original_price', columns.has('original_price') ? originalPrice : undefined],
    ['resource_type', columns.has('resource_type') ? resourceType : undefined],
    ['stock', columns.has('stock') ? parseNullableInteger(input.stock) : undefined],
    ['description', columns.has('description') ? String(input.description || '').trim() : undefined],
    ['content', columns.has('content') ? String(input.content || '').trim() : undefined],
    ['product_content', columns.has('product_content') ? String(input.product_content || '').trim() : undefined],
    ['product_note', columns.has('product_note') ? String(input.product_note || '').trim() : undefined],
    ['download_url', columns.has('download_url') ? String(input.download_url || '').trim() : undefined],
    ['thumbnail', columns.has('thumbnail') ? String(input.thumbnail || '').trim() : undefined],
    ['tags', columns.has('tags') ? String(input.tags || '').trim() : undefined],
    ['featured', columns.has('featured') ? parseFlag(input.featured) : undefined],
    ['is_pinned', columns.has('is_pinned') ? parseFlag(input.is_pinned) : undefined],
    ['custom_badge', columns.has('custom_badge') ? parseNullableString(input.custom_badge) : undefined],
    ['created_by', columns.has('created_by') ? adminId : undefined],
    ['status', columns.has('status') ? String(input.status || 'active').trim() || 'active' : undefined],
    ['sold_count', columns.has('sold_count') ? parseInteger(input.sold_count, 0) : undefined],
    ['display_order', columns.has('display_order') ? parseInteger(input.display_order, 0) : undefined],
    ['avg_rating', columns.has('avg_rating') ? 0 : undefined],
    ['is_auto_margin', columns.has('is_auto_margin') ? isAutoMargin : undefined],
    ['margin_percent', columns.has('margin_percent') ? marginPercent : undefined],
    ['api_provider_id', columns.has('api_provider_id') ? parseNullableString(input.api_provider_id) : undefined],
    ['api_product_id', columns.has('api_product_id') ? parseNullableString(input.api_product_id) : undefined],
    ['is_auto', columns.has('is_auto') ? parseFlag(input.is_auto) : undefined],
    ['product_code', columns.has('product_code') ? parseNullableString(input.product_code) : undefined],
  ]);

  const created = await db.$transaction(async (tx) => {
    const fields = payloadEntries.map(([field]) => `\`${field}\``).join(', ');
    const placeholders = payloadEntries.map(() => '?').join(', ');
    await tx.$executeRawUnsafe(
      `INSERT INTO mmo_resources (${fields}) VALUES (${placeholders})`,
      ...payloadEntries.map((entry) => entry[1])
    );
    const idRows = await tx.$queryRawUnsafe<Array<{ id: number | bigint }>>('SELECT LAST_INSERT_ID() AS id');
    const id = Number(idRows[0]?.id || 0);

    if (id && columns.has('product_code') && !parseNullableString(input.product_code)) {
      await tx.$executeRawUnsafe(
        'UPDATE mmo_resources SET product_code = ? WHERE id = ?',
        productCodeFromId(id),
        id
      );
    }

    const rows = await tx.$queryRawUnsafe<Row[]>('SELECT * FROM mmo_resources WHERE id = ? LIMIT 1', id);
    return rows[0] || { id };
  });

  await logAdminAction({
    adminId,
    action: 'create mmo resource',
    target: `${title}`,
    req,
  });

  return { success: true, data: normalizeValue(created) };
}

export async function updateAdminMmoProduct(id: number, input: Record<string, unknown>, adminId: number, req?: NextRequest) {
  if (!id) {
    throw new Error('ID không hợp lệ');
  }

  const columns = await getTableColumns('mmo_resources');
  const currentRows = await db.$queryRawUnsafe<Row[]>(
    'SELECT * FROM mmo_resources WHERE id = ? LIMIT 1',
    id
  );
  const current = currentRows[0];
  if (!current) {
    throw new Error(`Không tìm thấy sản phẩm #${id}`);
  }

  const categoryId = Object.prototype.hasOwnProperty.call(input, 'category_id')
    ? parseNullableInteger(input.category_id)
    : parseNullableInteger(current.category_id);
  const categoryName = await getCategoryName(categoryId);
  const originalPrice = Object.prototype.hasOwnProperty.call(input, 'original_price')
    ? parseNullableInteger(input.original_price)
    : parseNullableInteger(current.original_price);
  const requestedPrice = Object.prototype.hasOwnProperty.call(input, 'price')
    ? parseInteger(input.price, parseInteger(current.price, 0))
    : parseInteger(current.price, 0);
  const isAutoMargin = Object.prototype.hasOwnProperty.call(input, 'is_auto_margin')
    ? parseFlag(input.is_auto_margin)
    : parseFlag(current.is_auto_margin);
  const marginPercent = Object.prototype.hasOwnProperty.call(input, 'margin_percent')
    ? parseFloatNumber(input.margin_percent, parseFloatNumber(current.margin_percent, 0))
    : parseFloatNumber(current.margin_percent, 0);
  const price = buildResourcePrice(originalPrice, requestedPrice, isAutoMargin, marginPercent);

  const updates = keepDefinedEntries([
    ['title', Object.prototype.hasOwnProperty.call(input, 'title') ? String(input.title || '').trim() : undefined],
    ['category', columns.has('category') && Object.prototype.hasOwnProperty.call(input, 'category_id') ? categoryName : undefined],
    ['category_id', columns.has('category_id') && Object.prototype.hasOwnProperty.call(input, 'category_id') ? categoryId : undefined],
    ['price', columns.has('price') && (Object.prototype.hasOwnProperty.call(input, 'price') || Object.prototype.hasOwnProperty.call(input, 'original_price') || Object.prototype.hasOwnProperty.call(input, 'is_auto_margin') || Object.prototype.hasOwnProperty.call(input, 'margin_percent')) ? price : undefined],
    ['original_price', columns.has('original_price') && Object.prototype.hasOwnProperty.call(input, 'original_price') ? originalPrice : undefined],
    ['resource_type', columns.has('resource_type') && Object.prototype.hasOwnProperty.call(input, 'resource_type') ? String(input.resource_type || 'account').trim() || 'account' : undefined],
    ['stock', columns.has('stock') && Object.prototype.hasOwnProperty.call(input, 'stock') ? parseNullableInteger(input.stock) : undefined],
    ['description', columns.has('description') && Object.prototype.hasOwnProperty.call(input, 'description') ? String(input.description || '').trim() : undefined],
    ['content', columns.has('content') && Object.prototype.hasOwnProperty.call(input, 'content') ? String(input.content || '').trim() : undefined],
    ['product_content', columns.has('product_content') && Object.prototype.hasOwnProperty.call(input, 'product_content') ? String(input.product_content || '').trim() : undefined],
    ['product_note', columns.has('product_note') && Object.prototype.hasOwnProperty.call(input, 'product_note') ? String(input.product_note || '').trim() : undefined],
    ['download_url', columns.has('download_url') && Object.prototype.hasOwnProperty.call(input, 'download_url') ? String(input.download_url || '').trim() : undefined],
    ['thumbnail', columns.has('thumbnail') && Object.prototype.hasOwnProperty.call(input, 'thumbnail') ? String(input.thumbnail || '').trim() : undefined],
    ['tags', columns.has('tags') && Object.prototype.hasOwnProperty.call(input, 'tags') ? String(input.tags || '').trim() : undefined],
    ['featured', columns.has('featured') && Object.prototype.hasOwnProperty.call(input, 'featured') ? parseFlag(input.featured) : undefined],
    ['is_pinned', columns.has('is_pinned') && Object.prototype.hasOwnProperty.call(input, 'is_pinned') ? parseFlag(input.is_pinned) : undefined],
    ['custom_badge', columns.has('custom_badge') && Object.prototype.hasOwnProperty.call(input, 'custom_badge') ? parseNullableString(input.custom_badge) : undefined],
    ['status', columns.has('status') && Object.prototype.hasOwnProperty.call(input, 'status') ? String(input.status || 'active').trim() || 'active' : undefined],
    ['sold_count', columns.has('sold_count') && Object.prototype.hasOwnProperty.call(input, 'sold_count') ? parseInteger(input.sold_count, 0) : undefined],
    ['display_order', columns.has('display_order') && Object.prototype.hasOwnProperty.call(input, 'display_order') ? parseInteger(input.display_order, 0) : undefined],
    ['is_auto_margin', columns.has('is_auto_margin') && Object.prototype.hasOwnProperty.call(input, 'is_auto_margin') ? isAutoMargin : undefined],
    ['margin_percent', columns.has('margin_percent') && Object.prototype.hasOwnProperty.call(input, 'margin_percent') ? marginPercent : undefined],
    ['api_provider_id', columns.has('api_provider_id') && Object.prototype.hasOwnProperty.call(input, 'api_provider_id') ? parseNullableString(input.api_provider_id) : undefined],
    ['api_product_id', columns.has('api_product_id') && Object.prototype.hasOwnProperty.call(input, 'api_product_id') ? parseNullableString(input.api_product_id) : undefined],
    ['is_auto', columns.has('is_auto') && Object.prototype.hasOwnProperty.call(input, 'is_auto') ? parseFlag(input.is_auto) : undefined],
  ]);

  if (updates.length === 0) {
    throw new Error('Không có dữ liệu cập nhật hợp lệ');
  }

  if (columns.has('updated_at')) {
    updates.push(['updated_at', new Date()]);
  }

  await db.$executeRawUnsafe(
    `UPDATE mmo_resources SET ${updates.map(([field]) => `\`${field}\` = ?`).join(', ')} WHERE id = ?`,
    ...updates.map((entry) => entry[1]),
    id
  );

  const rows = await db.$queryRawUnsafe<Row[]>('SELECT * FROM mmo_resources WHERE id = ? LIMIT 1', id);
  await logAdminAction({ adminId, action: 'update mmo resource', target: `#${id}`, req });
  return { success: true, data: normalizeValue(rows[0] || { id }) };
}

export async function deleteAdminMmoProduct(id: number, adminId: number, req?: NextRequest) {
  if (!id) {
    throw new Error('ID không hợp lệ');
  }

  const columns = await getTableColumns('mmo_resources');
  const updates = keepDefinedEntries([
    ['status', columns.has('status') ? 'inactive' : undefined],
    ['is_deleted', columns.has('is_deleted') ? 1 : undefined],
    ['updated_at', columns.has('updated_at') ? new Date() : undefined],
  ]);

  if (updates.length === 0) {
    throw new Error('Bảng mmo_resources chưa hỗ trợ xóa mềm');
  }

  await db.$executeRawUnsafe(
    `UPDATE mmo_resources SET ${updates.map(([field]) => `\`${field}\` = ?`).join(', ')} WHERE id = ?`,
    ...updates.map((entry) => entry[1]),
    id
  );

  await logAdminAction({ adminId, action: 'soft delete mmo resource', target: `#${id}`, req });
  return { success: true };
}

async function duplicateMmoResources(ids: number[]) {
  const columns = await getTableColumns('mmo_resources');
  let duplicated = 0;

  await db.$transaction(async (tx) => {
    for (const id of ids) {
      const rows = await tx.$queryRawUnsafe<Row[]>('SELECT * FROM mmo_resources WHERE id = ? LIMIT 1', id);
      const current = rows[0];
      if (!current) continue;

      const clone: Row = { ...current };
      delete clone.id;

      clone.title = `${String(current.title || '').trim()} (Copy)`;
      if (columns.has('product_code')) {
        clone.product_code = `${String(current.product_code || 'TN00000')}_COPY_${Date.now()}${Math.floor(Math.random() * 90 + 10)}`;
      }
      if (columns.has('sold_count')) clone.sold_count = 0;
      if (columns.has('stock')) clone.stock = 0;
      if (columns.has('created_at')) clone.created_at = new Date();
      if (columns.has('updated_at')) clone.updated_at = new Date();

      const entries = Object.entries(clone).filter(([field]) => columns.has(field));
      await tx.$executeRawUnsafe(
        `INSERT INTO mmo_resources (${entries.map(([field]) => `\`${field}\``).join(', ')}) VALUES (${entries.map(() => '?').join(', ')})`,
        ...entries.map((entry) => entry[1])
      );
      duplicated += 1;
    }
  });

  return duplicated;
}

async function bulkSetResourceStatus(ids: number[], status: 'active' | 'inactive') {
  const columns = await getTableColumns('mmo_resources');
  const setParts = ['status = ?'];
  const values: unknown[] = [status];
  if (columns.has('is_deleted') && status === 'active') {
    setParts.push('is_deleted = 0');
  }
  if (columns.has('updated_at')) {
    setParts.push('updated_at = ?');
    values.push(new Date());
  }

  await db.$executeRawUnsafe(
    `UPDATE mmo_resources SET ${setParts.join(', ')} WHERE id IN (${buildInClause(ids)})`,
    ...values,
    ...ids
  );
}

async function bulkUpdateResourceStats(ids: number[], input: Record<string, unknown>) {
  const columns = await getTableColumns('mmo_resources');
  const updates = keepDefinedEntries([
    ['sold_count', columns.has('sold_count') && Object.prototype.hasOwnProperty.call(input, 'sold_count') && String(input.sold_count ?? '').trim() !== '' ? parseInteger(input.sold_count, 0) : undefined],
    ['stock', columns.has('stock') && Object.prototype.hasOwnProperty.call(input, 'stock') && String(input.stock ?? '').trim() !== '' ? parseInteger(input.stock, 0) : undefined],
    ['display_order', columns.has('display_order') && Object.prototype.hasOwnProperty.call(input, 'display_order') && String(input.display_order ?? '').trim() !== '' ? parseInteger(input.display_order, 0) : undefined],
    ['updated_at', columns.has('updated_at') ? new Date() : undefined],
  ]);

  if (updates.length === 0) {
    throw new Error('Không có dữ liệu thay đổi');
  }

  await db.$executeRawUnsafe(
    `UPDATE mmo_resources SET ${updates.map(([field]) => `\`${field}\` = ?`).join(', ')} WHERE id IN (${buildInClause(ids)})`,
    ...updates.map((entry) => entry[1]),
    ...ids
  );
}

async function bulkUpdateResourceMargin(ids: number[], input: Record<string, unknown>) {
  const percent = parseFloatNumber(input.percent, 0);
  const autoMargin = String(input.auto_margin || 'yes').trim().toLowerCase() !== 'no';
  const columns = await getTableColumns('mmo_resources');

  const values: unknown[] = [percent, percent];
  let setSql = 'price = CEIL(CASE WHEN original_price IS NOT NULL AND original_price > 0 THEN original_price * (1 + ? / 100) ELSE price * (1 + ? / 100) END)';

  if (columns.has('is_auto_margin')) {
    setSql += ', is_auto_margin = ?';
    values.push(autoMargin ? 1 : 0);
  }
  if (columns.has('margin_percent')) {
    setSql += ', margin_percent = ?';
    values.push(percent);
  }
  if (columns.has('updated_at')) {
    setSql += ', updated_at = ?';
    values.push(new Date());
  }

  await db.$executeRawUnsafe(
    `UPDATE mmo_resources SET ${setSql} WHERE id IN (${buildInClause(ids)})`,
    ...values,
    ...ids
  );
}

async function bulkUpdateResourceCategory(ids: number[], input: Record<string, unknown>) {
  const categoryId = parseNullableInteger(input.category_id);
  if (!categoryId) {
    throw new Error('Bạn cần chọn danh mục');
  }

  const columns = await getTableColumns('mmo_resources');
  const categoryName = await getCategoryName(categoryId);
  const updates = keepDefinedEntries([
    ['category_id', columns.has('category_id') ? categoryId : undefined],
    ['category', columns.has('category') ? categoryName : undefined],
    ['updated_at', columns.has('updated_at') ? new Date() : undefined],
  ]);

  await db.$executeRawUnsafe(
    `UPDATE mmo_resources SET ${updates.map(([field]) => `\`${field}\` = ?`).join(', ')} WHERE id IN (${buildInClause(ids)})`,
    ...updates.map((entry) => entry[1]),
    ...ids
  );
}

async function bulkDeleteResourcesWithFallback(ids: number[]) {
  const columns = await getTableColumns('mmo_resources');
  try {
    await db.$transaction(async (tx) => {
      if (await tableExists('mmo_resource_items')) {
        await tx.$executeRawUnsafe(
          `DELETE FROM mmo_resource_items WHERE resource_id IN (${buildInClause(ids)})`,
          ...ids
        );
      }
      await tx.$executeRawUnsafe(
        `DELETE FROM mmo_resources WHERE id IN (${buildInClause(ids)})`,
        ...ids
      );
    });
    return 'hard';
  } catch {
    const updates = keepDefinedEntries([
      ['status', columns.has('status') ? 'inactive' : undefined],
      ['is_deleted', columns.has('is_deleted') ? 1 : undefined],
      ['updated_at', columns.has('updated_at') ? new Date() : undefined],
    ]);

    if (updates.length === 0) {
      throw new Error('Không thể xóa sản phẩm vì DB hiện tại không hỗ trợ xóa mềm');
    }

    await db.$executeRawUnsafe(
      `UPDATE mmo_resources SET ${updates.map(([field]) => `\`${field}\` = ?`).join(', ')} WHERE id IN (${buildInClause(ids)})`,
      ...updates.map((entry) => entry[1]),
      ...ids
    );
    return 'soft';
  }
}

export async function runAdminMmoProductAction(input: Record<string, unknown>, adminId: number, req?: NextRequest) {
  const action = String(input.action || '').trim();
  const ids = Array.isArray(input.ids)
    ? input.ids.map((item) => parseInteger(item, 0)).filter((item) => item > 0)
    : [];
  const id = parseInteger(input.id, 0);
  const targetIds = id > 0 ? [id] : ids;

  if (action === 'sync') {
    const result = await syncMmoResourcesFromProviders();
    await logAdminAction({
      adminId,
      action: 'sync mmo resources',
      target: `${result.providers} provider / ${result.categories} categories / ${result.products} products`,
      req,
    });
    return { success: true, data: normalizeValue(result) };
  }

  if (targetIds.length === 0) {
    throw new Error('Chọn ít nhất một sản phẩm');
  }

  if (action === 'bulk-toggle-status') {
    const status = String(input.status || '').trim().toLowerCase() === 'inactive' ? 'inactive' : 'active';
    await bulkSetResourceStatus(targetIds, status);
    await logAdminAction({ adminId, action: `bulk toggle mmo resources ${status}`, target: `${targetIds.length} items`, req });
    return { success: true, affected: targetIds.length };
  }

  if (action === 'bulk-update-stats') {
    await bulkUpdateResourceStats(targetIds, input);
    await logAdminAction({ adminId, action: 'bulk update mmo resource stats', target: `${targetIds.length} items`, req });
    return { success: true, affected: targetIds.length };
  }

  if (action === 'bulk-update-margin') {
    await bulkUpdateResourceMargin(targetIds, input);
    await logAdminAction({
      adminId,
      action: 'bulk update mmo resource margin',
      target: `${targetIds.length} items (${parseFloatNumber(input.percent, 0)}%)`,
      req,
    });
    return { success: true, affected: targetIds.length };
  }

  if (action === 'bulk-update-category') {
    await bulkUpdateResourceCategory(targetIds, input);
    await logAdminAction({ adminId, action: 'bulk update mmo resource category', target: `${targetIds.length} items`, req });
    return { success: true, affected: targetIds.length };
  }

  if (action === 'bulk-duplicate') {
    const duplicated = await duplicateMmoResources(targetIds);
    await logAdminAction({ adminId, action: 'bulk duplicate mmo resources', target: `${duplicated} copies`, req });
    return { success: true, duplicated };
  }

  if (action === 'bulk-delete') {
    const mode = await bulkDeleteResourcesWithFallback(targetIds);
    await logAdminAction({ adminId, action: `bulk ${mode} delete mmo resources`, target: `${targetIds.length} items`, req });
    return { success: true, affected: targetIds.length, mode };
  }

  if (action === 'update-display-order') {
    await bulkUpdateResourceStats(targetIds, { display_order: input.display_order });
    await logAdminAction({ adminId, action: 'update mmo resource order', target: `${targetIds.join(', ')}`, req });
    return { success: true, affected: targetIds.length };
  }

  throw new Error('Action chưa được hỗ trợ');
}

async function syncResourceStock(resourceId: number) {
  if (!(await tableExists('mmo_resource_items'))) return null;
  const stockRows = await db.$queryRawUnsafe<Array<{ total: number | bigint }>>(
    "SELECT COUNT(*) AS total FROM mmo_resource_items WHERE resource_id = ? AND status = 'active'",
    resourceId
  );
  const stock = Number(stockRows[0]?.total || 0);
  if (await hasColumn('mmo_resources', 'stock')) {
    await db.$executeRawUnsafe('UPDATE mmo_resources SET stock = ? WHERE id = ?', stock, resourceId);
  }
  return stock;
}

export async function getAdminMmoProductInventory(resourceId: number) {
  if (!resourceId) {
    throw new Error('Thiếu resource_id');
  }

  if (!(await tableExists('mmo_resource_items'))) {
    return {
      success: true,
      enabled: false,
      message: 'Database hiện tại chưa có bảng mmo_resource_items',
      items: [],
      stats: { active: 0, sold: 0 },
    };
  }

  const [items, statsRows] = await Promise.all([
    db.$queryRawUnsafe<Row[]>(
      'SELECT * FROM mmo_resource_items WHERE resource_id = ? ORDER BY id DESC LIMIT 1000',
      resourceId
    ),
    db.$queryRawUnsafe<Array<{ status: string | null; count: number | bigint }>>(
      'SELECT status, COUNT(*) AS count FROM mmo_resource_items WHERE resource_id = ? GROUP BY status',
      resourceId
    ),
  ]);

  const statMap = new Map(statsRows.map((row) => [String(row.status || ''), Number(row.count || 0)]));
  return {
    success: true,
    enabled: true,
    items: normalizeValue(items),
    stats: {
      active: statMap.get('active') || 0,
      sold: statMap.get('sold') || 0,
    },
  };
}

export async function mutateAdminMmoProductInventory(input: Record<string, unknown>, adminId: number, req?: NextRequest) {
  if (!(await tableExists('mmo_resource_items'))) {
    throw new Error('Database hiện tại chưa có bảng mmo_resource_items');
  }

  const action = String(input.action || '').trim();

  if (action === 'add-items') {
    const resourceId = parseInteger(input.resource_id, 0);
    const content = String(input.content || '').replace(/\r/g, '');
    const lines = content.split('\n').map((item) => item.trim()).filter(Boolean);
    if (!resourceId || lines.length === 0) {
      throw new Error('Thiếu dữ liệu thêm kho');
    }

    await db.$transaction(async (tx) => {
      for (const line of lines) {
        await tx.$executeRawUnsafe(
          "INSERT INTO mmo_resource_items (resource_id, content, status) VALUES (?, ?, 'active')",
          resourceId,
          line
        );
      }
    });

    const newStock = await syncResourceStock(resourceId);
    await logAdminAction({ adminId, action: 'add mmo inventory items', target: `#${resourceId} +${lines.length}`, req });
    return { success: true, count: lines.length, new_stock: newStock };
  }

  if (action === 'delete-item') {
    const itemId = parseInteger(input.item_id, 0);
    if (!itemId) {
      throw new Error('Thiếu item_id');
    }

    const rows = await db.$queryRawUnsafe<Array<{ resource_id: number | bigint; status: string | null }>>(
      'SELECT resource_id, status FROM mmo_resource_items WHERE id = ? LIMIT 1',
      itemId
    );
    const item = rows[0];
    if (!item) {
      throw new Error('Không tìm thấy item');
    }

    await db.$executeRawUnsafe('DELETE FROM mmo_resource_items WHERE id = ?', itemId);
    const newStock = String(item.status || '') === 'active'
      ? await syncResourceStock(Number(item.resource_id || 0))
      : null;

    await logAdminAction({ adminId, action: 'delete mmo inventory item', target: `#${itemId}`, req });
    return { success: true, new_stock: newStock };
  }

  if (action === 'clear-sold') {
    const resourceId = parseInteger(input.resource_id, 0);
    if (!resourceId) {
      throw new Error('Thiếu resource_id');
    }

    await db.$executeRawUnsafe(
      "DELETE FROM mmo_resource_items WHERE resource_id = ? AND status = 'sold'",
      resourceId
    );
    await logAdminAction({ adminId, action: 'clear sold mmo inventory items', target: `#${resourceId}`, req });
    return { success: true };
  }

  throw new Error('Action kho chưa được hỗ trợ');
}
