import { NextRequest, NextResponse } from 'next/server';
import { authenticateSmmApiRequest, getExternalSmmStatus } from '@/lib/smm-external-api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateSmmApiRequest(req);
    if (!auth.success || !auth.account) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const data = await getExternalSmmStatus(auth.account, req.nextUrl.searchParams);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể lấy trạng thái đơn SMM' },
      { status: 400 }
    );
  }
}
