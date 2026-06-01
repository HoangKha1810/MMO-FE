import 'server-only';

import { db } from '@/lib/db';
import { sendSystemEmail } from '@/lib/admin-alert-email';
import { toNumber } from '@/lib/utils';
import { VastApiError, vastRequest } from '@/lib/vast-ai';

const VPS_GPU_INSTANCES_TABLE = 'vps_gpu_instances';
const ACTIVE_STATUSES = ['active', 'creating', 'running', 'deletion_pending'];
const ONE_HOUR_MS = 60 * 60 * 1000;
const LOW_BALANCE_WARNING_MS = 15 * 60 * 1000;

export interface VpsGpuBillingRow extends Record<string, unknown> {
  id: number;
  user_id: number;
  provider_instance_id: string;
  offer_id: string;
  instance_name: string | null;
  status: string;
  provider_status: string | null;
  cost_hourly_usd: number;
  cost_hourly_vnd: number;
  sale_hourly_vnd: number;
  total_charged_vnd: number;
  started_at: Date | null;
  started_at_ms: number | null;
  next_charge_at: Date | null;
  next_charge_at_ms: number | null;
  last_charged_at: Date | null;
  last_charged_at_ms: number | null;
  low_balance_warning_for_at: Date | null;
  low_balance_warning_for_at_ms: number | null;
  ended_at: Date | null;
  ended_at_ms: number | null;
  end_reason: string | null;
}

interface CreateBillingInput {
  userId: number;
  providerInstanceId: string;
  offerId: string;
  instanceName: string;
  costHourlyUsd: number;
  costHourlyVnd: number;
  saleHourlyVnd: number;
}

interface BillingSnapshot {
  id: number;
  providerInstanceId: string;
  saleHourlyVnd: number;
  totalChargedVnd: number;
  nextChargeAt: string | null;
  nextChargeAtMs: number | null;
  lowBalanceWarningForAt: string | null;
  lowBalanceWarningForAtMs: number | null;
  status: string;
}

function normalizeValue(value: unknown) {
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && 'toNumber' in value && typeof value.toNumber === 'function') {
    return value.toNumber();
  }
  return value;
}

function normalizeRow<T extends Record<string, unknown>>(row: T): T {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, normalizeValue(value)])
  ) as T;
}

function toDate(value: unknown) {
  if (value instanceof Date) return value;
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toTimestampMs(value: unknown) {
  const normalized = normalizeValue(value);
  if (normalized instanceof Date) {
    return normalized.getTime();
  }

  const timestampMs = Number(normalized);
  return Number.isFinite(timestampMs) && timestampMs > 0 ? Math.trunc(timestampMs) : null;
}

function addMilliseconds(date: Date, milliseconds: number) {
  return new Date(date.getTime() + milliseconds);
}

function dateIsoFromTimestampMs(timestampMs: number | null) {
  return timestampMs ? new Date(timestampMs).toISOString() : null;
}

function timestampMsFromDateFallback(timestampMs: unknown, date: Date | null) {
  return toTimestampMs(timestampMs) ?? (date ? date.getTime() : null);
}

function formatVnd(value: number) {
  return `${Math.max(0, Math.ceil(value)).toLocaleString('vi-VN')}đ`;
}

function formatDateTimeForMail(value: Date) {
  return value.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function appBaseUrl() {
  return String(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://trungtammmo.vn')
    .trim()
    .replace(/\/+$/, '') || 'https://trungtammmo.vn';
}

function isValidEmail(value: unknown) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? '').trim());
}

function insufficientGameWalletMessage(missingAmount: number) {
  return `Ví game không đủ. Vui lòng nạp thêm ${formatVnd(missingAmount)} để thuê VPS GPU.`;
}

function activeStatusListSql() {
  return ACTIVE_STATUSES.map((status) => `'${status}'`).join(', ');
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function toArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value as Record<string, unknown>[] : [];
}

function getProviderInstanceId(instance: Record<string, unknown>) {
  return String(instance.id || instance.instance_id || instance.contract_id || '').trim();
}

