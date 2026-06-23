import 'server-only';

import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { db } from '@/lib/db';
import { decryptLegacyData, encryptLegacyData } from '@/lib/legacy-crypto';
import { getLegacySettingsMap, getVatPercent } from '@/lib/legacy-settings';
import { createSmmProviderOrder, getSmmProviderOrderStatus } from '@/lib/smm-provider';
import { slugify, toNumber } from '@/lib/utils';

interface AutoMxhCategoryRow {
  id: number;
  name: string;
  slug: string | null;
  icon: string | null;
  gif: string | null;
  status: string;
}

interface AutoMxhProductRow {
  id: number;
  category_id: number;
  api_provider_id?: number | null;
  api_service_id?: string | number | null;
  name: string;
  description: string | null;
  badge?: string | null;
  custom_inputs?: string | null;
  input_label?: string | null;
  input_placeholder?: string | null;
  buyer_label?: string | null;
  buyer_placeholder?: string | null;
  min_price?: unknown;
  variant_count?: number | bigint | null;
}

interface AutoMxhVariantRow {
  id: number;
  product_id: number;
  api_provider_id?: number | null;
  api_service_id?: string | number | null;
  quantity: number | null;
  name: string;
  price: unknown;
  cost: unknown;
  original_price: unknown;
  description: string | null;
  badge: string | null;
  type: string | null;
  allow_avatar: boolean | number | null;
  allow_files: boolean | number | null;
  product_name?: string;
  p_api_provider_id?: number | null;
  p_api_service_id?: string | number | null;
}

interface AutoMxhOrderRow {
  id: number;
  product_id: number;
  variant_id: number | null;
  api_order_id: string | null;
  link: string | null;
  buyer_info: string | null;
  custom_value: string | null;
  price: unknown;
  status: string | null;
  perfection_content: string | null;
  perfection_image: string | null;
  created_at: Date | string;
  product_name: string;
  variant_name: string | null;
}

export interface AutoMxhCategory {
  id: number;
  name: string;
  slug: string;
  icon: string;
  gif: string;
  status: string;
}

export interface AutoMxhProduct {
  id: number;
  category_id: number;
  api_provider_id?: number;
  api_service_id?: string;
  name: string;
  description: string;
  badge: string;
  min_price: number;
  variant_count: number;
  custom_inputs?: string;
  input_label?: string;
  input_placeholder?: string;
  buyer_label?: string;
  buyer_placeholder?: string;
}

export interface AutoMxhVariant {
  id: number;
  product_id: number;
  api_provider_id?: number;
  api_service_id?: string;
  quantity: number;
  name: string;
  price: number;
  cost: number;
  original_price: number;
  description: string;
  badge: string;
  type: string;
  allow_avatar: boolean;
  allow_files: boolean;
}

interface AutoMxhVariantForOrder extends AutoMxhVariant {
  product_name: string;
  product_api_provider_id: number;
  product_api_service_id: string;
}

export interface AutoMxhProductWithVariants extends AutoMxhProduct {
  variants: AutoMxhVariant[];
}

export interface AutoMxhCatalogSection {
  category: AutoMxhCategory;
  products: AutoMxhProduct[];
}

function normalizeCategory(row: AutoMxhCategoryRow): AutoMxhCategory {
  return {
    id: Number(row.id),
    name: row.name,
    slug: row.slug || slugify(row.name),
    icon: row.icon || '',
    gif: row.gif || '',
    status: row.status,
  };
}

function normalizeProduct(row: AutoMxhProductRow): AutoMxhProduct {
  return {
    id: Number(row.id),
    category_id: Number(row.category_id),
    api_provider_id: Math.max(0, Math.trunc(toNumber(row.api_provider_id, 0))),
    api_service_id: row.api_service_id === null || row.api_service_id === undefined ? '' : String(row.api_service_id),
    name: row.name,
    description: row.description || '',
    badge: row.badge || '',
    min_price: toNumber(row.min_price, 0),
    variant_count: Number(row.variant_count || 0),
    custom_inputs: row.custom_inputs || '',
    input_label: row.input_label || '',
    input_placeholder: row.input_placeholder || '',
    buyer_label: row.buyer_label || '',
    buyer_placeholder: row.buyer_placeholder || '',
  };
}

