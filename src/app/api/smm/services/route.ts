import { NextRequest, NextResponse } from 'next/server';
import { getSmmProviderMeta, listSmmServices } from '@/lib/smm-provider';

export const dynamic = 'force-dynamic';

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function GET(req: NextRequest) {
  try {
    const forceRefresh = req.nextUrl.searchParams.get('refresh') === '1';
    const [services, meta] = await Promise.all([
      listSmmServices(forceRefresh),
      getSmmProviderMeta(),
    ]);
    const platforms = Array.from(new Set(services.map((service) => service.platform)));
    const categories = Array.from(new Set(services.map((service) => service.category)));

    return NextResponse.json({
      success: true,
      meta,
      summary: {
        totalServices: services.length,
        totalPlatforms: platforms.length,
        totalCategories: categories.length,
      },
      data: services,
    }, { headers: noStoreHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể tải dịch vụ SMM';
    return NextResponse.json({ success: false, message }, { status: 500, headers: noStoreHeaders });
  }
}
