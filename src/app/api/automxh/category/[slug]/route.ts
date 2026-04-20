import { NextRequest, NextResponse } from 'next/server';
import { getLegacySettingsMap, getVatPercent } from '@/lib/legacy-settings';
import { getAutoMxhCategory, getAutoMxhProductsForCategory, parseProductInputs } from '@/lib/automxh';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const category = await getAutoMxhCategory(decodeURIComponent(slug || ''));

    if (!category) {
      return NextResponse.json(
        { success: false, message: 'Không tìm thấy nhóm dịch vụ Auto MXH' },
        { status: 404 }
      );
    }

    const [products, settings] = await Promise.all([
      getAutoMxhProductsForCategory(category.id),
      getLegacySettingsMap(),
    ]);

    return NextResponse.json({
      success: true,
      category,
      vat_percent: getVatPercent(settings),
      data: products.map((product) => ({
        ...product,
        inputs: parseProductInputs(product),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể tải nhóm dịch vụ Auto MXH';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
