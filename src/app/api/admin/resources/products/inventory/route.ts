import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';
import {
  getAdminMmoProductInventory,
  mutateAdminMmoProductInventory,
} from '@/lib/admin-mmo-products';

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
    const resourceId = Number(req.nextUrl.searchParams.get('resource_id') || 0);
    const data = await getAdminMmoProductInventory(resourceId);
    return NextResponse.json(data, { headers: noStoreHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể tải kho sản phẩm';
    return NextResponse.json({ success: false, message }, { status: 400, headers: noStoreHeaders });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi(req);
  if (auth.response) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const data = await mutateAdminMmoProductInventory(body, auth.user!.id, req);
    return NextResponse.json(data, { headers: noStoreHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể cập nhật kho sản phẩm';
    return NextResponse.json({ success: false, message }, { status: 400, headers: noStoreHeaders });
  }
}
