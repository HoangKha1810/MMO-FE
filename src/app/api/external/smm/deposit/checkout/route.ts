import { NextRequest, NextResponse } from 'next/server';
import { createExternalApiSePayDepositCheckout } from '@/lib/external-wallet-api';
import { authenticateSmmApiRequest, readExternalSmmRequestBody } from '@/lib/smm-external-api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  return NextResponse.json({
    success: true,
    docs: {
      endpoint: '/api/external/smm/deposit/checkout',
      method: 'POST',
      auth: 'x-api-key: API key do admin cấp',
      body: {
        amount: 100000,
        external_ref: 'HSSSEP1T1782266733342',
        note: 'Nạp từ web con',
      },
      description: 'Tạo QR SePay bằng cấu hình web chính cho tài khoản đang sở hữu API key. Khi SePay/IPN web chính cộng tiền thành công, dùng API transactions để đối soát trước khi cộng ví web con.',
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

    return NextResponse.json(
      await createExternalApiSePayDepositCheckout(auth.account, body, 'SMM API', req.nextUrl.origin)
    );
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number'
      ? Number((error as { status: number }).status)
      : 400;

    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể tạo QR SePay qua API SMM' },
      { status }
    );
  }
}
