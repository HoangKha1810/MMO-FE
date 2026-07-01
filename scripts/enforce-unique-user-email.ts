import 'dotenv/config';

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

type DuplicateEmailRow = {
  email: string | null;
  total: number | bigint;
  user_ids: string | null;
  usernames: string | null;
};

async function main() {
  const duplicates = await db.$queryRawUnsafe<DuplicateEmailRow[]>(`
    SELECT
      LOWER(TRIM(email)) AS email,
      COUNT(*) AS total,
      GROUP_CONCAT(id ORDER BY id ASC SEPARATOR ',') AS user_ids,
      GROUP_CONCAT(username ORDER BY id ASC SEPARATOR ', ') AS usernames
    FROM users
    WHERE email IS NOT NULL AND TRIM(email) <> ''
    GROUP BY LOWER(TRIM(email))
    HAVING COUNT(*) > 1
    ORDER BY total DESC, email ASC
  `);

  if (duplicates.length > 0) {
    console.error('Không thể thêm unique index vì còn email trùng:');
    for (const row of duplicates) {
      console.error(`- ${row.email}: ${String(row.total)} accounts | ids=${row.user_ids || ''} | users=${row.usernames || ''}`);
    }
    console.error('');
    console.error('Hãy đổi email hoặc khóa/xóa các account bị trùng rồi chạy lại lệnh này.');
    process.exitCode = 1;
    return;
  }

  await db.$executeRawUnsafe(`
    UPDATE users
    SET email = LOWER(TRIM(email))
    WHERE email IS NOT NULL
  `);

  const indexes = await db.$queryRawUnsafe<Array<{ Key_name: string }>>(
    "SHOW INDEX FROM `users` WHERE Column_name = 'email' AND Non_unique = 0"
  );

  if (indexes.length > 0) {
    console.log('Unique index cho users.email đã tồn tại.');
    return;
  }

  await db.$executeRawUnsafe('ALTER TABLE `users` ADD UNIQUE KEY `email` (`email`)');
  console.log('Đã thêm unique index cho users.email.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
