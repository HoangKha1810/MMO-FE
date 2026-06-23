import 'server-only';

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { authenticateGameApiRequest } from '@/lib/game-integration-api';
import { getLegacySettingsMap, getVatPercent } from '@/lib/legacy-settings';
import {
  findSmmService,
  getSmmCheckoutAmount,
  getSmmProviderMeta,
  getSmmProviderMultipleOrdersStatus,
  getSmmProviderOrderStatus,
  guessProviderStatusContext,
  listSmmServices,
  type SmmServiceRecord,
} from '@/lib/smm-provider';
import { applySmmProviderStatusToOrder } from '@/lib/smm-refund';
import { slugify, toNumber } from '@/lib/utils';

interface SmmApiAccount {
  keyId: number;
  userId: number;
  username: string;
  email: string;
  fullname: string;
  role: string;
  gameBalance: number;
  apiKey: string;
  apiStatus: string;
}

type AuthenticatedSmmApiRequest =
  | {
      success: true;
      status: number;
      message: string;
      account: SmmApiAccount;
    }
  | {
      success: false;
      status: number;
      message: string;
      account: null;
    };

function roundVnd(value: number, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

function cleanCategoryName(category: string) {
  return String(category || '').replace(/\[.*?\]\s*/g, '').trim();
}

function parsePagination(params: URLSearchParams) {
  const page = Math.max(1, Math.trunc(toNumber(params.get('page'), 1)));
  const perPage = Math.min(500, Math.max(1, Math.trunc(toNumber(params.get('per_page'), 100))));
  return {
    page,
    perPage,
    offset: (page - 1) * perPage,
  };
}

function filterServices(services: SmmServiceRecord[], params: URLSearchParams) {
  const platform = String(params.get('platform') || '').trim().toLowerCase();
  const category = String(params.get('category') || '').trim().toLowerCase();
  const search = String(params.get('search') || '').trim().toLowerCase();

  return services.filter((service) => {
    const servicePlatform = String(service.platform || '').toLowerCase();
    const serviceCategory = String(service.category || '').toLowerCase();
    const categorySlug = slugify(service.category);
    const haystack = [
      service.service,
      service.name,
      service.raw_name,
      service.type,
      service.category,
      service.platform,
    ]
      .join(' ')
      .toLowerCase();

    if (platform && servicePlatform !== platform && !serviceCategory.includes(`[${platform}]`)) {
      return false;
    }

    if (category && serviceCategory !== category && categorySlug !== category && !serviceCategory.includes(category)) {
      return false;
    }

    return !search || haystack.includes(search);
  });
}

function formatExternalSmmService(service: SmmServiceRecord, vatPercent: number) {
  const pricePer1k = roundVnd(service.price_per_1k_vnd);
  const pricePerUnit = roundVnd(service.price_per_unit_vnd);

  return {
    id: service.id,
    provider_id: service.provider_id,
    service: service.service,
    name: service.name,
    raw_name: service.raw_name,
    type: service.type,
    category: service.category,
    clean_category: cleanCategoryName(service.category),
    category_slug: slugify(service.category),
    platform: service.platform,
    min: service.min,
    max: service.max,
    refill: service.refill,
    currency: 'VND',
    rate: pricePer1k,
    rate_unit: 'per_1000',
    price_per_1k_vnd: pricePer1k,
    price_per_unit_vnd: pricePerUnit,
    vat_percent: vatPercent,
    is_comment_service: service.is_comment_service,
    total_orders: Math.max(0, Math.trunc(toNumber(service.total_orders, 0))),
  };
}

function buildCategorySummary(category: string, items: SmmServiceRecord[], vatPercent: number) {
  const prices = items.map((service) => toNumber(service.price_per_1k_vnd, 0)).filter((price) => price > 0);
  const minPricePer1k = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPricePer1k = prices.length > 0 ? Math.max(...prices) : 0;

  return {
    category,
    clean_category: cleanCategoryName(category),
    category_slug: slugify(category),
    platform: items[0]?.platform || 'SMM',
    service_count: items.length,
    min: Math.min(...items.map((service) => service.min)),
    max: Math.max(...items.map((service) => service.max)),
    price_range: {
      min_per_1k_vnd: roundVnd(minPricePer1k),
      max_per_1k_vnd: roundVnd(maxPricePer1k),
      min_per_unit_vnd: roundVnd(minPricePer1k / 1000),
      max_per_unit_vnd: roundVnd(maxPricePer1k / 1000),
      display_per_unit: maxPricePer1k > minPricePer1k
        ? `${roundVnd(minPricePer1k / 1000, 1)} - ${roundVnd(maxPricePer1k / 1000, 1)} đ / lượt`
        : `${roundVnd(minPricePer1k / 1000, 1)} đ / lượt`,
    },
    vat_percent: vatPercent,
    total_orders: items.reduce((sum, service) => sum + Math.max(0, Math.trunc(toNumber(service.total_orders, 0))), 0),
  };
}

export async function authenticateSmmApiRequest(
  req: NextRequest,
  body?: Record<string, unknown>
): Promise<AuthenticatedSmmApiRequest> {
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

export async function getExternalSmmProfile(account: SmmApiAccount) {
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
      balance: roundVnd(toNumber(user?.balance, 0), 2),
      game_balance: roundVnd(toNumber(user?.game_balance, account.gameBalance), 2),
      api_status: account.apiStatus,
    },
  };
}

