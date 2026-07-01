import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { getRequestIp, getIpBlock, buildBlockedIpPayload } from '@/lib/ip-security';
import {
  clearAuthenticatedSessionCookies,
  clearTwoFactorPendingCookie,
  setAuthenticatedSessionCookies,
  setTwoFactorPendingCookie,
} from '@/lib/session-cookie';
import { isAdminRole, isOwnerRole } from '@/lib/admin-permissions';
import { logOwnerSecurityEvent, verifyOwnerLoginSecurity } from '@/lib/owner-security';

async function findAdminLoginUser(identifier: string) {
  const isEmailLike = identifier.includes('@');
  const attempts = isEmailLike
    ? [
        { email: identifier },
        { username: identifier },
      ]
    : [
        { username: identifier },
        { email: identifier },
      ];

  for (const where of attempts) {
    const user = await db.users.findFirst({
      where,
      select: {
        id: true,
        username: true,
        email: true,
        password: true,
        role: true,
        status: true,
        fa_enabled: true,
        telegram_2fa_enabled: true,
      },
    });

    if (user) {
      return user;
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  const ip = getRequestIp(req);
  const blockedIp = await getIpBlock(ip);
  if (blockedIp) {
    return NextResponse.json(buildBlockedIpPayload(ip, blockedIp.reason), { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');
  const ownerCode = String(body.owner_code || body.security_code || '').trim();
  const user = await findAdminLoginUser(username);

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return NextResponse.json({ success: false, message: 'Sai tài khoản hoặc mật khẩu admin' }, { status: 401 });
  }

  const role = String(user.role || 'member');
  const isAdmin = isAdminRole(role);
  const isOwner = isOwnerRole(role);

  if (!isAdmin) {
    const isSupportTikTok = role.trim().toLowerCase().replace(/-/g, '_') === 'support_tiktok';
    return NextResponse.json(
      {
        success: false,
        message: isSupportTikTok
          ? 'Tài khoản Support TikTok đăng nhập tại cổng /auth, không dùng cổng admin.'
          : 'Tài khoản không có quyền admin.',
      },
      { status: 403 }
    );
  }

  if (user.status !== 'active') {
    const response = NextResponse.json(
      {
        success: false,
        code: 'ACCOUNT_BANNED',
        bannedUser: true,
        message: 'Tài khoản đã bị khóa. Vui lòng liên hệ owner để mở khóa.',
      },
      { status: 403 }
    );
    clearAuthenticatedSessionCookies(response);
    return response;
  }

  if (isOwner) {
    const ownerSecurity = await verifyOwnerLoginSecurity(req, user, { manualCode: ownerCode });
    if (!ownerSecurity.allowed) {
      return NextResponse.json(
        {
          success: false,
          owner_security_required: true,
          message: ownerSecurity.message || 'Owner security denied',
        },
        { status: 403 }
      );
    }
  }

  await db.users.update({
    where: { id: user.id },
    data: { last_ip: ip, last_login: new Date(), last_activity: new Date() },
  });

  await logOwnerSecurityEvent({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role,
    },
    req,
    eventType: 'ADMIN_LOGIN',
    layer: 'audit',
    verdict: 'password_ok',
    riskScore: isOwner ? 10 : 0,
    reasons: [`role:${role}`],
  }).catch(() => undefined);

  if (isAdmin && (user.fa_enabled || isOwner)) {
    const response = NextResponse.json({ success: true, require2fa: true });
    response.cookies.delete('user_id');
    setTwoFactorPendingCookie(response, user.id, 60 * 10);
    return response;
  }

  const response = NextResponse.json({ success: true, redirect: '/admin/dashboard' });
  clearTwoFactorPendingCookie(response);
  setAuthenticatedSessionCookies(response, user.id, 60 * 60 * 12, role);
  return response;
}
