import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { toNumber } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const userId = Number(cookieStore.get('user_id')?.value || 0);

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

    return NextResponse.json({
      success: true,
      orders: orders.map((order) => ({
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