export async function listExternalSmmServices(params: URLSearchParams) {
  const forceRefresh = params.get('refresh') === '1';
  const [services, providerMeta, settings] = await Promise.all([
    listSmmServices(forceRefresh),
    getSmmProviderMeta(),
    getLegacySettingsMap(),
  ]);
  const vatPercent = getVatPercent(settings);
  const filtered = filterServices(services, params);
  const { page, perPage, offset } = parsePagination(params);
  const paginated = filtered.slice(offset, offset + perPage);
  const platforms = Array.from(new Set(filtered.map((service) => service.platform)));
  const categories = Array.from(new Set(filtered.map((service) => service.category)));

  return {
    success: true,
    meta: {
      provider_id: providerMeta.providerId,
      provider_name: providerMeta.providerName,
      exchange_rate: providerMeta.exchangeRate,
      margin_percent: providerMeta.marginPercent,
      vat_percent: vatPercent,
      currency: 'VND',
      price_source: 'web_smm_services_cache',
    },
    summary: {
      total_services: filtered.length,
      total_platforms: platforms.length,
      total_categories: categories.length,
    },
    pagination: {
      page,
      per_page: perPage,
      total: filtered.length,
      total_pages: Math.max(1, Math.ceil(filtered.length / perPage)),
    },
    data: paginated.map((service) => formatExternalSmmService(service, vatPercent)),
  };
}

export async function listExternalSmmCategories(params: URLSearchParams) {
  const [services, settings] = await Promise.all([
    listSmmServices(params.get('refresh') === '1'),
    getLegacySettingsMap(),
  ]);
  const vatPercent = getVatPercent(settings);
  const filtered = filterServices(services, params);
  const categoryMap = new Map<string, SmmServiceRecord[]>();

  for (const service of filtered) {
    const current = categoryMap.get(service.category) || [];
    current.push(service);
    categoryMap.set(service.category, current);
  }

  const data = [...categoryMap.entries()]
    .map(([category, items]) => buildCategorySummary(category, items, vatPercent))
    .sort((a, b) => b.total_orders - a.total_orders || a.clean_category.localeCompare(b.clean_category));

  return {
    success: true,
    summary: {
      total_categories: data.length,
      total_services: filtered.length,
    },
    data,
  };
}

export async function getExternalSmmCategory(slug: string) {
  const [services, settings] = await Promise.all([
    listSmmServices(false),
    getLegacySettingsMap(),
  ]);
  const vatPercent = getVatPercent(settings);
  const decodedSlug = decodeURIComponent(String(slug || '').trim());
  const matched = services.filter((service) => slugify(service.category) === decodedSlug);

  if (matched.length === 0) {
    throw new Error('Không tìm thấy nhóm dịch vụ SMM');
  }

  return {
    success: true,
    ...buildCategorySummary(matched[0].category, matched, vatPercent),
    data: matched.map((service) => formatExternalSmmService(service, vatPercent)),
  };
}

export async function getExternalSmmQuote(input: Record<string, unknown>) {
  const serviceId = Math.max(0, Math.trunc(toNumber(input.service_id || input.service, 0)));
  const providerId = input.provider_id === undefined || input.provider_id === null
    ? undefined
    : Math.max(0, Math.trunc(toNumber(input.provider_id, 0)));
  let quantity = Math.max(0, Math.trunc(toNumber(input.quantity, 0)));
  const comments = String(input.comments || '').trim();

  if (!serviceId || !quantity) {
    throw new Error('Thiếu service_id hoặc quantity');
  }

  const service = await findSmmService(serviceId, providerId);
  if (!service) {
    throw new Error('Không tìm thấy dịch vụ SMM');
  }

  if (service.is_comment_service) {
    quantity = comments
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean).length;

    if (quantity === 0) {
      throw new Error('Dịch vụ comment cần danh sách comments để tính số lượng');
    }
  }

  if (quantity < service.min || quantity > service.max) {
    throw new Error(`Số lượng không hợp lệ. Min ${service.min} - Max ${service.max}`);
  }

  const [checkout, settings] = await Promise.all([
    getSmmCheckoutAmount(service, quantity),
    getLegacySettingsMap(),
  ]);
  const vatPercent = getVatPercent(settings);

  return {
    success: true,
    service: formatExternalSmmService(service, vatPercent),
    checkout: {
      quantity,
      subtotal: checkout.subtotal,
      vat_amount: checkout.vatAmount,
      vat_percent: checkout.vatPercent,
      total_to_pay: checkout.totalToPay,
      formula: 'ceil(quantity / 1000 * price_per_1k_vnd) + VAT',
    },
  };
}

