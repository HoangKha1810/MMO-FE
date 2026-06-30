import 'dotenv/config';

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

function requiredEnv(name: string) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`Thiếu env ${name}`);
  }
  return value;
}

function base32(input: Buffer) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  let output = '';

  for (const byte of input) {
    bits += byte.toString(2).padStart(8, '0');
  }

  for (let index = 0; index < bits.length; index += 5) {
    const chunk = bits.slice(index, index + 5).padEnd(5, '0');
    output += alphabet[Number.parseInt(chunk, 2)];
  }

  return output;
}

async function ensureOwnerRoleEnum() {
  await db.$executeRawUnsafe(
    "ALTER TABLE `users` MODIFY `role` ENUM('owner','member','user','admin','sellermarket','support_tiktok') NULL DEFAULT 'member'"
  );
}

async function main() {
  const username = requiredEnv('OWNER_USERNAME').toLowerCase();
  const email = requiredEnv('OWNER_EMAIL').toLowerCase();
  const password = requiredEnv('OWNER_PASSWORD');

  if (password.length < 16) {
    throw new Error('OWNER_PASSWORD phải có ít nhất 16 ký tự');
  }

  if (!process.env.OWNER_MANUAL_CODE && !process.env.OWNER_SECURITY_CODE) {
    throw new Error('Thiếu OWNER_MANUAL_CODE hoặc OWNER_SECURITY_CODE để bật lớp bảo mật thủ công');
  }

  await ensureOwnerRoleEnum();

  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await db.$queryRawUnsafe<Array<{ id: number }>>(
    'SELECT id FROM `users` WHERE username = ? OR email = ? LIMIT 1',
    username,
    email
  );
  const totpSecret = String(process.env.OWNER_TOTP_SECRET || base32(crypto.randomBytes(20))).replace(/\s+/g, '').toUpperCase();

  if (existing[0]?.id) {
    await db.$executeRawUnsafe(
      `
        UPDATE users
        SET username = ?,
            email = ?,
            password = ?,
            role = 'owner',
            status = 'active',
            rank = 'Owner',
            \`2fa_enabled\` = 1,
            \`2fa_secret\` = ?,
            \`2fa_type\` = 'google',
            email_verified = 1,
            requires_email_setup = 0,
            failed_login_attempts = 0,
            failed_2fa_attempts = 0,
            updated_at = NOW()
        WHERE id = ?
      `,
      username,
      email,
      passwordHash,
      totpSecret,
      existing[0].id
    );
  } else {
    await db.$executeRawUnsafe(
      `
        INSERT INTO users
          (username, email, password, fullname, role, status, rank, balance, game_balance, \`2fa_enabled\`, \`2fa_secret\`, \`2fa_type\`, email_verified, requires_email_setup, created_at, updated_at)
        VALUES
          (?, ?, ?, ?, 'owner', 'active', 'Owner', 0, 0, 1, ?, 'google', 1, 0, NOW(), NOW())
      `,
      username,
      email,
      passwordHash,
      'Owner',
      totpSecret
    );
  }

  const issuer = encodeURIComponent(process.env.NEXT_PUBLIC_SITE_NAME || 'TRUNGTAMMMO');
  const label = encodeURIComponent(`${process.env.NEXT_PUBLIC_SITE_NAME || 'TRUNGTAMMMO'}:${username}`);
  const otpauthUrl = `otpauth://totp/${label}?secret=${totpSecret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;

  console.log('Owner account is ready.');
  console.log(`username: ${username}`);
  console.log(`email: ${email}`);
  console.log(`totp_secret: ${totpSecret}`);
  console.log(`otpauth_url: ${otpauthUrl}`);
  console.log('Luu y: luu secret nay vao password manager, khong commit len git.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
