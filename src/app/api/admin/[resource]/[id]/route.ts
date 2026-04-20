import { NextRequest, NextResponse } from 'next/server';
import {
  deleteAdminResource,
  updateAdminResource,
} from '@/lib/admin-data';
import { requireAdminApi } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ resource: string; id: string }> }
) {
  const auth = await requireAdminApi(req);
  if (auth.response) return auth.response;

  try {
    const { resource, id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const data = await updateAdminResource(resource, Number(id), body, auth.user!.id, req);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể cập nhật dữ liệu admin';
    return NextResponse.json({ success: false, message }, { status: 400 });
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
    const data = await deleteAdminResource(resource, Number(id), auth.user!.id, req);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể xóa dữ liệu admin';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