export async function listExternalSmmOrders(account: SmmApiAccount, params: URLSearchParams) {
  const ids = (params.get('service_ids') || '')
    .split(',')
    .map((value) => Math.trunc(Number(value.trim())))
    .filter((value) => Number.isFinite(value) && value > 0);
  const limit = Math.min(100, Math.max(1, Math.trunc(toNumber(params.get('limit'), 50))));

  const orders = await db.smm_orders.findMany({
    where: {
      user_id: account.userId,
      ...(ids.length > 0 ? { service_id: { in: ids } } : {}),
    },
    orderBy: { id: 'desc' },
    take: limit,
  });

  return {
    success: true,
    data: orders.map((order) => ({
      ...order,
      price: toNumber(order.price, 0),
      balance_after: toNumber(order.balance_after, 0),
      refund_amount: toNumber(order.refund_amount, 0),
      start_count: toNumber(order.start_count, 0),
      remains: toNumber(order.remains, 0),
      quantity: toNumber(order.quantity, 0),
      created_at: order.created_at.toISOString(),
      updated_at: order.updated_at.toISOString(),
    })),
  };
}

export async function getExternalSmmStatus(account: SmmApiAccount, params: URLSearchParams) {
  const singleOrderId = params.get('order')?.trim() || '';
  const multipleOrderIds = (params.get('orders') || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  if (!singleOrderId && multipleOrderIds.length === 0) {
    throw new Error('Thiếu order hoặc danh sách orders');
  }

  const requestedIds = singleOrderId ? [singleOrderId] : multipleOrderIds;
  if (requestedIds.length > 100) {
    throw new Error('Provider chỉ cho phép tối đa 100 order mỗi lần');
  }

  const localOrders = await db.smm_orders.findMany({
    where: {
      api_order_id: {
        in: requestedIds,
      },
    },
    select: {
      id: true,
      api_order_id: true,
      user_id: true,
      provider_id: true,
      status: true,
    },
  });
  const localOrderMap = new Map(localOrders.map((order) => [order.api_order_id, order]));
  const isAdmin = String(account.role || '').toLowerCase() === 'admin';

  if (!isAdmin) {
    const unauthorized = requestedIds.some((orderId) => localOrderMap.get(orderId)?.user_id !== account.userId);
    if (unauthorized) {
      throw new Error('Bạn chỉ được kiểm tra trạng thái các đơn SMM của chính mình');
    }
  }

  if (singleOrderId) {
    const localOrder = localOrderMap.get(singleOrderId);
    const data = await getSmmProviderOrderStatus(
      singleOrderId,
      localOrder?.provider_id ?? undefined,
      await guessProviderStatusContext([singleOrderId])
    );

    if (localOrder) {
      await applySmmProviderStatusToOrder(localOrder.id, data, {
        fallbackStatus: localOrder.status,
        source: 'external_smm_status_api',
      });
    }

    return { success: true, data };
  }

  const grouped = new Map<number, string[]>();
  for (const orderId of multipleOrderIds) {
    const providerId = localOrderMap.get(orderId)?.provider_id ?? 0;
    grouped.set(providerId, [...(grouped.get(providerId) || []), orderId]);
  }

  const merged: Record<string, unknown> = {};
  for (const [providerId, orderIds] of grouped.entries()) {
    const payload = await getSmmProviderMultipleOrdersStatus(
      orderIds,
      providerId || undefined,
      await guessProviderStatusContext(orderIds)
    );

    Object.assign(merged, orderIds.length === 1 && ('status' in payload || 'charge' in payload)
      ? { [orderIds[0]]: payload }
      : payload);

    for (const orderId of orderIds) {
      const localOrder = localOrderMap.get(orderId);
      const orderPayload = (payload as Record<string, unknown>)[orderId];
      if (!localOrder || !orderPayload || typeof orderPayload !== 'object' || Array.isArray(orderPayload)) {
        continue;
      }

      await applySmmProviderStatusToOrder(localOrder.id, orderPayload as Record<string, unknown>, {
        fallbackStatus: localOrder.status,
        source: 'external_smm_status_api',
      });
    }
  }

  return { success: true, data: merged };
}
