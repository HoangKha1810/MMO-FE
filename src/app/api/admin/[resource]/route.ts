import { NextRequest, NextResponse } from 'next/server';
import {
  createAdminResource,
  listAdminResource,
  runAdminAction,
} from '@/lib/admin-data';
import { assertAdminResourceAccess, requireAdminApi } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function GET(req: NextRequest, context: { params: Promise<{ resource: string }> }) {
  const auth = await requireAdminApi(req);
  if (auth.response) return auth.response;

  try {
    const { resource } = await context.params;
    const denied = await assertAdminResourceAccess(auth.user!, resource, 'list', req);
    if (denied) return denied;
    const data = await listAdminResource(resource, req.nextUrl.searchParams);
    return NextResponse.json(data, { headers: noStoreHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể tải dữ liệu admin';
    return NextResponse.json({ success: false, message }, { status: 500, headers: noStoreHeaders });
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ resource: string }> }) {
  const auth = await requireAdminApi(req);
  if (auth.response) return auth.response;

  try {
    const { resource } = await context.params;
    const body = await req.json().catch(() => ({}));
    const denied = await assertAdminResourceAccess(auth.user!, resource, body?.action ? 'action' : 'create', req);
    if (denied) return denied;
    const data = body?.action
      ? await runAdminAction(resource, body, auth.user!.id, req)
      : await createAdminResource(resource, body, auth.user!.id, req);

    return NextResponse.json(data, { headers: noStoreHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể xử lý dữ liệu admin';
    return NextResponse.json({ success: false, message }, { status: 400, headers: noStoreHeaders });
  }
}
