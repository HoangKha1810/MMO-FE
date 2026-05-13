import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendSystemEmail } from '@/lib/admin-alert-email';
import { buildPasswordResetToken } from '@/lib/password-reset';
import { buildAbsoluteUrl, siteName } from '@/lib/seo';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ success: false, message: 'Vui lòng nhập email hợp lệ' }, { status: 400 });
  }

  const user = await db.users.findFirst({
    where: { email },
    select: {
      id: true,
      email: true,
      username: true,
      fullname: true,
      status: true,
    },
  }).catch(() => null);

  if (!user || String(user.status || '').toLowerCase() !== 'active') {
    return NextResponse.json({
      success: true,
      message: 'Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu sẽ được gửi.',
    });
  }

  const token = buildPasswordResetToken(user.id, user.email);
  const resetUrl = buildAbsoluteUrl(`/auth/reset-password?email=${encodeURIComponent(user.email)}&token=${encodeURIComponent(token)}`);
  const displayName = String(user.fullname || user.username || user.email).trim();
  const subject = `[${siteName}] Hướng dẫn đặt lại mật khẩu`;
  const text = [
    `Xin chào ${displayName},`,
    '',
    `Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản ${siteName}.`,
    'Nhấn vào link bên dưới để mở trang đặt lại mật khẩu:',
    resetUrl,
    '',
    'Nếu link không mở được, hãy copy token dưới đây và nhập thủ công trong trang reset:',
    token,
    '',
    'Nếu bạn không yêu cầu thao tác này, hãy bỏ qua email này.',
  ].join('\n');

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;">
        <div style="padding:24px 28px;background:linear-gradient(135deg,#0f172a,#1d4ed8);color:#ffffff;">
          <div style="font-size:11px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;opacity:.8;">Password Reset</div>
          <h1 style="margin:12px 0 0;font-size:30px;line-height:1.15;">Đặt lại mật khẩu</h1>
        </div>
        <div style="padding:28px;">
          <p style="margin:0 0 14px;font-size:15px;line-height:1.8;">Xin chào <strong>${displayName}</strong>,</p>
          <p style="margin:0 0 14px;font-size:15px;line-height:1.8;">Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản <strong>${siteName}</strong>.</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.8;">Bấm nút bên dưới để mở trang đổi mật khẩu:</p>
          <p style="margin:0 0 26px;">
            <a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:14px;font-weight:700;">Mở trang đặt lại mật khẩu</a>
          </p>
          <div style="margin:0 0 18px;padding:16px;border-radius:14px;background:#f8fafc;border:1px solid #e2e8f0;">
            <div style="font-size:11px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#64748b;margin-bottom:8px;">Link trực tiếp</div>
            <div style="font-size:13px;line-height:1.8;word-break:break-all;color:#1d4ed8;">${resetUrl}</div>
          </div>
          <div style="margin:0 0 18px;padding:16px;border-radius:14px;background:#f8fafc;border:1px solid #e2e8f0;">
            <div style="font-size:11px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#64748b;margin-bottom:8px;">Token thủ công</div>
            <div style="font-size:15px;font-family:Consolas,monospace;color:#0f172a;">${token}</div>
          </div>
          <p style="margin:0;font-size:14px;line-height:1.8;color:#64748b;">Nếu bạn không yêu cầu thao tác này, hãy bỏ qua email này.</p>
        </div>
      </div>
    </div>
  `;

  const result = await sendSystemEmail({
    to: [user.email],
    subject,
    text,
    html,
  });

  await db.activity_logs.create({
    data: {
      user_id: user.id,
      activity: result.sent
        ? `Đã gửi email quên mật khẩu tới ${user.email}`
        : `Gửi email quên mật khẩu thất bại: ${String(result.reason || 'Không gửi được email')}`,
      ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null,
      user_agent: req.headers.get('user-agent') || null,
    },
  }).catch(() => undefined);

  if (!result.sent) {
    return NextResponse.json({
      success: false,
      message: String(result.reason || 'Hệ thống chưa gửi được email khôi phục mật khẩu.'),
    }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: 'Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu sẽ được gửi.',
  });
}
