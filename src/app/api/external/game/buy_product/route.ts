import { NextRequest, NextResponse } from 'next/server';
import { authenticateGameApiRequest, createCompatProductOrder } from '@/lib/game-integration-api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function readBody(req: NextRequest) {
  const contentType = String(req.headers.get('content-type') || '').toLowerCase();

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const text = await req.text();
    const params = new URLSearchParams(text);
    return Object.fromEntries(params.entries());
  }

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData();
    return Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [key, typeof value === 'string' ? value : '']));
  }

  return req.json().catch(() => ({}));
}

export async function POST(req: NextRequest) {
  try {
    const body = await readBody(req);
    const auth = await authenticateGameApiRequest(req, body);
    if (!auth.success || !auth.account) {
      return NextResponse.json({ status: 'error', msg: auth.message });
    }

    const productId = String(body.id || body.product || body.product_id || '').trim();
    if (!productId) {
      return NextResponse.json({ status: 'error', msg: 'Thiếu product ID' });
    }

    const data = await createCompatProductOrder(auth.account.userId, {
      externalProductId: productId,
      amount: Number(body.amount || body.quantity || 1),
    });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      msg: error instanceof Error ? error.message : 'Không thể mua sản phẩm',
    });
  }
}
