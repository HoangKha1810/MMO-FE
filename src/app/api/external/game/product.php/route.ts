import { NextRequest, NextResponse } from 'next/server';
import { authenticateGameApiRequest, getCompatProductDetail } from '@/lib/game-integration-api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateGameApiRequest(req);
    if (!auth.success || !auth.account) {
      return NextResponse.json({ status: 'error', msg: auth.message });
    }

    const productId = String(req.nextUrl.searchParams.get('product') || req.nextUrl.searchParams.get('id') || '').trim();
    if (!productId) {
      return NextResponse.json({ status: 'error', msg: 'Thiếu product ID' });
    }

    const data = await getCompatProductDetail(productId);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      msg: error instanceof Error ? error.message : 'Không thể tải product',
    });
  }
}
