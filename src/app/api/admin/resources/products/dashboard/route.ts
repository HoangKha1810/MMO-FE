import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';
import { listAdminMmoProducts } from '@/lib/admin-mmo-products';

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
    const data = await listAdminMmoProducts(req.nextUrl.searchParams);
    return NextResponse.json(data, { headers: noStoreHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể tải danh sách sản phẩm MMO';
    return NextResponse.json({ success: false, message }, { status: 500, headers: noStoreHeaders });
  }
}