function normalizeVariant(row: AutoMxhVariantRow): AutoMxhVariant {
  return {
    id: Number(row.id),
    product_id: Number(row.product_id),
    api_provider_id: Math.max(0, Math.trunc(toNumber(row.api_provider_id, 0))),
    api_service_id: row.api_service_id === null || row.api_service_id === undefined ? '' : String(row.api_service_id),
    quantity: Math.max(1, Math.trunc(toNumber(row.quantity, 1))),
    name: row.name,
    price: toNumber(row.price, 0),
    cost: toNumber(row.cost, 0),
    original_price: toNumber(row.original_price, 0),
    description: row.description || '',
    badge: row.badge || '',
    type: row.type || '',
    allow_avatar: row.allow_avatar === true || toNumber(row.allow_avatar, 0) === 1,
    allow_files: row.allow_files === true || toNumber(row.allow_files, 0) === 1,
  };
}

function normalizeAutoMxhOrderStatus(value: unknown, fallback = 'pending') {
  const normalized = String(value || '').trim().toLowerCase();

  if (['pending', 'processing', 'completed', 'canceled', 'refunded'].includes(normalized)) {
    return normalized;
  }

  if (normalized === 'cancelled') {
    return 'canceled';
  }

  if (normalized === 'refund') {
    return 'refunded';
  }

  if (['complete', 'success', 'done', '200'].includes(normalized)) {
    return 'completed';
  }

  if (['running', 'active', 'in progress', 'in_progress', 'inprogress', '0', '100'].includes(normalized)) {
    return 'processing';
  }

  if (['failed', 'fail', 'error', '-1'].includes(normalized)) {
    return 'canceled';
  }

  return normalized || fallback;
}

export function parseProductInputs(product: Pick<AutoMxhProduct, 'custom_inputs' | 'input_label' | 'input_placeholder' | 'buyer_label' | 'buyer_placeholder'>) {
  const inputs: Array<{ label: string; placeholder: string }> = [];
  if (product.input_label) {
    inputs.push({
      label: product.input_label,
      placeholder: product.input_placeholder || product.input_label,
    });
  }
  if (product.buyer_label) {
    inputs.push({
      label: product.buyer_label,
      placeholder: product.buyer_placeholder || product.buyer_label,
    });
  }

  if (inputs.length > 0) {
    return inputs;
  }

  try {
    const parsed = product.custom_inputs ? JSON.parse(product.custom_inputs) : [];
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed
        .map((input) => ({
          label: String(input?.label || '').trim(),
          placeholder: String(input?.placeholder || '').trim(),
        }))
        .filter((input) => input.label);
    }
  } catch {
    // Fallback below mirrors PHP.
  }

  return [];
}

async function autoMxhColumnExists(tableName: string, columnName: string) {
  const rows = await db.$queryRawUnsafe<Array<{ column_name: string }>>(
    `
      SELECT COLUMN_NAME AS column_name
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND column_name = ?
      LIMIT 1
    `,
    tableName,
    columnName
  ).catch(() => []);

  return rows.length > 0;
}

async function getAutoMxhColumnSet(tableName: string) {
  const rows = await db.$queryRawUnsafe<Array<{ column_name: string }>>(
    `
      SELECT COLUMN_NAME AS column_name
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
    `,
    tableName
  ).catch(() => []);

  return new Set(rows.map((row) => String(row.column_name || '').trim()).filter(Boolean));
}

function addAutoMxhColumnValue(
  columns: Set<string>,
  targetColumns: string[],
  targetValues: unknown[],
  column: string,
  value: unknown
) {
  if (!columns.has(column)) {
    return;
  }

  targetColumns.push(`\`${column}\``);
  targetValues.push(value);
}