async function listProviderInstanceIds() {
  try {
    const payload = await vastRequest<unknown>('/instances/', undefined, { version: 'v1' });
    const data = asRecord(payload);
    const instances = toArray(data.instances || data.results || data.data || payload);
    return {
      ok: true,
      ids: new Set(instances.map(getProviderInstanceId).filter(Boolean)),
      error: '',
    };
  } catch (error) {
    return {
      ok: false,
      ids: new Set<string>(),
      error: error instanceof Error ? error.message : 'Không tải được danh sách VPS GPU nguồn',
    };
  }
}

export async function ensureVpsGpuInstancesTable() {
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`${VPS_GPU_INSTANCES_TABLE}\` (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT NOT NULL,
      provider_instance_id VARCHAR(80) NOT NULL,
      offer_id VARCHAR(80) NOT NULL,
      instance_name VARCHAR(255) NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'active',
      provider_status VARCHAR(80) NULL,
      cost_hourly_usd DECIMAL(14,6) NOT NULL DEFAULT 0,
      cost_hourly_vnd DECIMAL(15,2) NOT NULL DEFAULT 0,
      sale_hourly_vnd DECIMAL(15,2) NOT NULL DEFAULT 0,
      total_charged_vnd DECIMAL(15,2) NOT NULL DEFAULT 0,
      started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      started_at_ms BIGINT NULL,
      next_charge_at DATETIME NOT NULL,
      next_charge_at_ms BIGINT NULL,
      last_charged_at DATETIME NULL,
      last_charged_at_ms BIGINT NULL,
      low_balance_warning_for_at DATETIME NULL,
      low_balance_warning_for_at_ms BIGINT NULL,
      ended_at DATETIME NULL,
      ended_at_ms BIGINT NULL,
      end_reason VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_vps_gpu_provider_instance (provider_instance_id),
      KEY idx_vps_gpu_user_status (user_id, status),
      KEY idx_vps_gpu_next_charge (status, next_charge_at),
      KEY idx_vps_gpu_next_charge_ms (status, next_charge_at_ms)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.$executeRawUnsafe(`
    ALTER TABLE \`${VPS_GPU_INSTANCES_TABLE}\`
      ADD COLUMN IF NOT EXISTS low_balance_warning_for_at DATETIME NULL AFTER last_charged_at
  `).catch(() => 0);

  await db.$executeRawUnsafe(`
    ALTER TABLE \`${VPS_GPU_INSTANCES_TABLE}\`
      ADD COLUMN IF NOT EXISTS started_at_ms BIGINT NULL AFTER started_at
  `).catch(() => 0);

  await db.$executeRawUnsafe(`
    ALTER TABLE \`${VPS_GPU_INSTANCES_TABLE}\`
      ADD COLUMN IF NOT EXISTS next_charge_at_ms BIGINT NULL AFTER next_charge_at
  `).catch(() => 0);

  await db.$executeRawUnsafe(`
    ALTER TABLE \`${VPS_GPU_INSTANCES_TABLE}\`
      ADD COLUMN IF NOT EXISTS last_charged_at_ms BIGINT NULL AFTER last_charged_at
  `).catch(() => 0);

  await db.$executeRawUnsafe(`
    ALTER TABLE \`${VPS_GPU_INSTANCES_TABLE}\`
      ADD COLUMN IF NOT EXISTS low_balance_warning_for_at_ms BIGINT NULL AFTER low_balance_warning_for_at
  `).catch(() => 0);

  await db.$executeRawUnsafe(`
    ALTER TABLE \`${VPS_GPU_INSTANCES_TABLE}\`
      ADD COLUMN IF NOT EXISTS ended_at_ms BIGINT NULL AFTER ended_at
  `).catch(() => 0);

  await db.$executeRawUnsafe(`
    ALTER TABLE \`${VPS_GPU_INSTANCES_TABLE}\`
      ADD KEY IF NOT EXISTS idx_vps_gpu_next_charge_ms (status, next_charge_at_ms)
  `).catch(() => 0);
}

