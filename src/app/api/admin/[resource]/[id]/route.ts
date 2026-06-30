import { NextRequest, NextResponse } from 'next/server';
import {
  deleteAdminResource,
  getAdminResourceDetail,
  updateAdminResource,
} from '@/lib/admin-data';
import { assertAdminResourceAccess, requireAdminApi } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ resource: string; id: string }> }
) {
  const auth = await requireAdminApi(req);
  if (auth.response) return auth.response;

  try {
    const { resource, id } = await context.params;
    const denied = await assertAdminResourceAccess(auth.user!, resource, 'update', req);
    if (denied) return denied;
    const body = await req.json().catch(() => ({}));
    const data = await updateAdminResource(resource, Number(id), body, auth.user!.id, req);
    return NextResponse.json(data, { headers: noStoreHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể cập nhật dữ liệu admin';
    return NextResponse.json({ success: false, message }, { status: 400, headers: noStoreHeaders });
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ resource: string; id: string }> }
) {
  const auth = await requireAdminApi(req);
  if (auth.response) return auth.response;

  try {
    const { resource, id } = await context.params;
    const denied = await assertAdminResourceAccess(auth.user!, resource, 'detail', req);
    if (denied) return denied;
    const data = await getAdminResourceDetail(resource, Number(id));
    return NextResponse.json(data, { headers: noStoreHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể tải chi tiết dữ liệu admin';
    return NextResponse.json({ success: false, message }, { status: 400, headers: noStoreHeaders });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ resource: string; id: string }> }
) {
  const auth = await requireAdminApi(req);
  if (auth.response) return auth.response;

  try {
    const { resource, id } = await context.params;
    const denied = await assertAdminResourceAccess(auth.user!, resource, 'delete', req);
    if (denied) return denied;
    const data = await deleteAdminResource(resource, Number(id), auth.user!.id, req);
    return NextResponse.json(data, { headers: noStoreHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể xóa dữ liệu admin';
    return NextResponse.json({ success: false, message }, { status: 400, headers: noStoreHeaders });
  }
}
