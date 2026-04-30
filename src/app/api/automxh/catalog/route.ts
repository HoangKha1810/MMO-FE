import { NextResponse } from 'next/server';
import { listAutoMxhCatalog } from '@/lib/automxh';

export const dynamic = 'force-dynamic';

const cacheHeaders = {
  'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
};

export async function GET() {
  try {
    const sections = await listAutoMxhCatalog();
    return NextResponse.json({ success: true, data: sections }, { headers: cacheHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể tải dịch vụ Auto MXH';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
