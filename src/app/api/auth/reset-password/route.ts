import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { buildPasswordResetToken } from '@/lib/password-reset';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  const token = String(body.token || '').trim();
  const password = String(body.password || '');

  if (!email) {
    return NextResponse.json({ success: false, message: 'Vui lòng nhập email' }, { status: 400 });
  }

  const user = await db.users.findFirst({ where: { email }, select: { id: true } });
  if (!user) {
    return NextResponse.json({ success: true, message: 'Nếu email tồn tại, hệ thống đã tạo yêu cầu reset.' });
  }

  if (token && password.length >= 6) {
    const expected = buildPasswordResetToken(user.id, email);
    if (token !== expected) {
      return NextResponse.json({ success: false, message: 'Token reset không hợp lệ' }, { status: 400 });
    }
    await db.users.update({
      where: { id: user.id },
      data: { password: await bcrypt.hash(password, 10), failed_login_attempts: 0 },
    });
    return NextResponse.json({ success: true, message: 'Đã đổi mật khẩu' });
  }

  const resetToken = buildPasswordResetToken(user.id, email);
  await db.activity_logs.create({
    data: {
      user_id: user.id,
      activity: `Reset password requested. Token nội bộ: ${resetToken}`,
    },
  }).catch(() => undefined);

  return NextResponse.json({ success: true, message: 'Đã tạo yêu cầu reset. Kiểm tra email/log admin để lấy token.' });
}
