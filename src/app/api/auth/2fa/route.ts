import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { db } from '@/lib/db';

function createSessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge,
    path: '/',
  };
}

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

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const pendingUserId = Number(cookieStore.get('2fa_pending')?.value || 0);
  if (!pendingUserId) {
    return NextResponse.json({ success: false, message: 'Không có phiên 2FA' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const code = String(body.code || '').trim();
  const user = await db.users.findUnique({
    where: { id: pendingUserId },
    select: { id: true, pin: true, fa_secret: true, fa_enabled: true, failed_2fa_attempts: true },
  });

  if (!user) {
    return NextResponse.json({ success: false, message: 'Không tìm thấy user' }, { status: 404 });
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
    return NextResponse.json({ success: false, message: 'Mã 2FA không đúng' }, { status: 401 });
  }

  await db.users.update({
    where: { id: user.id },
    data: { failed_2fa_attempts: 0, last_activity: new Date() },
  }).catch(() => undefined);

  const response = NextResponse.json({ success: true, message: 'Xác thực 2FA thành công' });
  response.cookies.delete('2fa_pending');
  response.cookies.set('user_id', String(user.id), createSessionCookieOptions(60 * 60 * 24));
  return response;
}
