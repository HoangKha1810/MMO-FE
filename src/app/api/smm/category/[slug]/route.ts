import { NextRequest, NextResponse } from 'next/server';
import { getLegacySettingsMap, getVatPercent } from '@/lib/legacy-settings';
import { listSmmServices } from '@/lib/smm-provider';
import { slugify } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function cleanCategoryName(category: string) {
  return category.replace(/\[.*?\]\s*/g, '').trim();
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const decodedSlug = decodeURIComponent(slug || '');
    const [services, settings] = await Promise.all([
      listSmmServices(false),
      getLegacySettingsMap(),
    ]);

    const matchedServices = services.filter(
      (service) => slugify(service.category) === decodedSlug
    );

    if (matchedServices.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Không tìm thấy nhóm dịch vụ SMM' },
        { status: 404 }
      );
    }

    const category = matchedServices[0].category;

    return NextResponse.json({
      success: true,
      category,
      clean_category: cleanCategoryName(category),
      platform: matchedServices[0].platform,
      vat_percent: getVatPercent(settings),
      data: matchedServices,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể tải nhóm dịch vụ SMM';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
