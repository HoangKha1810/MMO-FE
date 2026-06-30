import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedSessionUserId } from '@/lib/session-cookie';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function PATCH(req: NextRequest) {
  const userId = await getVerifiedSessionUserId();

  if (!userId) {
    return NextResponse.json({ success: false, message: 'Vui lòng đăng nhập' }, { status: 401, headers: noStoreHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const currentPassword = String(body.current_password || '').trim();
    const newPassword = String(body.new_password || '').trim();
    const confirmPassword = String(body.confirm_password || '').trim();

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json({ success: false, message: 'Vui lòng nhập đầy đủ mật khẩu hiện tại, mật khẩu mới và xác nhận mật khẩu.' }, { status: 400, headers: noStoreHeaders });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ success: false, message: 'Mật khẩu mới phải có ít nhất 8 ký tự.' }, { status: 400, headers: noStoreHeaders });
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ success: false, message: 'Xác nhận mật khẩu mới không khớp.' }, { status: 400, headers: noStoreHeaders });
    }

    const user = await db.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        password: true,
        username: true,
      },
    });

    if (!user) {
      return NextResponse.json({ success: false, message: 'Không tìm thấy tài khoản.' }, { status: 404, headers: noStoreHeaders });
    }

    const passwordOk = await bcrypt.compare(currentPassword, user.password);
    if (!passwordOk) {
      return NextResponse.json({ success: false, message: 'Mật khẩu hiện tại không đúng.' }, { status: 400, headers: noStoreHeaders });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.$executeRawUnsafe(
      `
        UPDATE users
        SET password = ?,
            failed_login_attempts = 0,
            failed_2fa_attempts = 0,
            failed_pin_attempts = 0,
            updated_at = NOW(),
            last_activity = NOW()
        WHERE id = ?
      `,
      hashedPassword,
      userId
    );

    await db.activity_logs.create({
      data: {
        user_id: userId,
        activity: `Đổi mật khẩu thủ công trong hồ sơ tài khoản`,
        ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null,
        user_agent: req.headers.get('user-agent') || null,
      },
    }).catch(() => undefined);

    return NextResponse.json({ success: true, message: 'Đã đổi mật khẩu thành công.' }, { headers: noStoreHeaders });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể đổi mật khẩu.' },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
