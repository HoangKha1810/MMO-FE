import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi, logAdminAction } from '@/lib/admin-auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi(req);
  if (auth.response) {
    return auth.response;
  }

  try {
    const body = await req.json().catch(() => ({}));
    const userId = Number(body.user_id || body.userId || 0);
    const newPassword = String(body.new_password || body.newPassword || '').trim();

    if (!userId) {
      return NextResponse.json({ success: false, message: 'Thiếu user_id' }, { status: 400, headers: noStoreHeaders });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ success: false, message: 'Mật khẩu mới phải có ít nhất 8 ký tự.' }, { status: 400, headers: noStoreHeaders });
    }

    const user = await db.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
      },
    });

    if (!user) {
      return NextResponse.json({ success: false, message: 'Không tìm thấy người dùng.' }, { status: 404, headers: noStoreHeaders });
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

    await logAdminAction({
      adminId: auth.user!.id,
      action: 'admin reset user password',
      target: `${user.username}#${userId}`,
      req,
    });

    return NextResponse.json({
      success: true,
      message: `Đã đổi mật khẩu cho ${user.username}.`,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    }, { headers: noStoreHeaders });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể đổi mật khẩu user.' },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
