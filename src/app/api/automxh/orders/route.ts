import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedSessionUserId } from '@/lib/session-cookie';
import { getAutoMxhRecentOrders } from '@/lib/automxh';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const userId = await getVerifiedSessionUserId();

  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const productIds = (req.nextUrl.searchParams.get('product_ids') || '')
    .split(',')
    .map((value) => Math.trunc(Number(value.trim())))
    .filter((value) => Number.isFinite(value) && value > 0);

  try {
    const orders = await getAutoMxhRecentOrders(userId, productIds);
    return NextResponse.json({ success: true, orders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể tải lịch sử Auto MXH';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
