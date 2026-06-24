import { NextRequest, NextResponse } from 'next/server';
import { createExternalApiSePayDepositCheckout } from '@/lib/external-wallet-api';
import { authenticateAutoMxhApiRequest, readExternalAutoMxhRequestBody } from '@/lib/automxh-external-api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  return NextResponse.json({
    success: true,
    docs: {
      endpoint: '/api/external/automxh/deposit/checkout',
      method: 'POST',
      auth: 'x-api-key: API key do admin cấp',
      body: {
        amount: 100000,
        external_ref: 'HSSSEP1T1782266733342',
        note: 'Nạp từ web con',
      },
      description: 'Tạo QR SePay bằng cấu hình web chính cho tài khoản đang sở hữu API key AutoMXH.',
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

    return NextResponse.json(
      await createExternalApiSePayDepositCheckout(auth.account, body, 'Auto MXH API', req.nextUrl.origin)
    );
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number'
      ? Number((error as { status: number }).status)
      : 400;

    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể tạo QR SePay qua API AutoMXH' },
      { status }
    );
  }
}
