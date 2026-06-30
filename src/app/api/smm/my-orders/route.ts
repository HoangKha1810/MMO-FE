import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedSessionUserId } from '@/lib/session-cookie';
import { db } from '@/lib/db';
import { getSmmProviderMultipleOrdersStatus, guessProviderStatusContext } from '@/lib/smm-provider';
import { applySmmProviderStatusToOrder } from '@/lib/smm-refund';
import { normalizeSmmOrderStatus } from '@/lib/smm-status';
import { toNumber } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function extractOrderStatus(payload: Record<string, unknown>, orderId: string) {
  const direct = payload[orderId];
  if (direct && typeof direct === 'object' && !Array.isArray(direct)) {
    return direct as Record<string, unknown>;
  }

  if ('status' in payload || 'charge' in payload || 'start_count' in payload || 'remains' in payload) {
    return payload;
  }

  return null;
}

async function syncVisibleRunningOrders(
  orders: Awaited<ReturnType<typeof db.smm_orders.findMany>>
) {
  const staleBefore = Date.now() - 45_000;
  const candidates = orders
    .filter((order) => normalizeSmmOrderStatus(order.status, '') === 'Processing')
    .filter((order) => String(order.api_order_id || '').trim())
    .filter((order) => order.updated_at.getTime() < staleBefore)
    .slice(0, 25);

  if (!candidates.length) return orders;

  const groups = new Map<number, typeof candidates>();
  for (const order of candidates) {
    const providerId = Math.max(0, Math.trunc(toNumber(order.provider_id, 0)));
    groups.set(providerId, [...(groups.get(providerId) || []), order]);
  }

  await Promise.all(
    [...groups.entries()].map(async ([providerId, group]) => {
      const orderIds = group.map((order) => String(order.api_order_id || '').trim()).filter(Boolean);
      if (!orderIds.length) return;

      const payload = await getSmmProviderMultipleOrdersStatus(
        orderIds,
        providerId || undefined,
        await guessProviderStatusContext(orderIds)
      );

      for (const order of group) {
        const apiOrderId = String(order.api_order_id || '').trim();
        const statusPayload = extractOrderStatus(payload, apiOrderId);
        if (!statusPayload) continue;

        await applySmmProviderStatusToOrder(order.id, statusPayload, {
          fallbackStatus: order.status,
          source: 'smm_my_orders_sync',
        });
      }
    })
  ).catch(() => undefined);

  const refreshedIds = candidates.map((order) => order.id);
  const refreshed = await db.smm_orders.findMany({
    where: { id: { in: refreshedIds } },
  });
  const refreshedMap = new Map(refreshed.map((order) => [order.id, order]));

  return orders.map((order) => refreshedMap.get(order.id) || order);
}

export async function GET(req: NextRequest) {
  const userId = await getVerifiedSessionUserId();

  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const ids = (req.nextUrl.searchParams.get('service_ids') || '')
    .split(',')
    .map((value) => Math.trunc(Number(value.trim())))
    .filter((value) => Number.isFinite(value) && value > 0);

  try {
    const orders = await db.smm_orders.findMany({
      where: {
        user_id: userId,
        ...(ids.length > 0 ? { service_id: { in: ids } } : {}),
      },
      orderBy: { id: 'desc' },
      take: 50,
    });
    const syncedOrders = await syncVisibleRunningOrders(orders);

    return NextResponse.json({
      success: true,
      orders: syncedOrders.map((order) => ({
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
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể tải lịch sử SMM';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