export function extractCreatedProviderInstanceId(response: unknown) {
  const record = response && typeof response === 'object' ? response as Record<string, unknown> : {};
  return String(
    record.new_contract ||
    record.instance_id ||
    record.contract_id ||
    record.id ||
    ''
  ).trim();
}

export async function assertGameWalletCanPay(userId: number, amount: number) {
  const normalizedAmount = Math.max(0, Math.ceil(amount));
  if (normalizedAmount <= 0) {
    throw new Error('Giá thuê VPS GPU chưa hợp lệ. Hãy chọn lại gói GPU.');
  }

  const user = await db.users.findUnique({
    where: { id: userId },
    select: { game_balance: true },
  });
  if (!user) {
    throw new Error('Không tìm thấy người dùng');
  }

  const currentGameBalance = toNumber(user.game_balance, 0);
  if (currentGameBalance < normalizedAmount) {
    throw new Error(insufficientGameWalletMessage(normalizedAmount - currentGameBalance));
  }

  return currentGameBalance;
}

export async function chargeFirstHourAndSaveVpsGpu(input: CreateBillingInput) {
  await ensureVpsGpuInstancesTable();

  const saleHourlyVnd = Math.max(0, Math.ceil(input.saleHourlyVnd));
  if (saleHourlyVnd <= 0) {
    throw new Error('Giá thuê VPS GPU chưa hợp lệ. Hãy chọn lại gói GPU.');
  }

  return db.$transaction(async (tx) => {
    const user = await tx.users.findUnique({
      where: { id: input.userId },
      select: { game_balance: true },
    });
    if (!user) {
      throw new Error('Không tìm thấy người dùng');
    }

    const currentGameBalance = toNumber(user.game_balance, 0);
    const nextGameBalance = currentGameBalance - saleHourlyVnd;
    if (nextGameBalance < 0) {
      throw new Error(insufficientGameWalletMessage(Math.abs(nextGameBalance)));
    }

    const chargedAt = new Date();
    const nextChargeAt = addMilliseconds(chargedAt, ONE_HOUR_MS);

    await tx.users.update({
      where: { id: input.userId },
      data: { game_balance: nextGameBalance, last_activity: new Date() },
    });

    await tx.transactions.create({
      data: {
        user_id: input.userId,
        amount: saleHourlyVnd,
        balance_after: nextGameBalance,
        wallet_type: 'game',
        type: 'order',
        status: 'success',
        content: `Thuê VPS GPU #${input.providerInstanceId}: giờ đầu tiên bằng ví game`,
      },
    }).catch(() => undefined);

    await tx.$executeRawUnsafe(
      `
        INSERT INTO \`${VPS_GPU_INSTANCES_TABLE}\` (
          user_id, provider_instance_id, offer_id, instance_name, status,
          cost_hourly_usd, cost_hourly_vnd, sale_hourly_vnd, total_charged_vnd,
          started_at, started_at_ms, next_charge_at, next_charge_at_ms, last_charged_at, last_charged_at_ms
        )
        VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      input.userId,
      input.providerInstanceId,
      input.offerId,
      input.instanceName,
      Math.max(0, input.costHourlyUsd),
      Math.max(0, Math.ceil(input.costHourlyVnd)),
      saleHourlyVnd,
      saleHourlyVnd,
      chargedAt,
      chargedAt.getTime(),
      nextChargeAt,
      nextChargeAt.getTime(),
      chargedAt,
      chargedAt.getTime()
    );

    const rows = await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `
        SELECT *
        FROM \`${VPS_GPU_INSTANCES_TABLE}\`
        WHERE provider_instance_id = ?
        LIMIT 1
      `,
      input.providerInstanceId
    );

    return {
      gameBalance: nextGameBalance,
      billing: toPublicBilling(rows[0] ? normalizeBillingRow(rows[0]) : null),
    };
  }, { maxWait: 10000, timeout: 15000 });
}

