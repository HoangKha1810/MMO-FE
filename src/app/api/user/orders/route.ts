import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { toNumber } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const userId = parseInt(cookieStore.get('user_id')?.value || '0', 10);

  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const perPage = parseInt(searchParams.get('per_page') || '20', 10);
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || '';

  const skip = (page - 1) * perPage;

  try {
    const where: Record<string, unknown> = { user_id: userId };
    if (search) {
      where.OR = [
        { service_name: { contains: search } },
        { link: { contains: search } },
      ];
    }
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      db.smm_orders.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: perPage,
      }),
      db.smm_orders.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: orders.map((order) => ({
        ...order,
        price: toNumber(order.price, 0),
        balance_after: toNumber(order.balance_after, 0),
        refund_amount: toNumber(order.refund_amount, 0),
      })),
      pagination: {
        current_page: page,
        total_pages: Math.ceil(total / perPage),
        total_items: total,
        per_page: perPage,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
