import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';
import { getVpsProxyMonitorData } from '@/lib/admin-vps-proxy-monitor';

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
    const data = await getVpsProxyMonitorData();
    return NextResponse.json({ success: true, data }, { headers: noStoreHeaders });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không tải được màn giám sát VPS/Proxy' },
      { status: 400, headers: noStoreHeaders }
    );
  }
}
