import 'server-only';

import { db } from '@/lib/db';
import { ensureFindJobPinColumn, resolveFindJobTable } from '@/lib/find-job';

type Row = Record<string, unknown>;
const columnCache = new Map<string, Set<string>>();

async function safeOne<T extends Row>(query: string, ...values: unknown[]) {
  try {
    const rows = await db.$queryRawUnsafe<T[]>(query, ...values);
    return rows[0] || null;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[find-job-actions] query failed', error);
    }
    return null;
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function getTableColumns(table: string) {
  const cached = columnCache.get(table);
  if (cached) return cached;
  const rows = await db.$queryRawUnsafe<Array<{ Field: string }>>(`SHOW COLUMNS FROM \`${table}\``);
  const columns = new Set(rows.map((row) => row.Field));
  columnCache.set(table, columns);
  return columns;
}

async function insertFiltered(table: string, data: Record<string, unknown>) {
  const columns = await getTableColumns(table);
  const fields = Object.keys(data).filter((field) => columns.has(field));
  if (fields.length === 0) {
    throw new Error('Không có field hợp lệ để tạo tin');
  }

  await db.$executeRawUnsafe(
    `INSERT INTO \`${table}\` (${fields.map((field) => `\`${field}\``).join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`,
    ...fields.map((field) => data[field])
  );
}

async function updateFiltered(table: string, id: number, userField: 'posted_by' | 'user_id', userId: number, data: Record<string, unknown>) {
  const columns = await getTableColumns(table);
  const fields = Object.keys(data).filter((field) => columns.has(field));
  if (fields.length === 0) {
    throw new Error('Không có field hợp lệ để cập nhật tin');
  }

  await db.$executeRawUnsafe(
    `UPDATE \`${table}\` SET ${fields.map((field) => `\`${field}\` = ?`).join(', ')} WHERE id = ? AND \`${userField}\` = ?`,
    ...fields.map((field) => data[field]),
    id,
    userId
  );
}

export async function createOrUpdateFindJob(userId: number, input: {
  id?: number;
  title: string;
  description: string;
  category: string;
  priceMin?: number;
  priceMax?: number;
  deadlineDays?: number;
}) {
  const table = await resolveFindJobTable();
  await ensureFindJobPinColumn(table);

  if (input.title.trim().length < 8 || input.description.trim().length < 20) {
    throw new Error('Tiêu đề hoặc mô tả quá ngắn');
  }

  if (!input.id) {
    const openCountRows = await db.$queryRawUnsafe<Array<{ total: number | bigint }>>(
      table === 'find_job_jobs'
        ? 'SELECT COUNT(*) AS total FROM find_job_jobs WHERE posted_by = ? AND status IN (\'open\', \'pending\')'
        : 'SELECT COUNT(*) AS total FROM find_jobs WHERE user_id = ? AND status IN (\'open\', \'pending\')',
      userId
    );
    const openCount = Number(openCountRows[0]?.total || 0);
    if (openCount >= 10) {
      throw new Error('Bạn đã có 10 tin đang mở/chờ duyệt. Hãy đóng bớt trước khi đăng thêm.');
    }
  }

  if (table === 'find_job_jobs') {
    if (input.id) {
      const owned = await safeOne<Row>('SELECT id FROM find_job_jobs WHERE id = ? AND posted_by = ? LIMIT 1', input.id, userId);
      if (!owned) {
        throw new Error('Không tìm thấy tin tuyển dụng để cập nhật');
      }

      await updateFiltered('find_job_jobs', input.id, 'posted_by', userId, {
        title: input.title.trim(),
        description: input.description.trim(),
        category: input.category.trim() || 'general',
        price_min: input.priceMin || null,
        price_max: input.priceMax || null,
        deadline_days: input.deadlineDays || null,
        status: 'pending',
        approval_status: 'pending',
        updated_at: new Date(),
      });

      return { id: input.id };
    }

    const slug = `${slugify(input.title)}-${Date.now()}`;
    const now = new Date();
    await insertFiltered('find_job_jobs', {
      title: input.title.trim(),
      slug,
      description: input.description.trim(),
      category: input.category.trim() || 'general',
      budget_type: 'fixed',
      price_min: input.priceMin || null,
      price_max: input.priceMax || null,
      deadline_days: input.deadlineDays || null,
      posted_by: userId,
      posted_at: now,
      status: 'pending',
      approval_status: 'pending',
      updated_at: now,
    });
  } else {
    if (input.id) {
      const owned = await safeOne<Row>('SELECT id FROM find_jobs WHERE id = ? AND user_id = ? LIMIT 1', input.id, userId);
      if (!owned) {
        throw new Error('Không tìm thấy tin tuyển dụng để cập nhật');
      }

      await updateFiltered('find_jobs', input.id, 'user_id', userId, {
        title: input.title.trim(),
        description: input.description.trim(),
        category: input.category.trim() || 'general',
        budget_min: input.priceMin || null,
        budget_max: input.priceMax || null,
        status: 'pending',
        approval_status: 'pending',
        updated_at: new Date(),
      });

      return { id: input.id };
    }

    const now = new Date();
    await insertFiltered('find_jobs', {
      user_id: userId,
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category.trim() || 'general',
      budget_min: input.priceMin || null,
      budget_max: input.priceMax || null,
      status: 'pending',
      approval_status: 'pending',
      created_at: now,
      updated_at: now,
    });
  }

  const inserted = await db.$queryRawUnsafe<Array<{ id: number | bigint }>>('SELECT LAST_INSERT_ID() AS id');
  return { id: Number(inserted[0]?.id || 0) };
}

export async function deleteFindJob(userId: number, jobId: number) {
  const table = await resolveFindJobTable();

  if (table === 'find_job_jobs') {
    await db.$executeRawUnsafe(
      `
        UPDATE find_job_jobs
        SET status = 'closed', updated_at = NOW()
        WHERE id = ? AND posted_by = ?
      `,
      jobId,
      userId
    );
  } else {
    await db.$executeRawUnsafe(
      `
        UPDATE find_jobs
        SET status = 'closed', updated_at = NOW()
        WHERE id = ? AND user_id = ?
      `,
      jobId,
      userId
    );
  }

  return { success: true };
}

export async function reportFindJob(userId: number, jobId: number, reason: string, note: string) {
  const table = await resolveFindJobTable();
  const owner = await safeOne<Row>(
    table === 'find_job_jobs'
      ? 'SELECT posted_by AS owner_id FROM find_job_jobs WHERE id = ? LIMIT 1'
      : 'SELECT user_id AS owner_id FROM find_jobs WHERE id = ? LIMIT 1',
    jobId
  );

  if (!owner) {
    throw new Error('Không tìm thấy job cần report');
  }

  await db.$executeRawUnsafe(
    `
      INSERT INTO find_job_reports (job_id, reporter_id, reason, note, created_at, admin_processed)
      VALUES (?, ?, ?, ?, NOW(), 0)
    `,
    jobId,
    userId,
    reason.slice(0, 255),
    note.slice(0, 2000)
  );

  return { success: true };
}