async function updateAutoMxhOrderColumns(
  orderId: number,
  columns: Set<string>,
  updates: Record<string, unknown>
) {
  const entries = Object.entries(updates).filter(([key]) => columns.has(key));
  if (entries.length === 0) {
    return;
  }

  await db.$executeRawUnsafe(
    `UPDATE automxh_orders SET ${entries.map(([key]) => `\`${key}\` = ?`).join(', ')} WHERE id = ?`,
    ...entries.map(([, value]) => value),
    orderId
  );
}

function autoMxhColumnSelect(columns: Set<string>, column: string, fallback = "''") {
  return columns.has(column) ? `p.\`${column}\`` : fallback;
}

function autoMxhAggregateColumnSelect(columns: Set<string>, column: string, fallback = "''") {
  return columns.has(column) ? `MAX(p.\`${column}\`)` : fallback;
}

export async function listAutoMxhCatalog(): Promise<AutoMxhCatalogSection[]> {
  const [categoriesRows, productColumns] = await Promise.all([
    db.$queryRaw<AutoMxhCategoryRow[]>`
      SELECT id, name, slug, icon, gif, status
      FROM automxh_categories
      WHERE status = 'active'
      ORDER BY name ASC
    `,
    getAutoMxhColumnSet('automxh_products'),
  ]);
  const hasProductBadge = productColumns.has('badge');
  const productBadgeSelect = hasProductBadge ? 'p.badge' : "''";
  const productBadgeGroupBy = hasProductBadge ? ', p.badge' : '';
  const productApiProviderSelect = productColumns.has('api_provider_id') ? 'MAX(p.api_provider_id)' : '0';
  const productApiServiceSelect = productColumns.has('api_service_id') ? 'MAX(p.api_service_id)' : "''";
  const productDeletedCondition = productColumns.has('is_deleted')
    ? 'AND COALESCE(p.is_deleted, 0) = 0'
    : '';
  const variantDeletedCondition = await autoMxhColumnExists('automxh_variants', 'is_deleted')
    ? 'AND COALESCE(v.is_deleted, 0) = 0'
    : '';
  const productRows = await db.$queryRawUnsafe<AutoMxhProductRow[]>(
    `
      SELECT
        p.id,
        p.category_id,
        ${productApiProviderSelect} AS api_provider_id,
        ${productApiServiceSelect} AS api_service_id,
        p.name,
        p.description,
        ${productBadgeSelect} AS badge,
        ${autoMxhAggregateColumnSelect(productColumns, 'custom_inputs')} AS custom_inputs,
        ${autoMxhAggregateColumnSelect(productColumns, 'input_label')} AS input_label,
        ${autoMxhAggregateColumnSelect(productColumns, 'input_placeholder')} AS input_placeholder,
        ${autoMxhAggregateColumnSelect(productColumns, 'buyer_label')} AS buyer_label,
        ${autoMxhAggregateColumnSelect(productColumns, 'buyer_placeholder')} AS buyer_placeholder,
        COALESCE(MIN(v.price), p.price, 0) AS min_price,
        COUNT(v.id) AS variant_count
      FROM automxh_products p
      LEFT JOIN automxh_variants v ON p.id = v.product_id AND v.status = 'active' ${variantDeletedCondition}
      WHERE p.status = 'active'
        ${productDeletedCondition}
      GROUP BY p.id, p.category_id, p.name, p.description, p.price${productBadgeGroupBy}
      ORDER BY p.id ASC
    `
  );

  const categories = categoriesRows.map(normalizeCategory);
  const products = productRows.map(normalizeProduct);

  return categories
    .map((category) => ({
      category,
      products: products.filter((product) => product.category_id === category.id),
    }))
    .filter((section) => section.products.length > 0);
}

