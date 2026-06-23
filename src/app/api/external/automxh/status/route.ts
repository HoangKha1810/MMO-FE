import { NextRequest, NextResponse } from 'next/server';
import { authenticateAutoMxhApiRequest, getExternalAutoMxhStatus } from '@/lib/automxh-external-api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateAutoMxhApiRequest(req);
    if (!auth.success || !auth.account) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    return NextResponse.json(await getExternalAutoMxhStatus(auth.account, req.nextUrl.searchParams));
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể lấy trạng thái Auto MXH' },
      { status: 400 }
    );
  }
}
