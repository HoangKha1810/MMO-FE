import { db } from '@/lib/db';

export interface FindJobRow {
  id: number;
  user_id: number;
  category?: string | null;
  title: string;
  description: string;
  budget_min: number | null;
  budget_max: number | null;
  status: string;
  is_pinned: number | boolean;
  created_at: Date;
  updated_at: Date;
  user_username?: string | null;
  application_count?: number | null;
}

let resolvedFindJobTable: 'find_job_jobs' | 'find_jobs' | null = null;
const ensuredFindJobColumns: Partial<Record<'find_job_jobs' | 'find_jobs', { ok: boolean; hasApprovalStatus: boolean }>> = {};

export async function resolveFindJobTable(): Promise<'find_job_jobs' | 'find_jobs'> {
  if (resolvedFindJobTable) {
    return resolvedFindJobTable;
  }

  try {
    const legacyRows = await db.$queryRawUnsafe<Array<Record<string, string>>>(
      "SHOW TABLES LIKE 'find_job_jobs'"
    );
    resolvedFindJobTable = legacyRows.length > 0 ? 'find_job_jobs' : 'find_jobs';
  } catch {
    resolvedFindJobTable = 'find_jobs';
  }

  return resolvedFindJobTable;
}

export async function ensureFindJobPinColumn(tableName?: 'find_job_jobs' | 'find_jobs') {
  const table = tableName || (await resolveFindJobTable());
  if (ensuredFindJobColumns[table] !== undefined) {
    return ensuredFindJobColumns[table]!.ok;
  }

  try {
    const rows = await db.$queryRawUnsafe<Array<{ Field: string }>>(`SHOW COLUMNS FROM \`${table}\``);
    const columns = new Set(rows.map((row) => row.Field));
    const updates: string[] = [];

    if (!columns.has('is_pinned')) {
      updates.push('ADD COLUMN `is_pinned` TINYINT(1) NOT NULL DEFAULT 0 AFTER `status`');
    }

    if (!columns.has('approval_status')) {
      updates.push("ADD COLUMN `approval_status` VARCHAR(20) NOT NULL DEFAULT 'pending' AFTER `status`");
    }

    if (updates.length) {
      await db.$executeRawUnsafe(`ALTER TABLE \`${table}\` ${updates.join(', ')}`);
    }

    ensuredFindJobColumns[table] = { ok: true, hasApprovalStatus: true };
  } catch {
    ensuredFindJobColumns[table] = { ok: false, hasApprovalStatus: false };
  }

  return ensuredFindJobColumns[table]!.ok;
}

export async function hasFindJobApprovalStatusColumn(tableName?: 'find_job_jobs' | 'find_jobs') {
  const table = tableName || (await resolveFindJobTable());
  if (!ensuredFindJobColumns[table]) {
    await ensureFindJobPinColumn(table);
  }

  return Boolean(ensuredFindJobColumns[table]?.hasApprovalStatus);
}

export async function listOpenFindJobs(limit = 50) {
  const table = await resolveFindJobTable();
  const hasPinColumn = await ensureFindJobPinColumn(table);

  if (table === 'find_job_jobs') {
    return db.$queryRawUnsafe<FindJobRow[]>(
      `
        SELECT
          j.id,
          j.posted_by AS user_id,
          j.category,
          j.title,
          j.description,
          j.price_min AS budget_min,
          j.price_max AS budget_max,
          j.status,
          ${hasPinColumn ? 'j.is_pinned' : '0 AS is_pinned'},
          j.posted_at AS created_at,
          j.updated_at,
          j.application_count,
          u.username AS user_username
        FROM find_job_jobs j
        LEFT JOIN users u ON u.id = j.posted_by
        WHERE j.status = 'open'
          AND COALESCE(j.approval_status, 'pending') = 'approved'
        ORDER BY ${hasPinColumn ? 'j.is_pinned DESC,' : ''} j.posted_at DESC, j.id DESC
        LIMIT ?
      `,
      limit
    );
  }

  return db.$queryRawUnsafe<FindJobRow[]>(
    `
      SELECT ${hasPinColumn ? 'j.*' : 'j.*, 0 AS is_pinned'}, u.username AS user_username
      FROM find_jobs j
      LEFT JOIN users u ON u.id = j.user_id
      WHERE j.status = 'open'
        AND COALESCE(j.approval_status, 'pending') = 'approved'
      ORDER BY ${hasPinColumn ? 'j.is_pinned DESC,' : ''} j.updated_at DESC, j.created_at DESC
      LIMIT ?
    `,
    limit
  );
}

export async function listUserFindJobs(userId: number, limit = 20) {
  const table = await resolveFindJobTable();
  const hasPinColumn = await ensureFindJobPinColumn(table);

  if (table === 'find_job_jobs') {
    return db.$queryRawUnsafe<FindJobRow[]>(
      `
        SELECT
          id,
          posted_by AS user_id,
          category,
          title,
          description,
          price_min AS budget_min,
          price_max AS budget_max,
          status,
          ${hasPinColumn ? 'is_pinned' : '0 AS is_pinned'},
          posted_at AS created_at,
          updated_at,
          application_count
        FROM find_job_jobs
        WHERE posted_by = ?
        ORDER BY ${hasPinColumn ? 'is_pinned DESC,' : ''} posted_at DESC, id DESC
        LIMIT ?
      `,
      userId,
      limit
    );
  }

  return db.$queryRawUnsafe<FindJobRow[]>(
    `
      SELECT ${hasPinColumn ? '*' : '*, 0 AS is_pinned'}
      FROM find_jobs
      WHERE user_id = ?
      ORDER BY ${hasPinColumn ? 'is_pinned DESC,' : ''} created_at DESC
      LIMIT ?
    `,
    userId,
    limit
  );
}