export async function getAutoMxhCategory(slug: string) {
  const categoryRows = await db.$queryRaw<AutoMxhCategoryRow[]>`
    SELECT id, name, slug, icon, gif, status
    FROM automxh_categories
    WHERE status = 'active'
    ORDER BY name ASC
  `;

  const categories = categoryRows.map(normalizeCategory);
  return categories.find((category) => category.slug === slug || slugify(category.name) === slug) || null;
}

export async function getAutoMxhProductsForCategory(categoryId: number): Promise<AutoMxhProductWithVariants[]> {
  const productColumns = await getAutoMxhColumnSet('automxh_products');
  const variantColumns = await getAutoMxhColumnSet('automxh_variants');
  const hasProductBadge = productColumns.has('badge');
  const productApiProviderSelect = productColumns.has('api_provider_id') ? '`api_provider_id`' : '0';
  const productApiServiceSelect = productColumns.has('api_service_id') ? '`api_service_id`' : "''";
  const productDeletedCondition = productColumns.has('is_deleted')
    ? 'AND COALESCE(is_deleted, 0) = 0'
    : '';
  const productRows = await db.$queryRawUnsafe<AutoMxhProductRow[]>(
    `
    SELECT
      id,
      category_id,
      ${productApiProviderSelect} AS api_provider_id,
      ${productApiServiceSelect} AS api_service_id,
      name,
      description,
      ${hasProductBadge ? '`badge`' : "''"} AS badge,
      ${productColumns.has('custom_inputs') ? '`custom_inputs`' : "''"} AS custom_inputs,
      ${productColumns.has('input_label') ? '`input_label`' : "''"} AS input_label,
      ${productColumns.has('input_placeholder') ? '`input_placeholder`' : "''"} AS input_placeholder,
      ${productColumns.has('buyer_label') ? '`buyer_label`' : "''"} AS buyer_label,
      ${productColumns.has('buyer_placeholder') ? '`buyer_placeholder`' : "''"} AS buyer_placeholder,
      COALESCE(price, 0) AS min_price,
      0 AS variant_count
    FROM automxh_products
    WHERE category_id = ? AND status = 'active'
      ${productDeletedCondition}
    ORDER BY id ASC
  `,
    categoryId
  );

  const products = productRows.map(normalizeProduct);
  if (products.length === 0) {
    return [];
  }

  const variantDeletedSql = variantColumns.has('is_deleted')
    ? Prisma.sql`AND COALESCE(is_deleted, 0) = 0`
    : Prisma.empty;
  const variantRows = await db.$queryRaw<AutoMxhVariantRow[]>(Prisma.sql`
    SELECT
      id,
      product_id,
      ${variantColumns.has('api_provider_id') ? Prisma.sql`api_provider_id` : Prisma.sql`0 AS api_provider_id`},
      ${variantColumns.has('api_service_id') ? Prisma.sql`api_service_id` : Prisma.sql`'' AS api_service_id`},
      quantity,
      name,
      price,
      cost,
      original_price,
      description,
      badge,
      type,
      allow_avatar,
      allow_files
    FROM automxh_variants
    WHERE product_id IN (${Prisma.join(products.map((product) => product.id))}) AND status = 'active'
    ${variantDeletedSql}
    ORDER BY id ASC
  `);
  const variants = variantRows.map(normalizeVariant);

  return products.map((product) => ({
    ...product,
    variants: variants.filter((variant) => variant.product_id === product.id),
  }));
}

