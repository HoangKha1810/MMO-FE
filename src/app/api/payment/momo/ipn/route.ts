import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { processBankDepositByCode } from '@/lib/legacy-modules';
import { toNumber } from '@/lib/utils';

function getMoMoWebhookSecret() {
  return String(process.env.MOMO_WEBHOOK_TOKEN || process.env.MOMO_IPN_SECRET || '').trim();
}

function timingSafeEqualString(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function isAuthorizedMoMoWebhook(req: NextRequest, payload: Record<string, unknown>) {
  const expectedSecret = getMoMoWebhookSecret();
  if (!expectedSecret) return false;

  const authorization = String(req.headers.get('authorization') || '').replace(/^bearer\s+/i, '').trim();
  const candidates = [
    req.headers.get('x-webhook-token'),
    req.headers.get('x-secret-key'),
    req.headers.get('x-momo-secret'),
    authorization,
    payload.webhook_token,
    payload.secret,
  ].map((value) => String(value || '').trim()).filter(Boolean);

  return candidates.some((candidate) => timingSafeEqualString(candidate, expectedSecret));
}

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  if (!isAuthorizedMoMoWebhook(req, payload)) {
    return NextResponse.json(
      { success: false, message: 'MoMo webhook chưa được xác thực' },
      { status: 401 }
    );
  }

  const code = String(payload.orderId || payload.order_id || payload.requestId || payload.content || '').trim();
  const amount = toNumber(payload.amount || payload.transAmount || payload.value, 0);
  const status = String(payload.resultCode ?? payload.status ?? '').toLowerCase();

  if (!code) {
    return NextResponse.json({ success: false, message: 'Thiếu mã giao dịch MoMo' }, { status: 400 });
  }

  if (status && !['0', 'success', 'approved'].includes(status)) {
    return NextResponse.json({ success: true, message: 'Bỏ qua giao dịch MoMo chưa thành công' });
  }

  const result = await processBankDepositByCode(code, amount);
  return NextResponse.json({ success: true, data: result });
}
