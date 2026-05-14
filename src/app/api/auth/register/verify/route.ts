import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureGameApiKeyForUser } from '@/lib/game-integration-api';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    const code = String(body.code || '').trim();

    if (!email || !code) {
      return NextResponse.json({ success: false, message: 'Vui lòng nhập đầy đủ email và mã xác thực.' }, { status: 400 });
    }

    const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `
        SELECT id, email
        FROM users
        WHERE email = ?
          AND verification_code = ?
          AND verification_expires_at IS NOT NULL
          AND verification_expires_at >= NOW()
        ORDER BY id DESC
        LIMIT 1
      `,
      email,
      code
    );

    const user = rows[0];
    if (!user) {
      return NextResponse.json({ success: false, message: 'Mã xác thực không đúng hoặc đã hết hạn.' }, { status: 400 });
    }

    await db.$executeRawUnsafe(
      `
        UPDATE users
        SET email_verified = 1,
            requires_email_setup = 0,
            status = 'active',
            verification_code = NULL,
            verification_expires_at = NULL,
            updated_at = NOW()
        WHERE id = ?
      `,
      Number(user.id || 0)
    );

    await ensureGameApiKeyForUser(Number(user.id || 0)).catch(() => undefined);

    await db.activity_logs.create({
      data: {
        user_id: Number(user.id || 0),
        activity: `Kích hoạt tài khoản qua xác thực email: ${String(user.email || email)}`,
        ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null,
        user_agent: req.headers.get('user-agent') || null,
      },
    }).catch(() => undefined);

    return NextResponse.json({
      success: true,
      message: 'Đã xác thực email thành công. Tài khoản đã được kích hoạt, bạn có thể đăng nhập ngay.',
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể xác thực email.' },
      { status: 500 }
    );
  }
}