export async function getAutoMxhRecentOrders(userId: number, productIds: number[] = []) {
  const productFilter = productIds.length
    ? Prisma.sql`AND o.product_id IN (${Prisma.join(productIds)})`
    : Prisma.empty;

  const rows = await db.$queryRaw<AutoMxhOrderRow[]>(Prisma.sql`
    SELECT
      o.id,
      o.product_id,
      o.variant_id,
      o.api_order_id,
      o.link,
      o.buyer_info,
      o.custom_value,
      o.price,
      o.status,
      o.perfection_content,
      o.perfection_image,
      o.created_at,
      p.name AS product_name,
      v.name AS variant_name
    FROM automxh_orders o
    JOIN automxh_products p ON o.product_id = p.id
    LEFT JOIN automxh_variants v ON o.variant_id = v.id
    WHERE o.user_id = ${userId}
    ${productFilter}
    ORDER BY o.id DESC
    LIMIT 50
  `);

  return rows.map((row) => ({
    id: Number(row.id),
    product_id: Number(row.product_id),
    variant_id: row.variant_id ? Number(row.variant_id) : null,
    api_order_id: row.api_order_id || '',
    link: row.link || '',
    buyer_info: decryptLegacyData(row.buyer_info),
    custom_value: decryptLegacyData(row.custom_value),
    price: toNumber(row.price, 0),
    order_status: row.status || 'pending',
    perfection_content: row.perfection_content || '',
    perfection_image: row.perfection_image || '',
    product_name: row.product_name,
    variant_name: row.variant_name || '',
    created_at:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : new Date(row.created_at).toISOString(),
  }));
}

export async function findAutoMxhVariantForOrder(input: {
  productId?: number | null;
  variantId: number;
}): Promise<AutoMxhVariantForOrder | null> {
  const productFilter = input.productId && input.productId > 0
    ? Prisma.sql`AND v.product_id = ${input.productId}`
    : Prisma.empty;
  const variantDeletedSql = await autoMxhColumnExists('automxh_variants', 'is_deleted')
    ? Prisma.sql`AND COALESCE(v.is_deleted, 0) = 0`
    : Prisma.empty;
  const productDeletedSql = await autoMxhColumnExists('automxh_products', 'is_deleted')
    ? Prisma.sql`AND COALESCE(p.is_deleted, 0) = 0`
    : Prisma.empty;

  const rows = await db.$queryRaw<AutoMxhVariantRow[]>(Prisma.sql`
    SELECT
      v.id,
      v.product_id,
      v.api_provider_id,
      v.api_service_id,
      v.quantity,
      v.name,
      v.price,
      v.cost,
      v.original_price,
      v.description,
      v.badge,
      v.type,
      v.allow_avatar,
      v.allow_files,
      p.name AS product_name,
      p.api_provider_id AS p_api_provider_id,
      p.api_service_id AS p_api_service_id
    FROM automxh_variants v
    JOIN automxh_products p ON v.product_id = p.id
    WHERE v.id = ${input.variantId}
      ${productFilter}
      AND v.status = 'active'
      AND p.status = 'active'
      ${variantDeletedSql}
      ${productDeletedSql}
    LIMIT 1
  `);

  const row = rows[0];
  if (!row) {
    return null;
  }

  const normalized = normalizeVariant(row);

  return {
    ...normalized,
    product_name: String(row.product_name || normalized.name),
    product_api_provider_id: Math.max(0, Math.trunc(toNumber(row.p_api_provider_id, 0))),
    product_api_service_id: row.p_api_service_id === null || row.p_api_service_id === undefined ? '' : String(row.p_api_service_id),
  };
}

export async function getAutoMxhCheckoutAmount(variant: AutoMxhVariant): Promise<{
  subtotal: number;
  vatAmount: number;
  totalToPay: number;
  vatPercent: number;
}> {
  const settings = await getLegacySettingsMap();
  const vatPercent = getVatPercent(settings);
  const subtotal = Math.max(0, Math.round(toNumber(variant.price, 0)));
  const vatAmount = Math.round((subtotal * vatPercent) / 100);
  const totalToPay = Math.round(subtotal + vatAmount);

  return { subtotal, vatAmount, totalToPay, vatPercent };
}

export async function quoteAutoMxhOrder(input: { productId?: number | null; variantId: number }) {
  const variant = await findAutoMxhVariantForOrder(input);
  if (!variant) {
    throw new Error('Không tìm thấy máy chủ/gói Auto MXH');
  }

  const checkout = await getAutoMxhCheckoutAmount(variant);

  return {
    variant,
    checkout,
  };
}

