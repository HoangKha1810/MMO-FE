import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { shouldRequireEmailVerificationForUser } from '@/lib/auth-email-verification';
import { buildBlockedIpPayload, getIpBlock, getRequestIp, logSecurityEvent } from '@/lib/ip-security';
import { buildLegacyAssetUrl } from '@/lib/legacy-settings';
import {
  clearAuthenticatedSessionCookies,
  clearTwoFactorPendingCookie,
  setAuthenticatedSessionCookies,
  setTwoFactorPendingCookie,
} from '@/lib/session-cookie';
import { isOwnerRole } from '@/lib/admin-permissions';
import { logOwnerSecurityEvent } from '@/lib/owner-security';
import { isSupportTikTokStaffRole } from '@/lib/support-tiktok';
import { assertUserEmailUniqueForLogin, countUsersByEmail } from '@/lib/user-email-guard';
import { toNumber } from '@/lib/utils';

async function findLoginUser(identifier: string) {
  const isEmailLike = identifier.includes('@');
  const select = {
    id: true,
    username: true,
    email: true,
    password: true,
    balance: true,
    game_balance: true,
    rank: true,
    role: true,
    status: true,
    avatar: true,
    is_blue_tick: true,
    fa_enabled: true,
    email_verified: true,
    created_at: true,
  } as const;

  if (isEmailLike) {
    const byEmail = await db.users.findUnique({
      where: { email: identifier },
      select,
    });
    if (byEmail) {
      return byEmail;
    }

    return db.users.findUnique({
      where: { username: identifier },
      select,
    });
  }

  const byUsername = await db.users.findUnique({
    where: { username: identifier },
    select,
  });
  if (byUsername) {
    return byUsername;
  }

  return db.users.findUnique({
    where: { email: identifier },
    select,
  });
}

