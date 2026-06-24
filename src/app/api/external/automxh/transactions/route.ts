import { NextRequest, NextResponse } from 'next/server';
import { listExternalApiTransactions } from '@/lib/external-wallet-api';
import { authenticateAutoMxhApiRequest } from '@/lib/automxh-external-api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateAutoMxhApiRequest(req);
    if (!auth.success || !auth.account) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    return NextResponse.json(await listExternalApiTransactions(auth.account, req.nextUrl.searchParams));
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number'
      ? Number((error as { status: number }).status)
      : 400;

    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể tải lịch sử giao dịch API AutoMXH' },
      { status }
    );
  }
}
