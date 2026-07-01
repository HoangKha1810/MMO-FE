import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerApi } from '@/lib/admin-auth';
import {
  listOwnerTrustedDevices,
  restoreOwnerTrustedDevice,
  revokeOwnerTrustedDevice,
} from '@/lib/owner-security';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function GET(req: NextRequest) {
  const auth = await requireOwnerApi(req);
  if (auth.response || !auth.user) {
    return auth.response as NextResponse;
  }

  const devices = await listOwnerTrustedDevices();
  return NextResponse.json({ success: true, devices }, { headers: noStoreHeaders });
}

export async function POST(req: NextRequest) {
  const auth = await requireOwnerApi(req);
  if (auth.response || !auth.user) {
    return auth.response as NextResponse;
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '').trim().toLowerCase();
    const deviceId = Math.trunc(Number(body.id || body.device_id || 0));
    if (!deviceId) {
      return NextResponse.json({ success: false, message: 'Thiếu ID thiết bị owner.' }, { status: 400 });
    }

    if (action === 'revoke') {
      const result = await revokeOwnerTrustedDevice({
        deviceId,
        adminId: auth.user.id,
        req,
        reason: String(body.reason || '').trim() || undefined,
      });
      return NextResponse.json(result, { headers: noStoreHeaders });
    }

    if (action === 'restore') {
      const result = await restoreOwnerTrustedDevice({
        deviceId,
        adminId: auth.user.id,
        req,
        unblockIp: body.unblock_ip !== false,
      });
      return NextResponse.json(result, { headers: noStoreHeaders });
    }

    return NextResponse.json({ success: false, message: 'Action thiết bị owner chưa được hỗ trợ.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không xử lý được thiết bị owner.' },
      { status: 400, headers: noStoreHeaders }
    );
  }
}