export async function POST(req: NextRequest) {
  try {
    const ip = getRequestIp(req);
    const blockedIp = await getIpBlock(ip);
    if (blockedIp) {
      await logSecurityEvent({
        eventType: 'LOGIN_BLOCKED_IP',
        severity: 'HIGH',
        ip,
        uri: req.nextUrl.pathname,
        method: req.method,
        field: 'ip',
        payload: String(blockedIp.reason || 'blocked'),
        userAgent: req.headers.get('user-agent'),
      });
      return NextResponse.json(
        buildBlockedIpPayload(ip, blockedIp.reason),
        { status: 403 }
      );
    }

    const { username, password, remember } = await req.json();
    const normalizedUsername = String(username || '').trim().toLowerCase();

    if (!normalizedUsername || !password) {
      return NextResponse.json(
        { success: false, message: 'Vui lòng nhập đầy đủ thông tin' },
        { status: 400 }
      );
    }

    if (normalizedUsername.includes('@') && await countUsersByEmail(normalizedUsername) > 1) {
      await logSecurityEvent({
        eventType: 'LOGIN_BLOCKED_DUPLICATE_EMAIL',
        severity: 'HIGH',
        ip,
        uri: req.nextUrl.pathname,
        method: req.method,
        field: 'email',
        payload: normalizedUsername,
        userAgent: req.headers.get('user-agent'),
      });
      return NextResponse.json(
        { success: false, message: 'Email này đang được gán cho nhiều tài khoản. Vui lòng liên hệ owner/admin để xử lý trước khi đăng nhập.' },
        { status: 409 }
      );
    }

    const user = await findLoginUser(normalizedUsername);

    if (!user) {
      await logSecurityEvent({
        eventType: 'LOGIN_FAILED',
        severity: 'MEDIUM',
        ip,
        uri: req.nextUrl.pathname,
        method: req.method,
        field: 'username',
        payload: normalizedUsername,
        userAgent: req.headers.get('user-agent'),
      });
      return NextResponse.json(
        { success: false, message: 'Tên đăng nhập hoặc mật khẩu không đúng' },
        { status: 401 }
      );
    }

    const passwordOk = await bcrypt.compare(String(password), user.password);
    if (!passwordOk) {
      await logSecurityEvent({
        eventType: 'LOGIN_FAILED',
        severity: 'MEDIUM',
        ip,
        userId: user.id,
        uri: req.nextUrl.pathname,
        method: req.method,
        field: 'password',
        payload: normalizedUsername,
        userAgent: req.headers.get('user-agent'),
      });
      return NextResponse.json(
        { success: false, message: 'Tên đăng nhập hoặc mật khẩu không đúng' },
        { status: 401 }
      );
    }

    try {
      await assertUserEmailUniqueForLogin(user.email, user.id);
    } catch (error) {
      await logSecurityEvent({
        eventType: 'LOGIN_BLOCKED_DUPLICATE_EMAIL',
        severity: 'HIGH',
        ip,
        userId: user.id,
        uri: req.nextUrl.pathname,
        method: req.method,
        field: 'email',
        payload: String(user.email || ''),
        userAgent: req.headers.get('user-agent'),
      });
      return NextResponse.json(
        { success: false, message: error instanceof Error ? error.message : 'Email tài khoản đang bị trùng, vui lòng liên hệ owner/admin.' },
        { status: 409 }
      );
    }

    if (user.status === 'banned' || user.status === 'locked') {
      await logSecurityEvent({
        eventType: 'LOGIN_BLOCKED_USER',
        severity: 'HIGH',
        ip,
        userId: user.id,
        uri: req.nextUrl.pathname,
        method: req.method,
        field: 'status',
        payload: String(user.status),
        userAgent: req.headers.get('user-agent'),
      });
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

    if (shouldRequireEmailVerificationForUser({ createdAt: user.created_at, emailVerified: user.email_verified })) {
      return NextResponse.json(
        { success: false, message: 'Tài khoản chưa được kích hoạt. Vui lòng xác thực email trước khi đăng nhập.' },
        { status: 403 }
      );
    }

    if (user.status !== 'active') {
      await logSecurityEvent({
        eventType: 'LOGIN_INACTIVE_USER',
        severity: 'HIGH',
        ip,
        userId: user.id,
        uri: req.nextUrl.pathname,
        method: req.method,
        field: 'status',
        payload: String(user.status),
        userAgent: req.headers.get('user-agent'),
      });
      return NextResponse.json(
        { success: false, message: 'Tài khoản không hoạt động' },
        { status: 403 }
      );
    }

    if (isOwnerRole(user.role)) {
      await logSecurityEvent({
        eventType: 'OWNER_PUBLIC_LOGIN_BLOCKED',
        severity: 'HIGH',
        ip,
        userId: user.id,
        uri: req.nextUrl.pathname,
        method: req.method,
        field: 'role',
        payload: 'owner',
        userAgent: req.headers.get('user-agent'),
      });
      return NextResponse.json(
        { success: false, message: 'Owner chỉ được đăng nhập qua cổng admin bảo mật.' },
        { status: 403 }
      );
    }

    let rememberToken: string | undefined;
    if (remember) {
      rememberToken = crypto.randomBytes(32).toString('hex');
    }

    await db.users.update({
      where: { id: user.id },
      data: {
        last_ip: ip,
        last_login: new Date(),
        last_activity: new Date(),
        ...(rememberToken ? { remember_token: rememberToken } : {}),
      },
    });

    await logOwnerSecurityEvent({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: String(user.role || 'member'),
      },
      req,
      eventType: 'USER_LOGIN',
      layer: 'audit',
      verdict: 'password_ok',
      riskScore: 0,
      reasons: [`role:${String(user.role || 'member')}`],
    }).catch(() => undefined);

    const sessionMaxAge = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 24;

    const redirectPath = isSupportTikTokStaffRole(user.role) ? '/user/support-tiktok' : '/user/home';

    if (String(user.role || 'member') === 'admin' && user.fa_enabled) {
      const response = NextResponse.json({ success: true, require2fa: true, redirect: redirectPath });
      response.cookies.delete('user_id');
      setTwoFactorPendingCookie(response, user.id, 60 * 10);
      return response;
    }

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        balance: toNumber(user.balance, 0),
        game_balance: toNumber(user.game_balance, 0),
        rank: user.rank || 'Member',
        role: String(user.role || 'member'),
        avatar: buildLegacyAssetUrl(user.avatar) || undefined,
        is_blue_tick: Boolean(user.is_blue_tick),
      },
      redirect: redirectPath,
    });
    clearTwoFactorPendingCookie(response);
    setAuthenticatedSessionCookies(response, user.id, sessionMaxAge, String(user.role || 'member'));
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, message: 'Có lỗi xảy ra. Vui lòng thử lại.' },
      { status: 500 }
    );
  }
}
