import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureBlueTickTables, isBlueTickEntitlementActive } from '@/lib/blue-tick';
import { buildLegacyAssetUrl } from '@/lib/legacy-settings';
import { getOwnerCurrentDeviceRevocation, isOwnerRole } from '@/lib/owner-security';
import {
  AUTH_SESSION_ROLE_COOKIE,
  createSessionCookieOptions,
  createSignedSessionRoleToken,
  getVerifiedSessionUserId,
} from '@/lib/session-cookie';
import { toNumber } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function GET(req: NextRequest) {
  const userId = await getVerifiedSessionUserId();

  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });
  }

  try {
    await ensureBlueTickTables();

    const user = await db.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true,
        balance: true,
        game_balance: true,
        rank: true,
        role: true,
        status: true,
        is_blue_tick: true,
        blue_tick_expiry: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, code: 'INVALID_SESSION', message: 'Không tìm thấy phiên đăng nhập.' },
        { status: 401, headers: noStoreHeaders }
      );
    }

    if (String(user.status || '').trim().toLowerCase() !== 'active') {
      return NextResponse.json(
        {
          success: false,
          code: 'ACCOUNT_BANNED',
          bannedUser: true,
          message: 'Tài khoản đã bị khóa. Vui lòng liên hệ owner để mở khóa.',
        },
        { status: 403, headers: noStoreHeaders }
      );
    }

    if (isOwnerRole(user.role)) {
      const revokedDevice = await getOwnerCurrentDeviceRevocation(req, user.id).catch(() => null);
      if (revokedDevice) {
        return NextResponse.json(
          {
            success: false,
            code: 'OWNER_DEVICE_REVOKED',
            blocked: true,
            bannedUser: true,
            message: 'Thiết bị owner này đã bị đăng xuất và khóa. Cần owner mở thủ công trước khi đăng nhập lại.',
            device_id: revokedDevice.deviceId,
            ip: revokedDevice.ip,
          },
          { status: 403, headers: noStoreHeaders }
        );
      }
    }

    await db.users.update({
      where: { id: userId },
      data: { last_activity: new Date() },
    }).catch(() => undefined);

    const response = NextResponse.json({
      success: true,
      user: {
        ...user,
        avatar: buildLegacyAssetUrl(user.avatar) || undefined,
        balance: toNumber(user.balance, 0),
        game_balance: toNumber(user.game_balance, 0),
        is_blue_tick: isBlueTickEntitlementActive(user.is_blue_tick, user.blue_tick_expiry),
        blue_tick_expiry: user.blue_tick_expiry ? user.blue_tick_expiry.toISOString() : null,
      },
    }, { headers: noStoreHeaders });

    response.cookies.set(
      AUTH_SESSION_ROLE_COOKIE,
      createSignedSessionRoleToken(user.id, String(user.role || 'member'), 60 * 60 * 24),
      createSessionCookieOptions(60 * 60 * 24)
    );

    return response;
  } catch {
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500, headers: noStoreHeaders });
  }
}
