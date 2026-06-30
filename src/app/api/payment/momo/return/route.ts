import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
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

function getMoMoWebhookSecret() {
  return String(process.env.MOMO_WEBHOOK_TOKEN || process.env.MOMO_IPN_SECRET || '').trim();
}

function timingSafeEqualString(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function isAuthorizedMoMoWebhook(req: NextRequest, body: Record<string, unknown>) {
  const expectedSecret = getMoMoWebhookSecret();
  if (!expectedSecret) return false;

  const authorization = String(req.headers.get('authorization') || '').replace(/^bearer\s+/i, '').trim();
  const candidates = [
    req.headers.get('x-webhook-token'),
    req.headers.get('x-secret-key'),
    req.headers.get('x-momo-secret'),
    authorization,
    body.webhook_token,
    body.secret,
  ].map((value) => String(value || '').trim()).filter(Boolean);

  return candidates.some((candidate) => timingSafeEqualString(candidate, expectedSecret));
}

export async function GET(req: NextRequest) {
  const status = String(req.nextUrl.searchParams.get('resultCode') || req.nextUrl.searchParams.get('status') || '').toLowerCase();

  if (status && !['0', 'success', 'approved'].includes(status)) {
    return depositRedirect('error', 'MoMo trả về trạng thái không thành công');
  }

  return depositRedirect('success', 'Giao dịch đang chờ hệ thống xác nhận, vui lòng không tạo lại lệnh nạp.');
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!isAuthorizedMoMoWebhook(req, body)) {
    return NextResponse.json(
      { success: false, message: 'MoMo callback chưa được xác thực' },
      { status: 401 }
    );
  }

  const code = String(body.orderId || body.order_id || body.requestId || body.content || '').trim();
  const amount = toNumber(body.amount || body.transAmount || body.value, 0);
  const status = String(body.resultCode ?? body.status ?? '').toLowerCase();

  if (!code) {
    return NextResponse.json({ success: false, message: 'Thiếu mã giao dịch MoMo' }, { status: 400 });
  }

  if (status && !['0', 'success', 'approved'].includes(status)) {
    return NextResponse.json({ success: true, message: 'Bỏ qua giao dịch MoMo chưa thành công' });
  }

  const result = await processBankDepositByCode(code, amount);
  return NextResponse.json({ success: true, data: result });
}