export async function createAutoMxhOrderForUser(input: {
  userId: number;
  productId?: number | null;
  variantId: number;
  link: string;
  buyerInfo?: string;
  customValue?: string;
  confirm1?: boolean;
  confirm2?: boolean;
  source?: string;
}) {
  const userId = Math.max(0, Math.trunc(toNumber(input.userId, 0)));
  const variantId = Math.max(0, Math.trunc(toNumber(input.variantId, 0)));
  const productId = input.productId === undefined || input.productId === null
    ? undefined
    : Math.max(0, Math.trunc(toNumber(input.productId, 0)));
  const link = String(input.link || '').trim();
  const buyerInfo = String(input.buyerInfo || '').trim();
  const customValue = String(input.customValue || '').trim();
  const confirm1 = input.confirm1 !== false;
  const confirm2 = input.confirm2 ? 1 : 0;

  if (!userId) {
    throw new Error('User không hợp lệ');
  }

  if (!variantId || !link) {
    throw new Error('Thiếu variant_id hoặc link');
  }

  if (!confirm1) {
    throw new Error('Vui lòng xác nhận điều khoản');
  }

  const [user, quoted, orderColumns] = await Promise.all([
    db.users.findUnique({
      where: { id: userId },
      select: { id: true, balance: true, status: true },
    }),
    quoteAutoMxhOrder({ productId, variantId }),
    getAutoMxhColumnSet('automxh_orders'),
  ]);

  if (!user) {
    throw new Error('Không tìm thấy tài khoản');
  }

  if (String(user.status || '').trim().toLowerCase() !== 'active') {
    throw new Error('Tài khoản hiện không hoạt động');
  }

  const { variant, checkout } = quoted;
  const currentBalance = toNumber(user.balance, 0);

  if (currentBalance < checkout.totalToPay) {
    throw new Error('Số dư ví chính không đủ. Vui lòng nạp thêm tiền vào web');
  }

  const costPrice = toNumber(variant.cost, 0) || toNumber(variant.original_price, 0);
  const apiProviderId = Math.max(0, Math.trunc(toNumber(variant.api_provider_id || variant.product_api_provider_id, 0)));
  const apiServiceId = String(variant.api_service_id || variant.product_api_service_id || '').trim();
  const now = new Date();
  const fileDeleteAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const secureToken = randomBytes(16).toString('hex');

  const result = await db.$transaction(async (tx) => {
    const updated = await tx.users.updateMany({
      where: {
        id: userId,
        balance: { gte: checkout.totalToPay },
      },
      data: {
        balance: { decrement: checkout.totalToPay },
        last_activity: now,
      },
    });

    if (updated.count === 0) {
      throw new Error('Giao dịch thất bại. Vui lòng kiểm tra lại số dư.');
    }

    const updatedUser = await tx.users.findUnique({
      where: { id: userId },
      select: { balance: true },
    });
    const balanceAfter = toNumber(updatedUser?.balance, currentBalance - checkout.totalToPay);

    const insertColumns: string[] = [];
    const insertValues: unknown[] = [];

    addAutoMxhColumnValue(orderColumns, insertColumns, insertValues, 'user_id', userId);
    addAutoMxhColumnValue(orderColumns, insertColumns, insertValues, 'category_id', null);
    addAutoMxhColumnValue(orderColumns, insertColumns, insertValues, 'product_id', variant.product_id);
    addAutoMxhColumnValue(orderColumns, insertColumns, insertValues, 'variant_id', variant.id);
    addAutoMxhColumnValue(orderColumns, insertColumns, insertValues, 'title', variant.product_name || variant.name);
    addAutoMxhColumnValue(orderColumns, insertColumns, insertValues, 'link', link);
    addAutoMxhColumnValue(orderColumns, insertColumns, insertValues, 'quantity', variant.quantity);
    addAutoMxhColumnValue(orderColumns, insertColumns, insertValues, 'amount', checkout.totalToPay);
    addAutoMxhColumnValue(orderColumns, insertColumns, insertValues, 'buyer_info', encryptLegacyData(buyerInfo));
    addAutoMxhColumnValue(orderColumns, insertColumns, insertValues, 'custom_value', encryptLegacyData(customValue));
    addAutoMxhColumnValue(orderColumns, insertColumns, insertValues, 'status', 'pending');
    addAutoMxhColumnValue(orderColumns, insertColumns, insertValues, 'created_at', now);
    addAutoMxhColumnValue(orderColumns, insertColumns, insertValues, 'updated_at', now);
    addAutoMxhColumnValue(orderColumns, insertColumns, insertValues, 'api_provider_id', apiProviderId);
    addAutoMxhColumnValue(orderColumns, insertColumns, insertValues, 'api_order_id', '');
    addAutoMxhColumnValue(orderColumns, insertColumns, insertValues, 'confirm_1', 1);
    addAutoMxhColumnValue(orderColumns, insertColumns, insertValues, 'confirm_2', confirm2);
    addAutoMxhColumnValue(orderColumns, insertColumns, insertValues, 'price', checkout.subtotal);
    addAutoMxhColumnValue(orderColumns, insertColumns, insertValues, 'cost_price', costPrice);
    addAutoMxhColumnValue(orderColumns, insertColumns, insertValues, 'file_delete_at', fileDeleteAt);
    addAutoMxhColumnValue(orderColumns, insertColumns, insertValues, 'secure_token', secureToken);

    if (insertColumns.length === 0) {
      throw new Error('Bảng automxh_orders không có cột hợp lệ để tạo đơn');
    }

    await tx.$executeRawUnsafe(
      `INSERT INTO automxh_orders (${insertColumns.join(', ')}) VALUES (${insertColumns.map(() => '?').join(', ')})`,
      ...insertValues
    );

    const inserted = await tx.$queryRaw<Array<{ id: bigint | number }>>`SELECT LAST_INSERT_ID() AS id`;
    const orderId = Number(inserted[0]?.id || 0);

    await tx.transactions.create({
      data: {
        user_id: userId,
        type: 'order',
        amount: -checkout.totalToPay,
        balance_after: balanceAfter,
        content: `Thanh toán đơn hàng Auto MXH API #${orderId}`,
        status: 'success',
      },
    });

    return { orderId, balanceAfter };
  });

  let providerOrderId = '';
  let providerError = '';

  if (apiProviderId > 0 && apiServiceId) {
    try {
      const serviceId = Math.max(0, Math.trunc(Number(apiServiceId)));
      if (serviceId > 0) {
        const providerOrder = await createSmmProviderOrder({
          providerId: apiProviderId,
          serviceId,
          link,
          quantity: variant.quantity,
        });
        providerOrderId = providerOrder.orderId;

        await updateAutoMxhOrderColumns(result.orderId, orderColumns, {
          api_order_id: providerOrder.orderId,
          status: 'processing',
          api_response: JSON.stringify(providerOrder),
          updated_at: new Date(),
        });
      }
    } catch (error) {
      providerError = error instanceof Error ? error.message : 'Provider error';
      await updateAutoMxhOrderColumns(result.orderId, orderColumns, {
        api_response: JSON.stringify({ success: false, error: providerError }),
        updated_at: new Date(),
      });
    }
  }

  return {
    orderId: result.orderId,
    providerOrderId,
    providerError,
    balanceAfter: result.balanceAfter,
    variant,
    checkout,
  };
}

