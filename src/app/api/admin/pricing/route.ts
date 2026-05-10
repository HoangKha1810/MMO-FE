import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';
import { listPricingItems, runPricingAction, updatePricingItem } from '@/lib/admin-pricing';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi(req);
  if (auth.response) return auth.response;

  try {
    const params = req.nextUrl.searchParams;
    const data = await listPricingItems({
      module: params.get('module') || undefined,
      search: params.get('search') || undefined,
      platform: params.get('platform') || undefined,
      provider: params.get('provider') || undefined,
      category: params.get('category') || undefined,
      page: Number(params.get('page') || 1),
      perPage: Number(params.get('per_page') || 50),
    });

    return NextResponse.json(data, { headers: noStoreHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể tải bảng giá';
    return NextResponse.json({ success: false, message }, { status: 500, headers: noStoreHeaders });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdminApi(req);
  if (auth.response) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const data = await updatePricingItem(body, auth.user!.id, req);
    return NextResponse.json(data, { headers: noStoreHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể cập nhật giá';
    return NextResponse.json({ success: false, message }, { status: 400, headers: noStoreHeaders });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi(req);
  if (auth.response) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const data = await runPricingAction(body, auth.user!.id, req);
    return NextResponse.json(data, { headers: noStoreHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể xử lý bảng giá';
    return NextResponse.json({ success: false, message }, { status: 400, headers: noStoreHeaders });
  }
}
