import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import {
  getSmmProviderMultipleOrdersStatus,
  getSmmProviderOrderStatus,
  guessProviderStatusContext,
} from '@/lib/smm-provider';
import { applySmmProviderStatusToOrder } from '@/lib/smm-refund';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const userId = Number(cookieStore.get('user_id')?.value || 0);

  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [user, localOrders] = await Promise.all([
      db.users.findUnique({
        where: { id: userId },
        select: { role: true },
      }),
      db.smm_orders.findMany({
        where: {
          api_order_id: {
            in: [
              ...(req.nextUrl.searchParams.get('order')?.trim()
                ? [req.nextUrl.searchParams.get('order')!.trim()]
                : []),
              ...(req.nextUrl.searchParams.get('orders') || '')
                .split(',')
                .map((id) => id.trim())
                .filter(Boolean),
            ],
          },
        },
        select: {
          id: true,
          api_order_id: true,
          user_id: true,
          provider_id: true,
          status: true,
        },
      }),
    ]);

    const isAdmin = String(user?.role || '').toLowerCase() === 'admin';
    const singleOrderId = req.nextUrl.searchParams.get('order')?.trim() || '';
    const multipleOrderIds = (req.nextUrl.searchParams.get('orders') || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    if (!singleOrderId && multipleOrderIds.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Thiếu order hoặc danh sách orders' },
        { status: 400 }
      );
    }

    const requestedIds = singleOrderId ? [singleOrderId] : multipleOrderIds;
    const localOrderMap = new Map(localOrders.map((order) => [order.api_order_id, order]));

    if (!isAdmin) {
      const unauthorized = requestedIds.some((orderId) => localOrderMap.get(orderId)?.user_id !== userId);
      if (unauthorized) {
        return NextResponse.json(
          {
            success: false,
            message: 'Bạn chỉ được kiểm tra trạng thái các đơn SMM của chính mình',
          },
          { status: 403 }
        );
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
          source: 'smm_status_api',
        });
      }
      return NextResponse.json({ success: true, data });
    }

    if (multipleOrderIds.length > 100) {
      return NextResponse.json(
        { success: false, message: 'Provider chỉ cho phép tối đa 100 order mỗi lần' },
        { status: 400 }
      );
    }

    const grouped = new Map<number, string[]>();

    for (const orderId of multipleOrderIds) {
      const providerId = localOrderMap.get(orderId)?.provider_id ?? 0;
      const bucket = grouped.get(providerId) || [];
      bucket.push(orderId);
      grouped.set(providerId, bucket);
    }

    const merged: Record<string, unknown> = {};

    for (const [providerId, orderIds] of grouped.entries()) {
      const payload = await getSmmProviderMultipleOrdersStatus(
        orderIds,
        providerId || undefined,
        await guessProviderStatusContext(orderIds)
      );

      if (orderIds.length === 1 && ('status' in payload || 'charge' in payload)) {
        merged[orderIds[0]] = payload;
        const localOrder = localOrderMap.get(orderIds[0]);
        if (localOrder) {
          await applySmmProviderStatusToOrder(localOrder.id, payload, {
            fallbackStatus: localOrder.status,
            source: 'smm_status_api',
          });
        }
        continue;
      }

      Object.assign(merged, payload);

      for (const orderId of orderIds) {
        const localOrder = localOrderMap.get(orderId);
        const orderPayload = payload[orderId];
        if (!localOrder || !orderPayload || typeof orderPayload !== 'object' || Array.isArray(orderPayload)) {
          continue;
        }

        await applySmmProviderStatusToOrder(localOrder.id, orderPayload as Record<string, unknown>, {
          fallbackStatus: localOrder.status,
          source: 'smm_status_api',
        });
      }
    }

    return NextResponse.json({ success: true, data: merged });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể lấy trạng thái đơn';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
