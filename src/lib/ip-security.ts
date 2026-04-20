import { NextRequest } from 'next/server';
import { db } from '@/lib/db';

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

  const rows = await db.$queryRawUnsafe<BlockRow[]>(`
    SELECT 'blacklist' AS source, reason, NULL AS expire_at
    FROM ip_blacklist
    WHERE ip_address = ?
    LIMIT 1
  `, ip);

  if (rows[0]) {
    return rows[0];
  }

  const bans = await db.$queryRawUnsafe<BlockRow[]>(`
    SELECT 'ban' AS source, reason, expire_at
    FROM banned_ips
    WHERE ip = ?
      AND (expire_at IS NULL OR expire_at > NOW())
    LIMIT 1
  `, ip);

  return bans[0] || null;
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
