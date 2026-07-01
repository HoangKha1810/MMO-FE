import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildLegacyAssetUrl } from '@/lib/legacy-settings';
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

export async function GET() {
  const userId = await getVerifiedSessionUserId();

  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });
  }

  try {
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
