import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { getRequestIp, getIpBlock, buildBlockedIpPayload } from '@/lib/ip-security';
import { isSupportTikTokStaffRole } from '@/lib/support-tiktok';

function createSessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge,
    path: '/',
  };
}

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
      select: { id: true, username: true, password: true, role: true, status: true, fa_enabled: true },
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
  const user = await findAdminLoginUser(username);

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return NextResponse.json({ success: false, message: 'Sai tài khoản hoặc mật khẩu admin' }, { status: 401 });
  }

  const role = String(user.role || 'member');
  const isAdmin = role === 'admin';
  const isSupportTikTok = isSupportTikTokStaffRole(role);

  if (!isAdmin && !isSupportTikTok) {
    return NextResponse.json({ success: false, message: 'Tài khoản không có quyền admin/support TikTok' }, { status: 403 });
  }

  if (user.status !== 'active') {
    return NextResponse.json({ success: false, message: 'Tài khoản không hoạt động' }, { status: 403 });
  }

  await db.users.update({
    where: { id: user.id },
    data: { last_ip: ip, last_login: new Date(), last_activity: new Date() },
  });

  if (isAdmin && user.fa_enabled) {
    const response = NextResponse.json({ success: true, require2fa: true });
    response.cookies.delete('user_id');
    response.cookies.set('2fa_pending', String(user.id), createSessionCookieOptions(60 * 10));
    return response;
  }

  const redirect = isSupportTikTok ? '/user/support-tiktok' : '/admin/dashboard';
  const response = NextResponse.json({ success: true, redirect });
  response.cookies.delete('2fa_pending');
  response.cookies.set('user_id', String(user.id), createSessionCookieOptions(60 * 60 * 12));
  return response;
}