export function normalizeBillingRow(row: Record<string, unknown>): VpsGpuBillingRow {
  const normalized = normalizeRow(row);
  const startedAt = toDate(normalized.started_at);
  const nextChargeAt = toDate(normalized.next_charge_at);
  const lastChargedAt = toDate(normalized.last_charged_at);
  const lowBalanceWarningForAt = toDate(normalized.low_balance_warning_for_at);
  const endedAt = toDate(normalized.ended_at);

  return {
    ...normalized,
    id: Math.trunc(toNumber(normalized.id, 0)),
    user_id: Math.trunc(toNumber(normalized.user_id, 0)),
    provider_instance_id: String(normalized.provider_instance_id || ''),
    offer_id: String(normalized.offer_id || ''),
    instance_name: normalized.instance_name ? String(normalized.instance_name) : null,
    status: String(normalized.status || 'active'),
    provider_status: normalized.provider_status ? String(normalized.provider_status) : null,
    cost_hourly_usd: toNumber(normalized.cost_hourly_usd, 0),
    cost_hourly_vnd: toNumber(normalized.cost_hourly_vnd, 0),
    sale_hourly_vnd: toNumber(normalized.sale_hourly_vnd, 0),
    total_charged_vnd: toNumber(normalized.total_charged_vnd, 0),
    started_at: startedAt,
    started_at_ms: timestampMsFromDateFallback(normalized.started_at_ms, startedAt),
    next_charge_at: nextChargeAt,
    next_charge_at_ms: timestampMsFromDateFallback(normalized.next_charge_at_ms, nextChargeAt),
    last_charged_at: lastChargedAt,
    last_charged_at_ms: timestampMsFromDateFallback(normalized.last_charged_at_ms, lastChargedAt),
    low_balance_warning_for_at: lowBalanceWarningForAt,
    low_balance_warning_for_at_ms: timestampMsFromDateFallback(normalized.low_balance_warning_for_at_ms, lowBalanceWarningForAt),
    ended_at: endedAt,
    ended_at_ms: timestampMsFromDateFallback(normalized.ended_at_ms, endedAt),
    end_reason: normalized.end_reason ? String(normalized.end_reason) : null,
  };
}

export function toPublicBilling(row: VpsGpuBillingRow | null): BillingSnapshot | null {
  if (!row) return null;
  return {
    id: row.id,
    providerInstanceId: row.provider_instance_id,
    saleHourlyVnd: Math.max(0, Math.ceil(row.sale_hourly_vnd)),
    totalChargedVnd: Math.max(0, Math.ceil(row.total_charged_vnd)),
    nextChargeAt: dateIsoFromTimestampMs(row.next_charge_at_ms),
    nextChargeAtMs: row.next_charge_at_ms,
    lowBalanceWarningForAt: dateIsoFromTimestampMs(row.low_balance_warning_for_at_ms),
    lowBalanceWarningForAtMs: row.low_balance_warning_for_at_ms,
    status: row.status,
  };
}

export async function listOwnedVpsGpuBillings(userId: number, options: { includeEnded?: boolean } = {}) {
  await ensureVpsGpuInstancesTable();

  const whereStatus = options.includeEnded ? '' : `AND status IN (${activeStatusListSql()})`;
  const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT *
      FROM \`${VPS_GPU_INSTANCES_TABLE}\`
      WHERE user_id = ?
        ${whereStatus}
      ORDER BY created_at DESC, id DESC
    `,
    userId
  );

  return rows.map(normalizeBillingRow);
}

export async function getOwnedVpsGpuBilling(userId: number, providerInstanceId: string) {
  await ensureVpsGpuInstancesTable();

  const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT *
      FROM \`${VPS_GPU_INSTANCES_TABLE}\`
      WHERE user_id = ?
        AND provider_instance_id = ?
      LIMIT 1
    `,
    userId,
    providerInstanceId
  );

  return rows[0] ? normalizeBillingRow(rows[0]) : null;
}

