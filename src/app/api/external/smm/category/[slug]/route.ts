import { NextRequest, NextResponse } from 'next/server';
import { authenticateSmmApiRequest, getExternalSmmCategory } from '@/lib/smm-external-api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const auth = await authenticateSmmApiRequest(req);
    if (!auth.success || !auth.account) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status, headers: noStoreHeaders });
    }

    const { slug } = await context.params;
    const data = await getExternalSmmCategory(slug);
    return NextResponse.json(data, { headers: noStoreHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể tải nhóm dịch vụ SMM';
    return NextResponse.json(
      { success: false, message },
      { status: /không tìm thấy/i.test(message) ? 404 : 500, headers: noStoreHeaders }
    );
  }
}
