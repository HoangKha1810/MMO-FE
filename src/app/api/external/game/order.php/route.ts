import { NextRequest, NextResponse } from 'next/server';
import { authenticateGameApiRequest, getCompatOrderDetail } from '@/lib/game-integration-api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateGameApiRequest(req);
    if (!auth.success || !auth.account) {
      return NextResponse.json({ status: 'error', msg: auth.message });
    }

    const orderId = String(req.nextUrl.searchParams.get('order') || req.nextUrl.searchParams.get('trans_id') || '').trim();
    if (!orderId) {
      return NextResponse.json({ status: 'error', msg: 'Thiếu order ID' });
    }

    const data = await getCompatOrderDetail(auth.account.userId, orderId);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      msg: error instanceof Error ? error.message : 'Không thể tải order',
    });
  }
}