export async function requireOwnedVpsGpuBilling(userId: number, providerInstanceId: string) {
  const row = await getOwnedVpsGpuBilling(userId, providerInstanceId);
  if (!row || !ACTIVE_STATUSES.includes(row.status)) {
    throw new Error('Bạn không có quyền thao tác VPS GPU này hoặc instance đã kết thúc.');
  }
  return row;
}

export async function markVpsGpuProviderStatus(providerInstanceId: string, providerStatus: string) {
  await ensureVpsGpuInstancesTable();
  await db.$executeRawUnsafe(
    `
      UPDATE \`${VPS_GPU_INSTANCES_TABLE}\`
      SET provider_status = ?,
          status = CASE
            WHEN status = 'deletion_pending' THEN status
            WHEN LOWER(?) LIKE '%running%' THEN 'running'
            ELSE status
          END,
          updated_at = NOW()
      WHERE provider_instance_id = ?
        AND status IN (${activeStatusListSql()})
    `,
    providerStatus,
    providerStatus,
    providerInstanceId
  ).catch(() => 0);
}

export async function markVpsGpuEnded(providerInstanceId: string, reason: string) {
  await ensureVpsGpuInstancesTable();
  const endedAt = new Date();
  await db.$executeRawUnsafe(
    `
      UPDATE \`${VPS_GPU_INSTANCES_TABLE}\`
      SET status = 'ended',
          ended_at = COALESCE(ended_at, ?),
          ended_at_ms = COALESCE(ended_at_ms, ?),
          end_reason = ?,
          updated_at = NOW()
      WHERE provider_instance_id = ?
    `,
    endedAt,
    endedAt.getTime(),
    reason,
    providerInstanceId
  );
}

