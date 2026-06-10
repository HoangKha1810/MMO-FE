import { NextResponse } from 'next/server';
import { getPressSampleDocxPath, listPressPublications } from '@/lib/press-service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function GET() {
  try {
    const publications = await listPressPublications({ activeOnly: true });
    return NextResponse.json({
      success: true,
      data: publications,
      sample_docx: getPressSampleDocxPath(),
    }, { headers: noStoreHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không tải được bảng giá báo chí';
    return NextResponse.json({ success: false, message }, { status: 500, headers: noStoreHeaders });
  }
}
