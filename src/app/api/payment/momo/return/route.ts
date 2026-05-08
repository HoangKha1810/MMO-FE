import { NextRequest, NextResponse } from 'next/server';
import { processBankDepositByCode } from '@/lib/legacy-modules';
import { siteUrl } from '@/lib/seo';
import { toNumber } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function depositRedirect(status: 'success' | 'error' | 'cancel', message?: string) {
  const url = new URL('/user/deposit', process.env.NEXT_PUBLIC_BASE_URL || process.env.API_DOMAIN || siteUrl);
  url.searchParams.set('payment', status);
  if (message) url.searchParams.set('message', message);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const code = String(
    req.nextUrl.searchParams.get('orderId') ||
      req.nextUrl.searchParams.get('order_id') ||
      req.nextUrl.searchParams.get('requestId') ||
      req.nextUrl.searchParams.get('content') ||
      ''
  ).trim();
  const amount = toNumber(req.nextUrl.searchParams.get('amount') || req.nextUrl.searchParams.get('transAmount'), 0);
  const status = String(req.nextUrl.searchParams.get('resultCode') || req.nextUrl.searchParams.get('status') || '').toLowerCase();

  if (!code) {
    return depositRedirect('error', 'Thiếu mã giao dịch MoMo');
  }

  if (status && !['0', 'success', 'approved'].includes(status)) {
    return depositRedirect('error', 'MoMo trả về trạng thái không thành công');
  }

  const result = await processBankDepositByCode(code, amount).catch((error) => ({
    state: 'error',
    message: error instanceof Error ? error.message : 'Không xử lý được giao dịch MoMo',
  }));

  return depositRedirect((result as { state?: string }).state === 'processed' || (result as { state?: string }).state === 'already_processed' ? 'success' : 'error');
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const code = String(body.orderId || body.order_id || body.requestId || body.content || '').trim();
  const amount = toNumber(body.amount || body.transAmount || body.value, 0);

  if (!code) {
    return NextResponse.json({ success: false, message: 'Thiếu mã giao dịch MoMo' }, { status: 400 });
  }

  const result = await processBankDepositByCode(code, amount);
  return NextResponse.json({ success: true, data: result });
}