export async function listAutoMxhOrdersForUser(input: {
  userId: number;
  productIds?: number[];
  limit?: number;
}) {
  const limit = Math.min(100, Math.max(1, Math.trunc(toNumber(input.limit, 50))));
  const productIds = (input.productIds || [])
    .map((value) => Math.trunc(toNumber(value, 0)))
    .filter((value) => value > 0);
  const productFilter = productIds.length
    ? Prisma.sql`AND o.product_id IN (${Prisma.join(productIds)})`
    : Prisma.empty;

  const rows = await db.$queryRaw<Array<{
    id: number;
    product_id: number | null;
    variant_id: number | null;
    api_provider_id?: number | null;
    api_order_id?: string | null;
    title: string | null;
    link: string | null;
    quantity: number | null;
    amount: unknown;
    price?: unknown;
    status: string | null;
    reason?: string | null;
    is_refunded?: boolean | number | null;
    refund_amount?: unknown;
    created_at: Date | string;
    updated_at: Date | string;
  }>>(Prisma.sql`
    SELECT *
    FROM automxh_orders o
    WHERE o.user_id = ${input.userId}
    ${productFilter}
    ORDER BY o.id DESC
    LIMIT ${limit}
  `);

  return rows.map((row) => ({
    id: Number(row.id || 0),
    product_id: row.product_id ? Number(row.product_id) : null,
    variant_id: row.variant_id ? Number(row.variant_id) : null,
    api_provider_id: Math.max(0, Math.trunc(toNumber(row.api_provider_id, 0))),
    api_order_id: String(row.api_order_id || ''),
    title: String(row.title || ''),
    link: String(row.link || ''),
    quantity: Math.max(1, Math.trunc(toNumber(row.quantity, 1))),
    amount: toNumber(row.amount, 0),
    price: toNumber(row.price, 0),
    status: normalizeAutoMxhOrderStatus(row.status),
    reason: String(row.reason || ''),
    is_refunded: Boolean(row.is_refunded),
    refund_amount: toNumber(row.refund_amount, 0),
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : new Date(row.updated_at).toISOString(),
  }));
}

