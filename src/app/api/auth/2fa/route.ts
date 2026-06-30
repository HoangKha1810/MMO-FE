import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import {
  clearTwoFactorPendingCookie,
  getVerifiedPendingTwoFactorUserId,
  setAuthenticatedSessionCookies,
} from '@/lib/session-cookie';
import { isAdminRole } from '@/lib/admin-permissions';
import { logOwnerSecurityEvent } from '@/lib/owner-security';

function base32Decode(input: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = input.replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase();
  let bits = '';
  for (const char of clean) {
    const value = alphabet.indexOf(char);
    if (value < 0) continue;
    bits += value.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function hotp(secret: Buffer, counter: number) {
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buffer.writeUInt32BE(counter % 0x100000000, 4);
  const hmac = crypto.createHmac('sha1', secret).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

function verifyTotp(secretValue: string | null, code: string) {
  if (!secretValue || !/^\d{6}$/.test(code)) return false;
  const secret = base32Decode(secretValue);
  if (secret.length === 0) return false;
  const counter = Math.floor(Date.now() / 1000 / 30);
  return [-1, 0, 1].some((offset) => hotp(secret, counter + offset) === code);
}

async function sendTelegramCode(telegramId: string | null | undefined, code: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN || '';
  if (!token || !telegramId) {
    return false;
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: telegramId,
      text: `Mã xác thực TRUNGTAMMMO của bạn: ${code}. Mã chỉ dùng cho lần đăng nhập hiện tại.`,
    }),
  }).catch(() => null);

  return Boolean(response?.ok);
}

export async function POST(req: NextRequest) {
  const pendingUserId = await getVerifiedPendingTwoFactorUserId();
  if (!pendingUserId) {
    return NextResponse.json({ success: false, message: 'Không có phiên 2FA' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '').trim().toLowerCase();
  const code = String(body.code || '').trim();
  const user = await db.users.findUnique({
    where: { id: pendingUserId },
    select: {
      id: true,
      username: true,
      pin: true,
      fa_secret: true,
      fa_enabled: true,
      failed_2fa_attempts: true,
      telegram_id: true,
      telegram_2fa_enabled: true,
      role: true,
      email: true,
      status: true,
    },
  });

  if (!user) {
    return NextResponse.json({ success: false, message: 'Không tìm thấy user' }, { status: 404 });
  }

  if (String(user.status || '').trim().toLowerCase() !== 'active') {
    const response = NextResponse.json(
      {
        success: false,
        code: 'ACCOUNT_BANNED',
        bannedUser: true,
        message: 'Tài khoản đã bị khóa. Vui lòng liên hệ owner để mở khóa.',
      },
      { status: 403 }
    );
    clearTwoFactorPendingCookie(response);
    return response;
  }

  if (action === 'resend' || action === 'resend-pin') {
    const nextPin = String(crypto.randomInt(100000, 999999));
    const sentByTelegram = await sendTelegramCode(
      user.telegram_2fa_enabled ? user.telegram_id : null,
      nextPin
    );

    await db.users.update({
      where: { id: user.id },
      data: {
        pin: nextPin,
        failed_2fa_attempts: 0,
        last_2fa_attempt_at: new Date(),
      },
    }).catch(() => undefined);

    await db.activity_logs.create({
      data: {
        user_id: user.id,
        activity: sentByTelegram
          ? `Gửi lại mã 2FA qua Telegram cho ${user.username}`
          : `Tạo lại mã 2FA cho ${user.username}; chưa có kênh Telegram tự động`,
        ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        user_agent: req.headers.get('user-agent') || null,
      },
    }).catch(() => undefined);

    return NextResponse.json({
      success: true,
      delivered: sentByTelegram,
      message: sentByTelegram
        ? 'Đã gửi lại mã 2FA qua Telegram.'
        : 'Đã tạo lại mã 2FA. Tài khoản chưa bật Telegram 2FA nên vui lòng liên hệ admin/support để nhận mã.',
    });
  }

  const ok = (code.length >= 4 && code === String(user.pin || '').trim()) || verifyTotp(user.fa_secret, code);
  if (!ok) {
    await db.users.update({
      where: { id: user.id },
      data: {
        failed_2fa_attempts: Number(user.failed_2fa_attempts || 0) + 1,
        last_2fa_attempt_at: new Date(),
      },
    }).catch(() => undefined);
    await logOwnerSecurityEvent({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: String(user.role || 'member'),
      },
      req,
      eventType: 'TWO_FACTOR_FAILED',
      layer: '2fa',
      verdict: 'denied',
      riskScore: 60,
      reasons: ['invalid_2fa_code'],
    }).catch(() => undefined);
    return NextResponse.json({ success: false, message: 'Mã 2FA không đúng' }, { status: 401 });
  }

  await db.users.update({
    where: { id: user.id },
    data: { failed_2fa_attempts: 0, last_activity: new Date() },
  }).catch(() => undefined);

  await logOwnerSecurityEvent({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: String(user.role || 'member'),
    },
    req,
    eventType: 'TWO_FACTOR_SUCCESS',
    layer: '2fa',
    verdict: 'allowed',
    riskScore: 0,
    reasons: ['2fa_verified'],
  }).catch(() => undefined);

  const response = NextResponse.json({
    success: true,
    message: 'Xác thực 2FA thành công',
    redirect: isAdminRole(user.role) ? '/admin' : '/user/home',
  });
  clearTwoFactorPendingCookie(response);
  setAuthenticatedSessionCookies(response, user.id, 60 * 60 * 24);
  return response;
}
