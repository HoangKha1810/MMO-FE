import { NextRequest, NextResponse } from 'next/server';
import { authenticateSmmApiRequest, listExternalSmmCategories } from '@/lib/smm-external-api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateSmmApiRequest(req);
    if (!auth.success || !auth.account) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status, headers: noStoreHeaders });
    }

    const data = await listExternalSmmCategories(req.nextUrl.searchParams);
    return NextResponse.json(data, { headers: noStoreHeaders });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể tải nhóm dịch vụ SMM' },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
