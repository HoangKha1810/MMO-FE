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
  user_is_blue_tick?: number | boolean | null;
  user_blue_tick_expiry?: Date | string | null;
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

function findJobPublicWhereSql(alias = 'j', hasApprovalStatus = true) {
  const prefix = alias ? `${alias}.` : '';
  const approvalCondition = hasApprovalStatus
    ? `COALESCE(${prefix}approval_status, 'pending') = 'approved' OR ${prefix}status = 'approved'`
    : `${prefix}status IN ('open', 'approved')`;

  return `
    (${approvalCondition})
    AND ${prefix}status NOT IN ('closed', 'filled', 'rejected', 'deleted')
  `;
}

export async function countOpenFindJobs() {
  const table = await resolveFindJobTable();
  await ensureFindJobPinColumn(table);
  const hasApprovalStatus = await hasFindJobApprovalStatusColumn(table);

  const rows = await db.$queryRawUnsafe<Array<{ total: bigint | number }>>(
    `
      SELECT COUNT(*) AS total
      FROM \`${table}\` j
      WHERE ${findJobPublicWhereSql('j', hasApprovalStatus)}
    `
  );

  return Number(rows[0]?.total || 0);
}

export async function listOpenFindJobs(limit = 20, offset = 0) {
  const table = await resolveFindJobTable();
  const hasPinColumn = await ensureFindJobPinColumn(table);
  const hasApprovalStatus = await hasFindJobApprovalStatusColumn(table);
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 100));
  const safeOffset = Math.max(0, Math.trunc(offset));

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
          u.username AS user_username,
          u.is_blue_tick AS user_is_blue_tick,
          u.blue_tick_expiry AS user_blue_tick_expiry
        FROM find_job_jobs j
        LEFT JOIN users u ON u.id = j.posted_by
        WHERE ${findJobPublicWhereSql('j', hasApprovalStatus)}
        ORDER BY ${hasPinColumn ? 'j.is_pinned DESC,' : ''} j.posted_at DESC, j.id DESC
        LIMIT ? OFFSET ?
      `,
      safeLimit,
      safeOffset
    );
  }

  return db.$queryRawUnsafe<FindJobRow[]>(
    `
      SELECT
        ${hasPinColumn ? 'j.*' : 'j.*, 0 AS is_pinned'},
        u.username AS user_username,
        u.is_blue_tick AS user_is_blue_tick,
        u.blue_tick_expiry AS user_blue_tick_expiry
      FROM find_jobs j
      LEFT JOIN users u ON u.id = j.user_id
      WHERE ${findJobPublicWhereSql('j', hasApprovalStatus)}
      ORDER BY ${hasPinColumn ? 'j.is_pinned DESC,' : ''} j.updated_at DESC, j.created_at DESC
      LIMIT ? OFFSET ?
    `,
    safeLimit,
    safeOffset
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
