import { NextRequest, NextResponse } from 'next/server';
import { authenticateAutoMxhApiRequest, readExternalAutoMxhRequestBody } from '@/lib/automxh-external-api';
import { creditExternalApiBalance } from '@/lib/external-wallet-api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  return NextResponse.json({
    success: true,
    docs: {
      endpoint: '/api/external/automxh/deposit',
      method: 'POST',
      auth: 'x-api-key: API key do admin cấp + deposit_secret nội bộ nếu admin bật ENABLE_EXTERNAL_API_DIRECT_DEPOSIT=1',
      body: {
        amount: 100000,
        external_ref: 'BANK_TXN_001',
        note: 'Nạp từ web con hoặc webhook ngân hàng',
        deposit_secret: 'server-only-secret',
      },
      description: 'Mặc định endpoint cộng ví trực tiếp bị tắt để tránh giả mạo nạp tiền. Nên dùng /api/external/automxh/deposit/checkout để tạo QR SePay.',
    },
  });
}

export async function POST(req: NextRequest) {
  const body = await readExternalAutoMxhRequestBody(req);

  try {
    const auth = await authenticateAutoMxhApiRequest(req, body);
    if (!auth.success || !auth.account) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    return NextResponse.json(await creditExternalApiBalance(auth.account, body, 'Auto MXH API', req));
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number'
      ? Number((error as { status: number }).status)
      : 400;

    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể nạp tiền qua API Auto MXH' },
      { status }
    );
  }
}
