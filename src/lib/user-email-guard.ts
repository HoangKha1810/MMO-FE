import { db } from '@/lib/db';

export function normalizeUserEmail(email: unknown) {
  return String(email || '').trim().toLowerCase();
}

export function isValidUserEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function countUsersByEmail(email: string, exceptUserId?: number) {
  const normalizedEmail = normalizeUserEmail(email);
  if (!normalizedEmail) {
    return 0;
  }

  const rows = await db.$queryRawUnsafe<Array<{ total: number | bigint }>>(
    `
      SELECT COUNT(*) AS total
      FROM users
      WHERE LOWER(TRIM(email)) = ?
        ${exceptUserId ? 'AND id <> ?' : ''}
    `,
    ...(exceptUserId ? [normalizedEmail, exceptUserId] : [normalizedEmail])
  );

  return Number(rows[0]?.total || 0);
}

export async function assertUserEmailAvailable(email: string, exceptUserId?: number) {
  const normalizedEmail = normalizeUserEmail(email);

  if (!isValidUserEmail(normalizedEmail)) {
    throw new Error('Email không hợp lệ');
  }

  const duplicateCount = await countUsersByEmail(normalizedEmail, exceptUserId);
  if (duplicateCount > 0) {
    throw new Error('Email đã được sử dụng bởi tài khoản khác');
  }

  return normalizedEmail;
}

export async function assertUserEmailUniqueForLogin(email: string, userId: number) {
  const normalizedEmail = normalizeUserEmail(email);
  if (!normalizedEmail) {
    return normalizedEmail;
  }

  const duplicateCount = await countUsersByEmail(normalizedEmail, userId);
  if (duplicateCount > 0) {
    throw new Error('Email này đang được gán cho nhiều tài khoản. Vui lòng liên hệ owner/admin để xử lý trước khi đăng nhập.');
  }

  return normalizedEmail;
}
