import 'dotenv/config';

import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

const username = process.env.SUPPORT_TIKTOK_USERNAME || 'support_tiktok';
const email = process.env.SUPPORT_TIKTOK_EMAIL || 'support_tiktok@trungtammmo.vn';
const password = process.env.SUPPORT_TIKTOK_PASSWORD || 'SupportTikTok@2026';

async function main() {
  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await db.users.findFirst({
    where: {
      OR: [
        { username },
        { email },
      ],
    },
    select: { id: true },
  });

  const data = {
    username,
    email,
    password: passwordHash,
    fullname: 'Support TikTok',
    role: 'support_tiktok' as const,
    status: 'active' as const,
    rank: 'Support TikTok',
    email_verified: true,
  };

  const user = existing
    ? await db.users.update({
        where: { id: existing.id },
        data,
        select: { id: true, username: true, email: true, role: true, status: true },
      })
    : await db.users.create({
        data: {
          ...data,
          balance: 0,
          game_balance: 0,
        },
        select: { id: true, username: true, email: true, role: true, status: true },
      });

  console.log(JSON.stringify({ user, temporaryPassword: password }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
