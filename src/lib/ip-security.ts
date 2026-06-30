import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { sendSecurityAlertEmail } from '@/lib/security-alert-email';

export const MAX_ACCOUNTS_PER_IP = 10;

interface CountRow {
  total: number | bigint;
}

interface BlockRow {
  source: 'blacklist' | 'ban';
  reason: string | null;
  expire_at?: Date | string | null;
}

function firstHeaderIp(value: string | null) {
  return value?.split(',')[0]?.trim() || '';
}

export function getRequestIp(req: NextRequest) {
  const raw =
    firstHeaderIp(req.headers.get('cf-connecting-ip')) ||
    firstHeaderIp(req.headers.get('x-forwarded-for')) ||
    req.headers.get('x-real-ip')?.trim() ||
    '';

  return raw.replace(/^::ffff:/, '') || 'unknown';
}

export function isTrackableIp(ip: string) {
  return Boolean(ip && ip !== 'unknown');
}

export async function getIpBlock(ip: string): Promise<BlockRow | null> {
  if (!isTrackableIp(ip)) {
    return null;
  }

  const rows = await db.$queryRawUnsafe<BlockRow[]>(
    `
      SELECT source, reason, expire_at
      FROM (
        SELECT 0 AS sort_order, 'blacklist' AS source, reason, NULL AS expire_at
        FROM ip_blacklist
        WHERE ip_address = ?

        UNION ALL

        SELECT 1 AS sort_order, 'ban' AS source, reason, expire_at
        FROM banned_ips
        WHERE ip = ?
          AND (expire_at IS NULL OR expire_at > NOW())
      ) blocked
      ORDER BY sort_order ASC
      LIMIT 1
    `,
    ip,
    ip
  );

  return rows[0] || null;
}

export async function temporaryBanIp(input: {
  ip: string;
  reason: string;
  userId?: number | null;
  minutes?: number;
  eventType?: string;
  uri?: string | null;
  method?: string | null;
  userAgent?: string | null;
}) {
  const ip = String(input.ip || '').trim();
  if (!isTrackableIp(ip)) {
    return false;
  }

  const minutes = Math.max(1, Math.min(24 * 60, Math.trunc(Number(input.minutes || 15))));
  const expireSql = `DATE_ADD(NOW(), INTERVAL ${minutes} MINUTE)`;
  const reason = String(input.reason || 'AI anti-DDoS temporary ban').trim().slice(0, 1000);
  const userId = input.userId ? Math.trunc(Number(input.userId)) : null;

  const updated = await db.$executeRawUnsafe(`
    UPDATE banned_ips
    SET reason = ?, banned_by = 'auto', user_id = ?, expire_at = ${expireSql}, created_at = NOW()
    WHERE ip = ?
  `, reason, userId || null, ip).catch(() => 0);

  if (Number(updated || 0) === 0) {
    await db.$executeRawUnsafe(`
      INSERT INTO banned_ips (ip, reason, banned_by, user_id, expire_at)
      VALUES (?, ?, 'auto', ?, ${expireSql})
    `, ip, reason, userId || null).catch(() => undefined);
  }

  await logSecurityEvent({
    eventType: input.eventType || 'AI_TEMP_IP_BAN',
    severity: 'CRITICAL',
    ip,
    userId,
    uri: input.uri || null,
    method: input.method || null,
    field: 'ip',
    payload: `${reason}; minutes=${minutes}`,
    userAgent: input.userAgent || null,
    autoBanned: true,
  });

  await sendSecurityAlertEmail({
    event: input.eventType || 'AI_TEMP_IP_BAN',
    title: 'IP bị hệ thống khóa tạm thời',
    severity: 'CRITICAL',
    ip,
    userId,
    reason,
    path: input.uri || null,
    method: input.method || null,
    userAgent: input.userAgent || null,
    details: { minutes },
    cooldownKey: `temp-ban:${ip}:${input.eventType || 'AI_TEMP_IP_BAN'}`,
  }).catch(() => undefined);

  return true;
}

export async function countAccountsByIp(ip: string) {
  if (!isTrackableIp(ip)) {
    return 0;
  }

  const rows = await db.$queryRawUnsafe<CountRow[]>(`
    SELECT COUNT(*) AS total
    FROM users
    WHERE last_ip = ?
  `, ip);

  return Number(rows[0]?.total || 0);
}

export async function autoBanRegistrationIp(ip: string, count: number, req: NextRequest) {
  if (!isTrackableIp(ip)) {
    return;
  }

  const reason = `Tự động chặn IP vì tạo quá ${MAX_ACCOUNTS_PER_IP} tài khoản (${count} account đã tồn tại). Liên hệ admin để mở khóa.`;

  const updated = await db.$executeRawUnsafe(`
    UPDATE banned_ips
    SET reason = ?, banned_by = 'auto', user_id = NULL, expire_at = NULL, created_at = NOW()
    WHERE ip = ?
  `, reason, ip);

  if (Number(updated || 0) === 0) {
    await db.$executeRawUnsafe(`
      INSERT INTO banned_ips (ip, reason, banned_by, user_id, expire_at)
      VALUES (?, ?, 'auto', NULL, NULL)
    `, ip, reason);
  }

  await db.$executeRawUnsafe(`
    INSERT INTO security_logs (event_type, severity, ip, user_id, uri, method, field, payload, user_agent, auto_banned)
    VALUES ('REGISTER_IP_LIMIT', 'CRITICAL', ?, NULL, ?, ?, 'ip', ?, ?, 1)
  `, ip, req.nextUrl.pathname, req.method, `accounts=${count}`, req.headers.get('user-agent') || '').catch(() => undefined);

  await sendSecurityAlertEmail({
    event: 'REGISTER_IP_LIMIT',
    title: 'IP bị khóa vì tạo quá nhiều tài khoản',
    severity: 'CRITICAL',
    ip,
    reason,
    path: req.nextUrl.pathname,
    method: req.method,
    userAgent: req.headers.get('user-agent') || null,
    details: { accounts: count, max_accounts_per_ip: MAX_ACCOUNTS_PER_IP },
    cooldownKey: `register-ip-limit:${ip}`,
  }).catch(() => undefined);
}

export async function logSecurityEvent(input: {
  eventType: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  ip?: string | null;
  userId?: number | null;
  uri?: string | null;
  method?: string | null;
  field?: string | null;
  payload?: string | null;
  userAgent?: string | null;
  autoBanned?: boolean;
}) {
  const ip = String(input.ip || '').trim();
  if (!isTrackableIp(ip)) {
    return;
  }

  await db.$executeRawUnsafe(`
    INSERT INTO security_logs (event_type, severity, ip, user_id, uri, method, field, payload, user_agent, auto_banned)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    String(input.eventType || 'SECURITY_EVENT').trim().slice(0, 120),
    String(input.severity || 'MEDIUM').trim().toUpperCase(),
    ip,
    input.userId || null,
    String(input.uri || '').trim() || null,
    String(input.method || '').trim() || null,
    String(input.field || '').trim() || null,
    String(input.payload || '').trim().slice(0, 400) || null,
    String(input.userAgent || '').trim().slice(0, 255) || null,
    input.autoBanned ? 1 : 0
  ).catch(() => undefined);
}

export function buildBlockedIpPayload(ip: string, reason?: string | null) {
  return {
    success: false,
    code: 'IP_BLOCKED',
    blocked: true,
    ip,
    message: reason || 'Địa chỉ IP của bạn đã bị chặn. Vui lòng liên hệ admin để mở khóa.',
  };
}
