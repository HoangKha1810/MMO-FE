import 'server-only';

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { authenticateGameApiRequest } from '@/lib/game-integration-api';
import {
  createAutoMxhOrderForUser,
  getAutoMxhCategory,
  getAutoMxhCheckoutAmount,
  getAutoMxhOrderStatusForUser,
  getAutoMxhProductsForCategory,
  listAutoMxhCatalog,
  listAutoMxhOrdersForUser,
  parseProductInputs,
  quoteAutoMxhOrder,
  type AutoMxhProductWithVariants,
  type AutoMxhVariant,
} from '@/lib/automxh';
import { toNumber } from '@/lib/utils';

interface AutoMxhApiAccount {
  keyId: number;
  userId: number;
  username: string;
  email: string;
  fullname: string;
  role: string;
  apiStatus: string;
}

type AuthenticatedAutoMxhApiRequest =
  | {
      success: true;
      status: number;
      message: string;
      account: AutoMxhApiAccount;
    }
  | {
      success: false;
      status: number;
      message: string;
      account: null;
    };

function apiError(message: string, status = 400) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function roundVnd(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

export async function readExternalAutoMxhRequestBody(req: NextRequest): Promise<Record<string, unknown>> {
  const contentType = String(req.headers.get('content-type') || '').toLowerCase();

  if (contentType.includes('application/json')) {
    const body = await req.json().catch(() => ({}));
    return body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {};
  }

  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return {};
    }

    const body: Record<string, unknown> = {};
    for (const [key, value] of formData.entries()) {
      body[key] = typeof value === 'string' ? value : value.name;
    }
    return body;
  }

  const text = await req.text().catch(() => '');
  if (!text.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return Object.fromEntries(new URLSearchParams(text).entries());
  }
}

export function toExternalAutoMxhSearchParams(input: Record<string, unknown>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || Array.isArray(value) || typeof value === 'object') {
      continue;
    }

    params.set(key, String(value));
  }

  return params;
}

export async function authenticateAutoMxhApiRequest(
  req: NextRequest,
  body?: Record<string, unknown>
): Promise<AuthenticatedAutoMxhApiRequest> {
  const auth = await authenticateGameApiRequest(req, body);

  if (!auth.success || !auth.account) {
    return {
      success: false,
      status: auth.status,
      message: auth.message,
      account: null,
    };
  }

  return {
    success: true,
    status: auth.status,
    message: auth.message,
    account: auth.account,
  };
}

function formatVariant(variant: AutoMxhVariant, product?: AutoMxhProductWithVariants) {
  return {
    id: variant.id,
    variant_id: variant.id,
    product_id: variant.product_id,
    product_name: product?.name || '',
    name: variant.name,
    type: variant.type,
    badge: variant.badge,
    quantity: variant.quantity,
    price: roundVnd(variant.price),
    cost: roundVnd(variant.cost),
    original_price: roundVnd(variant.original_price),
    currency: 'VND',
    api_provider_id: variant.api_provider_id || 0,
    api_service_id: variant.api_service_id || '',
    allow_avatar: variant.allow_avatar,
    allow_files: variant.allow_files,
    description: variant.description,
  };
}

function formatProduct(product: AutoMxhProductWithVariants) {
  return {
    id: product.id,
    product_id: product.id,
    category_id: product.category_id,
    name: product.name,
    badge: product.badge,
    description: product.description,
    min_price: roundVnd(product.min_price),
    variant_count: product.variants.length,
    inputs: parseProductInputs(product),
    variants: product.variants.map((variant) => formatVariant(variant, product)),
  };
}

export async function getExternalAutoMxhProfile(account: AutoMxhApiAccount) {
  const user = await db.users.findUnique({
    where: { id: account.userId },
    select: {
      id: true,
      username: true,
      email: true,
      fullname: true,
      role: true,
      status: true,
      balance: true,
      game_balance: true,
    },
  });

  return {
    success: true,
    data: {
      user_id: account.userId,
      username: account.username,
      email: account.email,
      fullname: account.fullname,
      role: account.role,
      status: String(user?.status || 'active'),
      balance: roundVnd(toNumber(user?.balance, 0)),
      game_balance: roundVnd(toNumber(user?.game_balance, 0)),
      api_status: account.apiStatus,
    },
  };
}

export async function listExternalAutoMxhCatalog(params: URLSearchParams) {
  const search = String(params.get('search') || '').trim().toLowerCase();
  const catalog = await listAutoMxhCatalog();
  const data = catalog
    .map((section) => ({
      category: section.category,
      products: section.products.filter((product) => {
        if (!search) return true;
        return [product.name, product.description, product.badge, section.category.name]
          .join(' ')
          .toLowerCase()
          .includes(search);
      }),
    }))
    .filter((section) => section.products.length > 0);

  return {
    success: true,
    summary: {
      total_categories: data.length,
      total_products: data.reduce((sum, section) => sum + section.products.length, 0),
    },
    data,
  };
}

export async function getExternalAutoMxhCategory(slug: string) {
  const category = await getAutoMxhCategory(decodeURIComponent(String(slug || '').trim()));
  if (!category) {
    throw apiError('Không tìm thấy nhóm dịch vụ Auto MXH', 404);
  }

  const products = await getAutoMxhProductsForCategory(category.id);

  return {
    success: true,
    category,
    summary: {
      total_products: products.length,
      total_variants: products.reduce((sum, product) => sum + product.variants.length, 0),
    },
    data: products.map(formatProduct),
  };
}

