import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { buildBlockedIpPayload, getIpBlock, getRequestIp, logSecurityEvent } from '@/lib/ip-security';
import { buildLegacyAssetUrl } from '@/lib/legacy-settings';
import { toNumber } from '@/lib/utils';

function createSessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge,
    path: '/',
  };
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

    const user = await db.users.findFirst({
      where: {
        OR: [
          { username: normalizedUsername },
          { email: normalizedUsername },
        ],
      },
      select: {
        id: true,
        username: true,
        email: true,
        password: true,
        balance: true,
        rank: true,
        role: true,
        status: true,
        avatar: true,
        is_blue_tick: true,
        fa_enabled: true,
      },
    });

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
      return NextResponse.json(
        { success: false, message: 'Tài khoản đã bị khóa. Vui lòng liên hệ hỗ trợ.' },
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

    const sessionMaxAge = remember ? 60 * 60 * 24 * 30 : 60 * 60 * 24;

    if (user.fa_enabled) {
      const response = NextResponse.json({ success: true, require2fa: true });
      response.cookies.delete('user_id');
      response.cookies.set('2fa_pending', String(user.id), createSessionCookieOptions(60 * 10));
      return response;
    }

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        balance: toNumber(user.balance, 0),
        rank: user.rank || 'Member',
        role: String(user.role || 'member'),
        avatar: buildLegacyAssetUrl(user.avatar) || undefined,
        is_blue_tick: Boolean(user.is_blue_tick),
      },
    });
    response.cookies.delete('2fa_pending');
    response.cookies.set('user_id', String(user.id), createSessionCookieOptions(sessionMaxAge));
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, message: 'Có lỗi xảy ra. Vui lòng thử lại.' },
      { status: 500 }
    );
  }
}
