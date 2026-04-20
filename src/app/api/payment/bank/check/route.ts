import { NextRequest, NextResponse } from 'next/server';
import { processBankDepositByCode } from '@/lib/legacy-modules';
import { requireAdminApi } from '@/lib/admin-auth';
import { toNumber } from '@/lib/utils';

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi(req);
  if (auth.response) return auth.response;

  const payload = await req.json().catch(() => ({}));
  const code = String(payload.code || payload.content || payload.order_id || '').trim();
  const amount = toNumber(payload.amount, 0);

  if (!code) {
    return NextResponse.json({ success: false, message: 'Thiếu mã giao dịch bank' }, { status: 400 });
  }

  const result = await processBankDepositByCode(code, amount);
  return NextResponse.json({ success: true, data: result });
}
