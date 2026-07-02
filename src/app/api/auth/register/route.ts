import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { sendSystemEmail } from '@/lib/admin-alert-email';
import { isEmailVerificationRolloutEnabled } from '@/lib/auth-email-verification';
import { generateEmailVerificationCode, getEmailVerificationExpiresAt } from '@/lib/email-verification';
import {
  MAX_ACCOUNTS_PER_IP,
  autoBanRegistrationIp,
  buildBlockedIpPayload,
  countAccountsByIp,
  getIpBlock,
  getRequestIp,
  isTrackableIp,
  logSecurityEvent,
} from '@/lib/ip-security';
import { logOwnerSecurityEvent } from '@/lib/owner-security';
import { assertRegistrationRiskAllowed, RegistrationSecurityError } from '@/lib/registration-security';
import { siteName } from '@/lib/seo';
import { assertUserEmailAvailable, isValidUserEmail, normalizeUserEmail } from '@/lib/user-email-guard';

export const runtime = 'nodejs';

function validateUsername(username: string): boolean {
  return /^[a-zA-Z0-9_.@-]{3,50}$/.test(username);
}

export async function POST(req: NextRequest) {
  try {
    const ip = getRequestIp(req);
    const blockedIp = await getIpBlock(ip);
    if (blockedIp) {
      await logSecurityEvent({
        eventType: 'REGISTER_BLOCKED_IP',
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

    const accountCount = await countAccountsByIp(ip);
    if (isTrackableIp(ip) && accountCount >= MAX_ACCOUNTS_PER_IP) {
      await autoBanRegistrationIp(ip, accountCount, req);
      return NextResponse.json(
        buildBlockedIpPayload(
          ip,
          `IP này đã tạo ${accountCount} tài khoản. Hệ thống đã khóa IP, vui lòng liên hệ admin để mở khóa.`
        ),
        { status: 403 }
      );
    }

    const { username, email, password, fullname } = await req.json();
    const normalizedUsername = String(username || '').trim().toLowerCase();
    const normalizedEmail = normalizeUserEmail(email);

    if (!normalizedUsername || !normalizedEmail || !password) {
      return NextResponse.json(
        { success: false, message: 'Vui lòng nhập đầy đủ thông tin bắt buộc' },
        { status: 400 }
      );
    }

    if (!validateUsername(normalizedUsername)) {
      return NextResponse.json(
        { success: false, message: 'Tên đăng nhập không hợp lệ (3-50 ký tự, chỉ chứa a-z, 0-9, _, ., @, -)' },
        { status: 400 }
      );
    }

    if (String(password).length < 8) {
      return NextResponse.json(
        { success: false, message: 'Mật khẩu phải có ít nhất 8 ký tự' },
        { status: 400 }
      );
    }

    if (!isValidUserEmail(normalizedEmail)) {
      return NextResponse.json(
        { success: false, message: 'Email không hợp lệ' },
        { status: 400 }
      );
    }

    try {
      await assertRegistrationRiskAllowed({
        req,
        email: normalizedEmail,
        username: normalizedUsername,
        provider: 'password',
        intent: 'signup',
      });
    } catch (error) {
      if (error instanceof RegistrationSecurityError) {
        return NextResponse.json(
          {
            success: false,
            code: 'REGISTRATION_RISK_BLOCKED',
            message: error.result.message,
            risk_score: error.result.riskScore,
          },
          { status: 403 }
        );
      }

      throw error;
    }

    try {
      await assertUserEmailAvailable(normalizedEmail);
    } catch (error) {
      return NextResponse.json(
        { success: false, message: error instanceof Error ? error.message : 'Email đã được sử dụng' },
        { status: 409 }
      );
    }

    const existing = await db.users.findFirst({
      where: {
        OR: [
          { username: normalizedUsername },
          { email: normalizedEmail },
        ],
      },
      select: {
        username: true,
        email: true,
      },
    });

    if (existing) {
      if (existing.username.toLowerCase() === normalizedUsername) {
        return NextResponse.json(
          { success: false, message: 'Tên đăng nhập đã được sử dụng' },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { success: false, message: 'Email đã được sử dụng' },
        { status: 409 }
      );
    }

    const hashed = await bcrypt.hash(String(password), 10);
    const emailVerificationEnabled = isEmailVerificationRolloutEnabled();
    const verificationCode = emailVerificationEnabled ? generateEmailVerificationCode() : '';
    const verificationExpiresAt = emailVerificationEnabled ? getEmailVerificationExpiresAt(15) : null;
    const safeFullname = String(fullname || normalizedUsername).trim();

    const user = await db.users.create({
      data: {
        username: normalizedUsername,
        email: normalizedEmail,
        password: hashed,
        fullname: safeFullname,
        role: 'member',
        status: emailVerificationEnabled ? 'suspended' : 'active',
        balance: 0,
        game_balance: 0,
        rank: 'Member',
        last_ip: isTrackableIp(ip) ? ip : null,
        email_verified: emailVerificationEnabled ? false : true,
        requires_email_setup: emailVerificationEnabled,
      },
      select: {
        id: true,
        username: true,
        email: true,
      },
    });

    if (emailVerificationEnabled) {
      await db.$executeRawUnsafe(
        `
          UPDATE users
          SET verification_code = ?, verification_expires_at = ?, updated_at = NOW()
          WHERE id = ?
        `,
        verificationCode,
        verificationExpiresAt,
        user.id
      ).catch(() => undefined);
    }

    await db.activity_logs.create({
      data: {
        user_id: user.id,
        activity: `Đăng ký tài khoản chờ xác thực email từ IP ${ip}`,
        ip_address: isTrackableIp(ip) ? ip : undefined,
        user_agent: req.headers.get('user-agent') || undefined,
      },
    }).catch(() => undefined);

    await logOwnerSecurityEvent({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: 'member',
      },
      req,
      eventType: 'USER_REGISTER',
      layer: 'audit',
      verdict: emailVerificationEnabled ? 'pending_email' : 'created',
      riskScore: isTrackableIp(ip) ? 0 : 10,
      reasons: [
        `registered_email:${normalizedEmail}`,
        isTrackableIp(ip) ? `registered_ip:${ip}` : 'untracked_ip',
      ],
      details: {
        fullname: safeFullname,
        email_verification_enabled: emailVerificationEnabled,
      },
    }).catch(() => undefined);

    if (emailVerificationEnabled) {
      const subject = `[${siteName}] Mã xác thực đăng ký tài khoản`;
      const text = [
        `Xin chào ${safeFullname},`,
        '',
        `Đây là mã xác thực để kích hoạt tài khoản ${siteName}:`,
        verificationCode,
        '',
        'Mã có hiệu lực trong 15 phút.',
        'Sau khi xác thực xong, tài khoản mới được kích hoạt để đăng nhập.',
      ].join('\n');

      const html = `
        <div style="font-family:Arial,Helvetica,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;">
          <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;">
            <div style="padding:24px 28px;background:linear-gradient(135deg,#0f172a,#1d4ed8);color:#ffffff;">
              <div style="font-size:11px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;opacity:.8;">Email Verification</div>
              <h1 style="margin:12px 0 0;font-size:30px;line-height:1.15;">Xác thực tài khoản</h1>
            </div>
            <div style="padding:28px;">
              <p style="margin:0 0 14px;font-size:15px;line-height:1.8;">Xin chào <strong>${safeFullname}</strong>,</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.8;">Bạn vừa đăng ký tài khoản tại <strong>${siteName}</strong>. Nhập mã xác thực bên dưới để kích hoạt tài khoản:</p>
              <div style="display:inline-block;padding:16px 22px;border-radius:16px;background:#eff6ff;border:1px solid #bfdbfe;font-size:28px;font-weight:800;letter-spacing:0.28em;color:#1d4ed8;">
                ${verificationCode}
              </div>
              <p style="margin:18px 0 0;font-size:14px;line-height:1.8;color:#64748b;">Mã có hiệu lực trong 15 phút. Sau khi xác thực xong, tài khoản mới được kích hoạt để đăng nhập.</p>
            </div>
          </div>
        </div>
      `;

      const emailResult = await sendSystemEmail({
        to: [normalizedEmail],
        subject,
        text,
        html,
      });

      if (!emailResult.sent) {
        return NextResponse.json(
          {
            success: false,
            message: String(emailResult.reason || 'Không gửi được email xác thực. Vui lòng kiểm tra cấu hình SMTP.'),
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: emailVerificationEnabled
        ? 'Đăng ký thành công. Mã xác thực đã được gửi về email của bạn. Nhập mã để kích hoạt tài khoản trước khi đăng nhập.'
        : 'Đăng ký thành công.',
      user,
      next_step: emailVerificationEnabled ? 'verify-email' : 'login',
    });
  } catch (error) {
    console.error('Register error:', error);
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    ) {
      return NextResponse.json(
        { success: false, message: 'Email hoặc tên đăng nhập đã được sử dụng' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, message: 'Có lỗi xảy ra. Vui lòng thử lại.' },
      { status: 500 }
    );
  }
}
