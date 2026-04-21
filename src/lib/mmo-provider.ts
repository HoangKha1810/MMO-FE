import 'server-only';

import { db } from '@/lib/db';
import { slugify, toNumber } from '@/lib/utils';

type Row = Record<string, unknown>;

interface ProviderRecord {
  id: number;
  name: string;
  type: string | null;
  api_url: string | null;
  api_key: string | null;
  exchange_rate: unknown;
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

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, '');
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function truthy(value: unknown) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function normalizeMoney(value: unknown, exchangeRate: number) {
  const amount = Math.max(0, toNumber(value, 0));
  return Math.round(amount * Math.max(exchangeRate, 1) * 100) / 100;
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
    },
  });
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

  if (!apiUrl || !apiKey) {
    throw new Error(`Provider ${provider.name} chưa có api_url hoặc api_key`);
  }

  const url = new URL(`${apiUrl}/${endpoint.replace(/^\/+/, '')}`);
  url.searchParams.set('api_key', apiKey);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`Provider ${provider.name} trả về dữ liệu không hợp lệ`);
  }

  if (!response.ok) {
    const message = asObject(payload)?.msg;
    throw new Error(typeof message === 'string' && message.trim() ? message : `Provider ${provider.name} trả về HTTP ${response.status}`);
  }

  const payloadObject = asObject(payload);
  if (payloadObject && typeof payloadObject.status === 'string' && payloadObject.status.toLowerCase() !== 'success') {
    const message = payloadObject.msg;
    throw new Error(typeof message === 'string' && message.trim() ? message : `Provider ${provider.name} trả về lỗi`);
  }

  return payload as T;
}

async function requestCloneTutBuy(provider: ProviderRecord, input: { productId: string; amount: number; coupon?: string }) {
  const apiUrl = normalizeBaseUrl(String(provider.api_url || ''));
  const apiKey = String(provider.api_key || '').trim();

  if (!apiUrl || !apiKey) {
    throw new Error(`Provider ${provider.name} chưa có api_url hoặc api_key`);
  }

  const body = new URLSearchParams({
    action: 'buyProduct',
    id: input.productId,
    amount: String(Math.max(1, Math.trunc(input.amount || 1))),
    api_key: apiKey,
  });

  if (input.coupon?.trim()) {
    body.set('coupon', input.coupon.trim());
  }

  const response = await fetch(`${apiUrl}/buy_product`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
    cache: 'no-store',
  });

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`Provider ${provider.name} trả về dữ liệu mua hàng không hợp lệ`);
  }

  if (!response.ok) {
    const message = asObject(payload)?.msg;
    throw new Error(typeof message === 'string' && message.trim() ? message : `Provider ${provider.name} trả về HTTP ${response.status}`);
  }

  const data = asObject(payload);
  if (!data) {
    throw new Error(`Provider ${provider.name} không trả về dữ liệu mua hàng hợp lệ`);
  }

  if (String(data.status || '').toLowerCase() !== 'success') {
    throw new Error(typeof data.msg === 'string' && data.msg.trim() ? data.msg : 'Provider từ chối tạo đơn hàng');
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
    providerName: provider.name,
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
    providerName: provider.name,
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
    providerName: provider.name,
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

  return {
    providerId: provider.id,
    providerName: provider.name,
    orderId: String(payload.trans_id || ''),
    lines: asArray<string>(payload.data).map((item) => String(item || '').trim()).filter(Boolean),
    raw: payload,
  };
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

      const categoryName = String(remoteCategory.name || `Category ${remoteId}`).trim();
      const slug = existing?.slug || `${slugify(categoryName)}-${provider.id}-${remoteId}`;
      const icon = String(remoteCategory.icon || existing?.icon || 'package');
      const image = String(remoteCategory.icon || existing?.image || '');

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
      const title = String(entry.product.name || `Product ${remoteProductId}`).trim();
      const description = String(entry.product.description || '').trim();
      const categoryName = String(entry.category.name || existing?.category || 'Tài nguyên').trim();
      const providerPrice = normalizeMoney(entry.product.price, exchangeRate);
      const stock = Math.max(0, Math.trunc(toNumber(entry.product.amount, 0)));
      const isAutoMargin = truthy(existing?.is_auto_margin);
      const marginPercent = toNumber(existing?.margin_percent, 0);
      const finalPrice = isAutoMargin
        ? Math.round(providerPrice * (1 + marginPercent / 100) * 100) / 100
        : Math.max(providerPrice, toNumber(existing?.price, providerPrice));
      const nextStatus = stock > 0 ? 'active' : 'out_of_stock';
      const thumbnail = String(existing?.thumbnail || entry.category.icon || '');
      const resourceType = String(existing?.resource_type || guessResourceType(categoryName, title));
      const customBadge = existing?.custom_badge || null;
      const tags = existing?.tags || [categoryName, provider.name.replace(/\.com$/i, ''), resourceType].filter(Boolean).join(', ');

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
