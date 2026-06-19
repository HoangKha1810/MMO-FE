import 'server-only';

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { decryptLegacyData } from '@/lib/legacy-crypto';
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
  const hasProductBadge = productColumns.has('badge');
  const productDeletedCondition = productColumns.has('is_deleted')
    ? 'AND COALESCE(is_deleted, 0) = 0'
    : '';
  const productRows = await db.$queryRawUnsafe<AutoMxhProductRow[]>(
    `
    SELECT
      id,
      category_id,
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

  const variantDeletedSql = await autoMxhColumnExists('automxh_variants', 'is_deleted')
    ? Prisma.sql`AND COALESCE(is_deleted, 0) = 0`
    : Prisma.empty;
  const variantRows = await db.$queryRaw<AutoMxhVariantRow[]>(Prisma.sql`
    SELECT
      id,
      product_id,
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