export async function getAutoMxhOrderStatusForUser(input: {
  userId: number;
  orderId: number;
  isAdmin?: boolean;
}) {
  const rows = await db.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT *
    FROM automxh_orders
    WHERE id = ${input.orderId}
    LIMIT 1
  `);
  const order = rows[0];

  if (!order) {
    throw new Error('Không tìm thấy đơn Auto MXH');
  }

  const ownerId = Math.trunc(toNumber(order.user_id, 0));
  if (!input.isAdmin && ownerId !== input.userId) {
    throw new Error('Bạn chỉ được kiểm tra đơn Auto MXH của chính mình');
  }

  const providerOrderId = String(order.api_order_id || '').trim();
  const apiProviderId = Math.max(0, Math.trunc(toNumber(order.api_provider_id, 0)));
  let providerStatus: Record<string, unknown> | null = null;

  if (providerOrderId && apiProviderId > 0) {
    try {
      providerStatus = await getSmmProviderOrderStatus(providerOrderId, apiProviderId);
      await updateAutoMxhOrderColumns(input.orderId, await getAutoMxhColumnSet('automxh_orders'), {
        api_status_log: JSON.stringify(providerStatus),
        updated_at: new Date(),
        ...(typeof providerStatus.status === 'string' ? { status: normalizeAutoMxhOrderStatus(providerStatus.status) } : {}),
      });
    } catch (error) {
      providerStatus = {
        success: false,
        error: error instanceof Error ? error.message : 'Không thể lấy trạng thái provider',
      };
    }
  }

  return {
    id: Number(order.id || 0),
    order: Number(order.id || 0),
    api_order_id: providerOrderId,
    status: normalizeAutoMxhOrderStatus(order.status),
    product_id: order.product_id ? Number(order.product_id) : null,
    variant_id: order.variant_id ? Number(order.variant_id) : null,
    quantity: Math.max(1, Math.trunc(toNumber(order.quantity, 1))),
    amount: toNumber(order.amount, 0),
    price: toNumber(order.price, 0),
    reason: String(order.reason || ''),
    provider_status: providerStatus,
    created_at: order.created_at instanceof Date ? order.created_at.toISOString() : new Date(String(order.created_at)).toISOString(),
    updated_at: order.updated_at instanceof Date ? order.updated_at.toISOString() : new Date(String(order.updated_at)).toISOString(),
  };
}
