import { NextRequest, NextResponse } from 'next/server';
import { processBankDepositByCode } from '@/lib/legacy-modules';
import { toNumber } from '@/lib/utils';

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const code = String(payload.orderId || payload.order_id || payload.requestId || payload.content || '').trim();
  const amount = toNumber(payload.amount || payload.transAmount || payload.value, 0);

  if (!code) {
    return NextResponse.json({ success: false, message: 'Thiếu mã giao dịch MoMo' }, { status: 400 });
  }

  const result = await processBankDepositByCode(code, amount);
  return NextResponse.json({ success: true, data: result });
}
