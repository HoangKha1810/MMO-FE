import { NextRequest, NextResponse } from 'next/server';
import { listResources } from '@/lib/legacy-modules';

export const dynamic = 'force-dynamic';

const cacheHeaders = {
  'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
};

export async function GET(req: NextRequest) {
  const search = (req.nextUrl.searchParams.get('search') || '').trim();
  const category = (req.nextUrl.searchParams.get('category') || '').trim();

  try {
    const resources = await listResources({ search, category, limit: 100 });

    return NextResponse.json({ success: true, data: resources }, { headers: cacheHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể tải tài nguyên';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
