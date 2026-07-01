import 'dotenv/config';

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const username = process.env.SUPPORT_TIKTOK_USERNAME || 'support_tiktok';
const email = process.env.SUPPORT_TIKTOK_EMAIL || 'support_tiktok@trungtammmo.vn';
const passwordFromEnv = process.env.SUPPORT_TIKTOK_PASSWORD;
const rotatePassword = process.env.SUPPORT_TIKTOK_ROTATE_PASSWORD === '1';

async function main() {
  const existing = await db.users.findFirst({
    where: {
      OR: [
        { username },
        { email },
      ],
    },
    select: { id: true },
  });

  const generatedPassword = !passwordFromEnv && (!existing || rotatePassword);
  const password = passwordFromEnv || (generatedPassword ? `SupportTikTok@${crypto.randomBytes(12).toString('base64url')}!` : '');
  const passwordHash = password ? await bcrypt.hash(password, 10) : '';

  const data = {
    username,
    email,
    fullname: 'Support TikTok',
    role: 'support_tiktok' as const,
    status: 'active' as const,
    rank: 'Support TikTok',
    email_verified: true,
    requires_email_setup: false,
    failed_login_attempts: 0,
    failed_2fa_attempts: 0,
    is_shadow_banned: false,
  };

  const user = existing
    ? await db.users.update({
        where: { id: existing.id },
        data: {
          ...data,
          ...(passwordHash ? { password: passwordHash } : {}),
        },
        select: { id: true, username: true, email: true, role: true, status: true },
      })
    : await db.users.create({
        data: {
          ...data,
          password: passwordHash,
          balance: 0,
          game_balance: 0,
        },
        select: { id: true, username: true, email: true, role: true, status: true },
      });

  console.log(JSON.stringify({
    user,
    temporaryPassword: password || null,
    generatedPassword,
    passwordChanged: Boolean(passwordHash),
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
