import { NextRequest, NextResponse } from 'next/server';
import { creditExternalApiBalance } from '@/lib/external-wallet-api';
import { authenticateSmmApiRequest, readExternalSmmRequestBody } from '@/lib/smm-external-api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  return NextResponse.json({
    success: true,
    docs: {
      endpoint: '/api/external/smm/deposit',
      method: 'POST',
      auth: 'x-api-key: API key do admin cấp',
      body: {
        amount: 100000,
        external_ref: 'BANK_TXN_001',
        note: 'Nạp từ web con hoặc webhook ngân hàng',
      },
      description: 'Cộng tiền vào ví chính của tài khoản đang sở hữu API key. Dùng cho web con nạp tiền vào tài khoản nguồn trước khi đặt đơn.',
    },
  });
}

export async function POST(req: NextRequest) {
  const body = await readExternalSmmRequestBody(req);

  try {
    const auth = await authenticateSmmApiRequest(req, body);
    if (!auth.success || !auth.account) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    return NextResponse.json(await creditExternalApiBalance(auth.account, body, 'SMM API'));
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number'
      ? Number((error as { status: number }).status)
      : 400;

    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể nạp tiền qua API SMM' },
      { status }
    );
  }
}
