import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { getRequestIp, getIpBlock, buildBlockedIpPayload } from '@/lib/ip-security';

export async function POST(req: NextRequest) {
  const ip = getRequestIp(req);
  const blockedIp = await getIpBlock(ip);
  if (blockedIp) {
    return NextResponse.json(buildBlockedIpPayload(ip, blockedIp.reason), { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');
  const user = await db.users.findFirst({
    where: { OR: [{ username }, { email: username }] },
    select: { id: true, username: true, password: true, role: true, status: true, fa_enabled: true },
  });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return NextResponse.json({ success: false, message: 'Sai tài khoản hoặc mật khẩu admin' }, { status: 401 });
  }

  if (String(user.role) !== 'admin') {
    return NextResponse.json({ success: false, message: 'Tài khoản không có quyền admin' }, { status: 403 });
  }

  if (user.status !== 'active') {
    return NextResponse.json({ success: false, message: 'Tài khoản admin không hoạt động' }, { status: 403 });
  }

  const cookieStore = await cookies();
  cookieStore.set('user_id', String(user.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 12,
    path: '/',
  });

  await db.users.update({
    where: { id: user.id },
    data: { last_ip: ip, last_login: new Date(), last_activity: new Date() },
  });

  if (user.fa_enabled) {
    cookieStore.set('2fa_pending', String(user.id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10,
      path: '/',
    });
    return NextResponse.json({ success: true, require2fa: true });
  }

  return NextResponse.json({ success: true, redirect: '/admin/dashboard' });
}
