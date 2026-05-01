import { NextRequest, NextResponse } from 'next/server';
import { logAdminAction, requireAdminApi } from '@/lib/admin-auth';
import { getProxyAdminDashboardData, saveProxyAdminSettings } from '@/lib/proxy-service';
import type { ProxyPricingRule } from '@/types/proxy';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi(req);
  if (auth.response) {
    return auth.response;
  }

  try {
    const data = await getProxyAdminDashboardData();
    return NextResponse.json({ success: true, data }, { headers: noStoreHeaders });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể tải dashboard proxy admin' },
      { status: 400, headers: noStoreHeaders }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi(req);
  if (auth.response) {
    return auth.response;
  }

  try {
    const body = await req.json().catch(() => ({}));
    const settings = await saveProxyAdminSettings({
      serviceStatus: body.serviceStatus,
      serviceName: body.serviceName,
      serviceDescription: body.serviceDescription,
      serviceNote: body.serviceNote,
      defaultProtocol: body.defaultProtocol,
      priceMultiplier: Number(body.priceMultiplier || 0),
      packagePricing: body.packagePricing && typeof body.packagePricing === 'object'
        ? body.packagePricing as Record<string, ProxyPricingRule>
        : {},
    });

    await logAdminAction({
      adminId: auth.user!.id,
      action: 'Cập nhật cấu hình proxy',
      target: settings.serviceName,
      req,
    }).catch(() => undefined);

    return NextResponse.json({ success: true, data: settings }, { headers: noStoreHeaders });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể lưu cấu hình proxy' },
      { status: 400, headers: noStoreHeaders }
    );
  }
}