async function deleteProviderInstance(providerInstanceId: string) {
  try {
    await vastRequest(`/instances/${encodeURIComponent(providerInstanceId)}/`, { method: 'DELETE' });
    return { ok: true, missing: false, error: '' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'delete failed';
    const status = error instanceof VastApiError ? error.status : 0;
    if (status === 404 || /404|not found|no_such|not available/i.test(message)) {
      return { ok: true, missing: true, error: message };
    }
    return { ok: false, missing: false, error: message };
  }
}

export async function deleteOwnedVpsGpuInstance(userId: number, providerInstanceId: string, reason = 'user_deleted') {
  await requireOwnedVpsGpuBilling(userId, providerInstanceId);
  const result = await deleteProviderInstance(providerInstanceId);
  if (!result.ok) {
    throw new Error(result.error || 'Không thể xóa VPS GPU từ nguồn GPU');
  }

  await markVpsGpuEnded(providerInstanceId, reason);
  return result;
}

async function chargeDueBillingRow(rowId: number) {
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `
        SELECT *
        FROM \`${VPS_GPU_INSTANCES_TABLE}\`
        WHERE id = ?
        LIMIT 1
        FOR UPDATE
      `,
      rowId
    );
    const row = rows[0] ? normalizeBillingRow(rows[0]) : null;
    if (!row || !ACTIVE_STATUSES.includes(row.status)) {
      return { charged: 0, chargedHours: 0, deleteNeeded: false, providerInstanceId: '' };
    }

    if (row.status === 'deletion_pending') {
      return { charged: 0, chargedHours: 0, deleteNeeded: true, providerInstanceId: row.provider_instance_id };
    }

    const nextChargeAtMs = row.next_charge_at_ms;
    if (!nextChargeAtMs || nextChargeAtMs > Date.now()) {
      return { charged: 0, chargedHours: 0, deleteNeeded: false, providerInstanceId: row.provider_instance_id };
    }

    const saleHourlyVnd = Math.max(0, Math.ceil(row.sale_hourly_vnd));
    if (saleHourlyVnd <= 0) {
      await tx.$executeRawUnsafe(
        `
          UPDATE \`${VPS_GPU_INSTANCES_TABLE}\`
          SET status = 'deletion_pending',
              end_reason = 'invalid_hourly_price',
              updated_at = NOW()
          WHERE id = ?
        `,
        row.id
      );
      return { charged: 0, chargedHours: 0, deleteNeeded: true, providerInstanceId: row.provider_instance_id };
    }

    const hoursDue = Math.min(168, Math.max(1, Math.floor((Date.now() - nextChargeAtMs) / ONE_HOUR_MS) + 1));
    const user = await tx.users.findUnique({
      where: { id: row.user_id },
      select: { game_balance: true },
    });
    const currentGameBalance = toNumber(user?.game_balance, 0);
    const chargeableHours = Math.min(hoursDue, Math.floor(currentGameBalance / saleHourlyVnd));
    const chargedAmount = chargeableHours * saleHourlyVnd;
    const nextGameBalance = currentGameBalance - chargedAmount;

    if (chargeableHours > 0) {
      const chargedAt = new Date();
      const nextChargeAtAfterChargeMs = nextChargeAtMs + chargeableHours * ONE_HOUR_MS;
      const nextChargeAtAfterCharge = new Date(nextChargeAtAfterChargeMs);

      await tx.users.update({
        where: { id: row.user_id },
        data: { game_balance: nextGameBalance, last_activity: chargedAt },
      });

      await tx.transactions.create({
        data: {
          user_id: row.user_id,
          amount: chargedAmount,
          balance_after: nextGameBalance,
          wallet_type: 'game',
          type: 'order',
          status: 'success',
          content: `Thuê VPS GPU #${row.provider_instance_id}: ${chargeableHours} giờ tiếp theo bằng ví game`,
        },
      }).catch(() => undefined);

      await tx.$executeRawUnsafe(
        `
          UPDATE \`${VPS_GPU_INSTANCES_TABLE}\`
          SET total_charged_vnd = total_charged_vnd + ?,
              last_charged_at = ?,
              last_charged_at_ms = ?,
              next_charge_at = ?,
              next_charge_at_ms = ?,
              low_balance_warning_for_at = NULL,
              low_balance_warning_for_at_ms = NULL,
              updated_at = NOW()
          WHERE id = ?
        `,
        chargedAmount,
        chargedAt,
        chargedAt.getTime(),
        nextChargeAtAfterCharge,
        nextChargeAtAfterChargeMs,
        row.id
      );
    }

    const deleteNeeded = chargeableHours < hoursDue;
    if (deleteNeeded) {
      await tx.$executeRawUnsafe(
        `
          UPDATE \`${VPS_GPU_INSTANCES_TABLE}\`
          SET status = 'deletion_pending',
              end_reason = 'insufficient_game_balance',
              updated_at = NOW()
          WHERE id = ?
        `,
        row.id
      );
    }

    return {
      charged: chargedAmount,
      chargedHours: chargeableHours,
      deleteNeeded,
      providerInstanceId: row.provider_instance_id,
    };
  }, { maxWait: 10000, timeout: 15000 });
}

async function reserveLowBalanceWarning(rowId: number) {
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `
        SELECT *
        FROM \`${VPS_GPU_INSTANCES_TABLE}\`
        WHERE id = ?
        LIMIT 1
        FOR UPDATE
      `,
      rowId
    );
    const row = rows[0] ? normalizeBillingRow(rows[0]) : null;
    if (!row || !ACTIVE_STATUSES.includes(row.status) || row.status === 'deletion_pending') {
      return null;
    }

    const nextChargeAtMs = row.next_charge_at_ms;
    if (!nextChargeAtMs) {
      return null;
    }

    const now = Date.now();
    const remainingMs = nextChargeAtMs - now;
    if (remainingMs <= 0 || remainingMs > LOW_BALANCE_WARNING_MS) {
      return null;
    }

    if (
      row.low_balance_warning_for_at_ms &&
      row.low_balance_warning_for_at_ms === nextChargeAtMs
    ) {
      return null;
    }

    const saleHourlyVnd = Math.max(0, Math.ceil(row.sale_hourly_vnd));
    if (saleHourlyVnd <= 0) {
      return null;
    }

    const user = await tx.users.findUnique({
      where: { id: row.user_id },
      select: { email: true, username: true, fullname: true, game_balance: true },
    });
    if (!user?.email || !isValidEmail(user.email)) {
      return null;
    }

    const gameBalance = toNumber(user.game_balance, 0);
    if (gameBalance >= saleHourlyVnd) {
      return null;
    }

    const nextChargeAt = new Date(nextChargeAtMs);

    await tx.$executeRawUnsafe(
      `
        UPDATE \`${VPS_GPU_INSTANCES_TABLE}\`
        SET low_balance_warning_for_at = ?,
            low_balance_warning_for_at_ms = ?,
            updated_at = NOW()
        WHERE id = ?
      `,
      nextChargeAt,
      nextChargeAtMs,
      row.id
    );

    return {
      rowId: row.id,
      providerInstanceId: row.provider_instance_id,
      instanceName: row.instance_name || `VPS GPU ${row.provider_instance_id}`,
      email: user.email,
      displayName: user.fullname || user.username || 'khách hàng',
      saleHourlyVnd,
      gameBalance,
      missingAmount: Math.max(0, saleHourlyVnd - gameBalance),
      nextChargeAt,
    };
  }, { maxWait: 10000, timeout: 15000 });
}

