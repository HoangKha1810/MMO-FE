import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';
import {
  deleteAdminMmoProduct,
  updateAdminMmoProduct,
} from '@/lib/admin-mmo-products';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi(req);
  if (auth.response) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const { id } = await context.params;
    const data = await updateAdminMmoProduct(Number(id), body, auth.user!.id, req);
    return NextResponse.json(data, { headers: noStoreHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể cập nhật sản phẩm MMO';
    return NextResponse.json({ success: false, message }, { status: 400, headers: noStoreHeaders });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi(req);
  if (auth.response) return auth.response;

  try {
    const { id } = await context.params;
    const data = await deleteAdminMmoProduct(Number(id), auth.user!.id, req);
    return NextResponse.json(data, { headers: noStoreHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể xóa sản phẩm MMO';
    return NextResponse.json({ success: false, message }, { status: 400, headers: noStoreHeaders });
  }
}