export async function listExternalAutoMxhServices(params: URLSearchParams) {
  const search = String(params.get('search') || '').trim().toLowerCase();
  const categorySlug = String(params.get('category') || '').trim();
  const catalog = await listAutoMxhCatalog();
  const services: Array<Record<string, unknown>> = [];

  for (const section of catalog) {
    if (categorySlug && section.category.slug !== categorySlug) {
      continue;
    }

    const products = await getAutoMxhProductsForCategory(section.category.id);
    for (const product of products) {
      for (const variant of product.variants) {
        const row = {
          category: section.category,
          product: {
            id: product.id,
            name: product.name,
            badge: product.badge,
            description: product.description,
            inputs: parseProductInputs(product),
          },
          ...formatVariant(variant, product),
        };
        const haystack = JSON.stringify(row).toLowerCase();
        if (!search || haystack.includes(search)) {
          services.push(row);
        }
      }
    }
  }

  return {
    success: true,
    summary: {
      total_services: services.length,
      total_categories: new Set(services.map((service) => (service.category as { id?: number })?.id)).size,
    },
    data: services,
  };
}

export async function getExternalAutoMxhQuote(input: Record<string, unknown>) {
  const variantId = Math.max(0, Math.trunc(toNumber(input.variant_id || input.variant, 0)));
  const productId = input.product_id === undefined || input.product_id === null || input.product_id === ''
    ? undefined
    : Math.max(0, Math.trunc(toNumber(input.product_id, 0)));

  if (!variantId) {
    throw apiError('Thiếu variant_id');
  }

  const { variant, checkout } = await quoteAutoMxhOrder({ productId, variantId });

  return {
    success: true,
    service: formatVariant(variant),
    checkout: {
      quantity: variant.quantity,
      subtotal: checkout.subtotal,
      vat_amount: checkout.vatAmount,
      vat_percent: checkout.vatPercent,
      total_to_pay: checkout.totalToPay,
      formula: 'variant.price + VAT',
    },
  };
}

export async function createExternalAutoMxhOrder(account: AutoMxhApiAccount, input: Record<string, unknown>) {
  const variantId = Math.max(0, Math.trunc(toNumber(input.variant_id || input.variant || input.service, 0)));
  const productId = input.product_id === undefined || input.product_id === null || input.product_id === ''
    ? undefined
    : Math.max(0, Math.trunc(toNumber(input.product_id, 0)));
  const link = String(input.link || input.url || input.object_id || '').trim();

  if (!variantId || !link) {
    throw apiError('Thiếu variant_id/service hoặc link');
  }

  const result = await createAutoMxhOrderForUser({
    userId: account.userId,
    productId,
    variantId,
    link,
    buyerInfo: String(input.buyer_info || input.buyer || input.contact || '').trim(),
    customValue: String(input.custom_value || input.custom || input.note || '').trim(),
    confirm1: input.confirm_1 === undefined ? true : String(input.confirm_1) === '1' || input.confirm_1 === true,
    confirm2: String(input.confirm_2 || '') === '1' || input.confirm_2 === true,
    source: 'external_api',
  });

  return {
    success: true,
    message: result.providerError
      ? 'Đơn Auto MXH đã tạo trên web, nhưng provider chưa nhận tự động. Admin cần xử lý.'
      : 'Đơn Auto MXH đã được tạo và trừ tiền ví chính',
    order: result.orderId,
    provider_order: result.providerOrderId,
    charge: result.checkout.totalToPay,
    currency: 'VND',
    balance: roundVnd(result.balanceAfter),
    provider_error: result.providerError || undefined,
    data: {
      id: result.orderId,
      order: result.orderId,
      api_order_id: result.providerOrderId,
      product_id: result.variant.product_id,
      variant_id: result.variant.id,
      variant_name: result.variant.name,
      quantity: result.variant.quantity,
      status: result.providerOrderId ? 'processing' : 'pending',
      subtotal: result.checkout.subtotal,
      vat_amount: result.checkout.vatAmount,
      vat_percent: result.checkout.vatPercent,
      total_to_pay: result.checkout.totalToPay,
      balance_after: roundVnd(result.balanceAfter),
    },
  };
}

export async function listExternalAutoMxhOrders(account: AutoMxhApiAccount, params: URLSearchParams) {
  const productIds = (params.get('product_ids') || '')
    .split(',')
    .map((value) => Math.trunc(toNumber(value.trim(), 0)))
    .filter((value) => value > 0);
  const limit = Math.min(100, Math.max(1, Math.trunc(toNumber(params.get('limit'), 50))));

  return {
    success: true,
    data: await listAutoMxhOrdersForUser({
      userId: account.userId,
      productIds,
      limit,
    }),
  };
}

export async function getExternalAutoMxhStatus(account: AutoMxhApiAccount, params: URLSearchParams) {
  const orderId = Math.max(0, Math.trunc(toNumber(params.get('order') || params.get('id'), 0)));
  if (!orderId) {
    throw apiError('Thiếu order hoặc id');
  }

  const isAdmin = String(account.role || '').toLowerCase() === 'admin';

  return {
    success: true,
    data: await getAutoMxhOrderStatusForUser({
      userId: account.userId,
      orderId,
      isAdmin,
    }),
  };
}