async function sendLowBalanceWarning(rowId: number) {
  const notice = await reserveLowBalanceWarning(rowId);
  if (!notice) {
    return { sent: false, skipped: true, error: '' };
  }

  const depositUrl = `${appBaseUrl()}/user/deposit`;
  const expiryText = formatDateTimeForMail(notice.nextChargeAt);
  const subject = 'VPS GPU sắp đến hạn gia hạn, ví game chưa đủ tiền';
  const text = [
    `Xin chào ${notice.displayName},`,
    '',
    `VPS GPU ${notice.instanceName} (#${notice.providerInstanceId}) sẽ gia hạn lúc ${expiryText}.`,
    `Giá thuê giờ tiếp theo: ${formatVnd(notice.saleHourlyVnd)}.`,
    `Ví game hiện tại: ${formatVnd(notice.gameBalance)}.`,
    `Cần nạp thêm tối thiểu: ${formatVnd(notice.missingAmount)}.`,
    '',
    'Nếu sau thời điểm trên ví game vẫn chưa đủ, hệ thống sẽ tự động xóa VPS để tránh phát sinh chi phí nguồn GPU.',
    `Nạp ví tại: ${depositUrl}`,
  ].join('\n');

  try {
    const result = await sendSystemEmail({
      to: [notice.email],
      subject,
      text,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#0f172a">
          <h2 style="margin:0 0 12px">VPS GPU sắp đến hạn gia hạn</h2>
          <p>Xin chào <strong>${escapeHtml(notice.displayName)}</strong>,</p>
          <p>VPS GPU <strong>${escapeHtml(notice.instanceName)}</strong> (#${escapeHtml(notice.providerInstanceId)}) sẽ gia hạn lúc <strong>${escapeHtml(expiryText)}</strong>.</p>
          <ul>
            <li>Giá thuê giờ tiếp theo: <strong>${escapeHtml(formatVnd(notice.saleHourlyVnd))}</strong></li>
            <li>Ví game hiện tại: <strong>${escapeHtml(formatVnd(notice.gameBalance))}</strong></li>
            <li>Cần nạp thêm tối thiểu: <strong>${escapeHtml(formatVnd(notice.missingAmount))}</strong></li>
          </ul>
          <p>Nếu sau thời điểm trên ví game vẫn chưa đủ, hệ thống sẽ tự động xóa VPS để tránh phát sinh chi phí nguồn GPU.</p>
          <p><a href="${escapeHtml(depositUrl)}" style="display:inline-block;background:#2563eb;color:white;text-decoration:none;padding:10px 16px;border-radius:10px">Nạp ví game</a></p>
        </div>
      `,
    });

    if (!result.sent) {
      await db.$executeRawUnsafe(
        `
          UPDATE \`${VPS_GPU_INSTANCES_TABLE}\`
          SET low_balance_warning_for_at = NULL,
              low_balance_warning_for_at_ms = NULL,
              updated_at = NOW()
          WHERE id = ?
            AND low_balance_warning_for_at_ms = ?
        `,
        notice.rowId,
        notice.nextChargeAt.getTime()
      ).catch(() => 0);
      return { sent: false, skipped: true, error: 'reason' in result ? String(result.reason || '') : '' };
    }

    return { sent: true, skipped: false, error: '' };
  } catch (error) {
    await db.$executeRawUnsafe(
      `
        UPDATE \`${VPS_GPU_INSTANCES_TABLE}\`
        SET low_balance_warning_for_at = NULL,
            low_balance_warning_for_at_ms = NULL,
            updated_at = NOW()
        WHERE id = ?
          AND low_balance_warning_for_at_ms = ?
      `,
      notice.rowId,
      notice.nextChargeAt.getTime()
    ).catch(() => 0);
    return { sent: false, skipped: false, error: error instanceof Error ? error.message : 'Không gửi được email cảnh báo ví game' };
  }
}

export async function runVpsGpuHourlyBilling() {
  await ensureVpsGpuInstancesTable();
  const providerInstances = await listProviderInstanceIds();
  const warningThreshold = addMilliseconds(new Date(), LOW_BALANCE_WARNING_MS);
  const warningThresholdMs = warningThreshold.getTime();

  const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT id, provider_instance_id, next_charge_at, next_charge_at_ms
      FROM \`${VPS_GPU_INSTANCES_TABLE}\`
      WHERE status IN (${activeStatusListSql()})
        AND (
          next_charge_at_ms <= ?
          OR (next_charge_at_ms IS NULL AND next_charge_at <= ?)
        )
      ORDER BY COALESCE(next_charge_at_ms, 9223372036854775807) ASC, next_charge_at ASC, id ASC
      LIMIT 120
    `,
    warningThresholdMs,
    warningThreshold
  );

  let charged = 0;
  let chargedHours = 0;
  let deleted = 0;
  let deletionPending = 0;
  let warningsSent = 0;
  let warningsSkipped = 0;
  const errors: string[] = [];

  for (const rawRow of rows) {
    const rowId = Math.trunc(toNumber(normalizeValue(rawRow.id), 0));
    const providerInstanceId = String(normalizeValue(rawRow.provider_instance_id) || '').trim();
    const nextChargeAtDate = toDate(normalizeValue(rawRow.next_charge_at));
    const nextChargeAtMs = timestampMsFromDateFallback(rawRow.next_charge_at_ms, nextChargeAtDate);
    if (!rowId) continue;

    try {
      if (providerInstances.ok && providerInstanceId && !providerInstances.ids.has(providerInstanceId)) {
        await markVpsGpuEnded(providerInstanceId, 'provider_missing');
        continue;
      }

      if (nextChargeAtMs && nextChargeAtMs > Date.now()) {
        const warning = await sendLowBalanceWarning(rowId);
        if (warning.sent) {
          warningsSent += 1;
        } else {
          warningsSkipped += 1;
          if (warning.error) {
            errors.push(`${providerInstanceId}: ${warning.error}`);
          }
        }
        continue;
      }

      const result = await chargeDueBillingRow(rowId);
      charged += result.charged;
      chargedHours += result.chargedHours;

      if (result.deleteNeeded && result.providerInstanceId) {
        const deleteResult = await deleteProviderInstance(result.providerInstanceId);
        if (deleteResult.ok) {
          await markVpsGpuEnded(result.providerInstanceId, 'insufficient_game_balance');
          deleted += 1;
        } else {
          deletionPending += 1;
          errors.push(`${result.providerInstanceId}: ${deleteResult.error}`);
        }
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `billing row ${rowId} failed`);
    }
  }

  return {
    scanned: rows.length,
    charged,
    charged_hours: chargedHours,
    deleted,
    deletion_pending: deletionPending,
    warnings_sent: warningsSent,
    warnings_skipped: warningsSkipped,
    errors,
    provider_lookup_error: providerInstances.ok ? null : providerInstances.error,
  };
}
