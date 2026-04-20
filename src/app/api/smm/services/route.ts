import { NextRequest, NextResponse } from 'next/server';
import { getSmmProviderMeta, listSmmServices } from '@/lib/smm-provider';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const forceRefresh = req.nextUrl.searchParams.get('refresh') === '1';
    const services = await listSmmServices(forceRefresh);
    const meta = await getSmmProviderMeta();
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
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể tải dịch vụ SMM';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
