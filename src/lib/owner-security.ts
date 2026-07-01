import 'server-only';

import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getRequestDeviceInfo } from '@/lib/device-info';
import { getRequestIp } from '@/lib/ip-security';
import { sendSecurityAlertEmail } from '@/lib/security-alert-email';

type OwnerSecurityUser = {
  id: number;
  username?: string | null;
  email?: string | null;
  role?: string | null;
  fa_enabled?: boolean | null;
  telegram_2fa_enabled?: boolean | null;
};

type AdminSessionUser = {
  id: number;
  username: string;
  email: string;
  role: string;
};

type OwnerGuardVerdict = {
  allowed: boolean;
  message?: string;
  riskScore: number;
  reasons: string[];
  deviceHash: string;
};

const OWNER_SECURITY_TABLES_SQL = [
  `
    CREATE TABLE IF NOT EXISTS owner_security_events (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT NULL,
      username VARCHAR(100) NULL,
      email VARCHAR(190) NULL,
      event_type VARCHAR(80) NOT NULL,
      layer VARCHAR(60) NOT NULL,
      verdict VARCHAR(40) NOT NULL,
      risk_score INT NOT NULL DEFAULT 0,
      reason TEXT NULL,
      ip_address VARCHAR(45) NULL,
      user_agent TEXT NULL,
      device_hash VARCHAR(96) NULL,
      request_path VARCHAR(255) NULL,
      request_method VARCHAR(16) NULL,
      details LONGTEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_owner_security_user_created (user_id, created_at),
      KEY idx_owner_security_event_created (event_type, created_at),
      KEY idx_owner_security_ip_created (ip_address, created_at),
      KEY idx_owner_security_device_created (device_hash, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `,
  `
    CREATE TABLE IF NOT EXISTS owner_trusted_devices (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT NOT NULL,
      device_hash VARCHAR(96) NOT NULL,
      label VARCHAR(190) NULL,
      user_agent TEXT NULL,
      first_ip VARCHAR(45) NULL,
      last_ip VARCHAR(45) NULL,
      trust_level VARCHAR(40) NOT NULL DEFAULT 'owner_manual',
      revoked_reason TEXT NULL,
      revoked_by INT NULL,
      first_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      revoked_at TIMESTAMP NULL DEFAULT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_owner_device (user_id, device_hash),
      KEY idx_owner_trusted_devices_user (user_id),
      KEY idx_owner_trusted_devices_ip (last_ip)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `,
];

let ownerSecurityTablesReady = false;

export function isOwnerRole(role: unknown) {
  return String(role || '').trim().toLowerCase() === 'owner';
}

export function isAdminRole(role: unknown) {
  const normalized = String(role || '').trim().toLowerCase();
  return normalized === 'admin' || normalized === 'owner';
}

export function isOperatorAdminRole(role: unknown) {
  return String(role || '').trim().toLowerCase() === 'admin';
}

export function getOwnerAllowedIps() {
  return String(process.env.OWNER_ALLOWED_IPS || '')
    .split(/[,\n;\s]+/)
    .map((item) => normalizeIp(item))
    .filter((item) => item && item !== 'unknown');
}

function normalizeIp(ip: string | null | undefined) {
  return String(ip || '').replace(/^::ffff:/, '').split(',')[0]?.trim() || 'unknown';
}

function getClientIp(req: NextRequest) {
  return normalizeIp(getRequestIp(req));
}

function getOwnerManualCode() {
  return String(process.env.OWNER_MANUAL_CODE || process.env.OWNER_SECURITY_CODE || '').trim();
}

function hashValue(value: string) {
  const secret =
    process.env.SESSION_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.JWT_SECRET ||
    process.env.APP_KEY ||
    'development-only-owner-security-secret';

  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

export function getOwnerDeviceHash(req: NextRequest) {
  return getRequestDeviceInfo(req).deviceHash;
}

async function ensureOwnerSecurityTables() {
  if (ownerSecurityTablesReady) {
    return;
  }

  for (const sql of OWNER_SECURITY_TABLES_SQL) {
    await db.$executeRawUnsafe(sql).catch(() => undefined);
  }
  await db.$executeRawUnsafe('ALTER TABLE owner_trusted_devices ADD COLUMN revoked_reason TEXT NULL').catch(() => undefined);
  await db.$executeRawUnsafe('ALTER TABLE owner_trusted_devices ADD COLUMN revoked_by INT NULL').catch(() => undefined);
  ownerSecurityTablesReady = true;
}

async function getTrustedDevice(userId: number, deviceHash: string) {
  await ensureOwnerSecurityTables();
  const rows = await db.$queryRawUnsafe<Array<{ id: number | bigint; last_ip: string | null; revoked_at: Date | null }>>(
    `
      SELECT id, last_ip, revoked_at
      FROM owner_trusted_devices
      WHERE user_id = ? AND device_hash = ?
      LIMIT 1
    `,
    userId,
    deviceHash
  ).catch(() => []);
  const row = rows[0];
  if (!row || row.revoked_at) {
    return null;
  }
  return row;
}

async function getOwnerDeviceRecord(userId: number, deviceHash: string) {
  await ensureOwnerSecurityTables();
  const rows = await db.$queryRawUnsafe<Array<{
    id: number | bigint;
    last_ip: string | null;
    revoked_at: Date | null;
  }>>(
    `
      SELECT id, last_ip, revoked_at
      FROM owner_trusted_devices
      WHERE user_id = ? AND device_hash = ?
      LIMIT 1
    `,
    userId,
    deviceHash
  ).catch(() => []);
  return rows[0] || null;
}

export async function getOwnerCurrentDeviceRevocation(req: NextRequest, userId: number) {
  const deviceHash = getOwnerDeviceHash(req);
  const currentDevice = await getOwnerDeviceRecord(userId, deviceHash);
  if (!currentDevice?.revoked_at) {
    return null;
  }

  return {
    deviceId: String(currentDevice.id),
    deviceHash,
    ip: currentDevice.last_ip || null,
    revokedAt: currentDevice.revoked_at,
  };
}

async function trustOwnerDevice(input: {
  userId: number;
  deviceHash: string;
  ip: string;
  userAgent: string;
  label?: string;
}) {
  await ensureOwnerSecurityTables();
  await db.$executeRawUnsafe(
    `
      INSERT INTO owner_trusted_devices
        (user_id, device_hash, label, user_agent, first_ip, last_ip, trust_level, first_seen_at, last_seen_at)
      VALUES
        (?, ?, ?, ?, ?, ?, 'owner_manual', NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        user_agent = VALUES(user_agent),
        last_ip = VALUES(last_ip),
        last_seen_at = NOW(),
        revoked_at = NULL
    `,
    input.userId,
    input.deviceHash,
    input.label || 'Owner verified device',
    input.userAgent,
    input.ip,
    input.ip
  ).catch(() => undefined);
}

export async function logOwnerSecurityEvent(input: {
  user?: Partial<OwnerSecurityUser | AdminSessionUser> | null;
  req?: NextRequest;
  eventType: string;
  layer: string;
  verdict: string;
  riskScore?: number;
  reasons?: string[];
  details?: Record<string, unknown>;
  deviceHash?: string;
}) {
  await ensureOwnerSecurityTables();
  const req = input.req;
  const user = input.user;
  const ip = req ? getClientIp(req) : 'unknown';
  const userAgent = req?.headers.get('user-agent') || null;

  await db.$executeRawUnsafe(
    `
      INSERT INTO owner_security_events
        (user_id, username, email, event_type, layer, verdict, risk_score, reason, ip_address, user_agent, device_hash, request_path, request_method, details, created_at)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `,
    user?.id ? Number(user.id) : null,
    typeof user?.username === 'string' ? user.username : null,
    typeof user?.email === 'string' ? user.email : null,
    input.eventType,
    input.layer,
    input.verdict,
    Math.max(0, Math.trunc(input.riskScore || 0)),
    (input.reasons || []).join('; ').slice(0, 4000),
    ip,
    userAgent,
    input.deviceHash || (req ? getOwnerDeviceHash(req) : null),
    req?.nextUrl.pathname || null,
    req?.method || null,
    input.details ? JSON.stringify(input.details).slice(0, 60000) : null
  ).catch(() => undefined);
}

function timingSafeEqualText(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function checkManualCode(inputCode: string | null | undefined) {
  const expected = getOwnerManualCode();
  const received = String(inputCode || '').trim();
  return Boolean(expected && received && timingSafeEqualText(expected, received));
}

async function shouldSendOwnerLoginAlertOnce(key: string) {
  const settingKey = `owner_alert:${hashValue(key).slice(0, 38)}`;
  const rows = await db.settings.findMany({
    where: { setting_key: settingKey },
    orderBy: { id: 'desc' },
    take: 1,
    select: { id: true },
  }).catch(() => []);

  if (rows[0]?.id) {
    return false;
  }

  await db.settings.create({
    data: {
      setting_key: settingKey,
      setting_value: new Date().toISOString(),
    },
  }).catch(() => undefined);
  return true;
}

async function sendOwnerLoginAlertOnce(input: {
  key: string;
  user: OwnerSecurityUser;
  req: NextRequest;
  title: string;
  severity?: 'HIGH' | 'CRITICAL';
  reason: string;
  deviceHash: string;
  details?: Record<string, unknown>;
}) {
  if (!(await shouldSendOwnerLoginAlertOnce(input.key))) {
    return;
  }

  await sendSecurityAlertEmail({
    event: 'OWNER_LOGIN_SECURITY',
    title: input.title,
    severity: input.severity || 'HIGH',
    ip: getClientIp(input.req),
    userId: input.user.id,
    username: input.user.username || null,
    email: input.user.email || null,
    reason: input.reason,
    path: input.req.nextUrl.pathname,
    method: input.req.method,
    userAgent: input.req.headers.get('user-agent') || null,
    details: {
      device_hash: input.deviceHash,
      ...input.details,
    },
    cooldownKey: input.key,
    force: true,
  }).catch(() => undefined);
}

function runOwnerLoginAiLayerOne(input: {
  ip: string;
  userAgent: string;
  allowedIps: string[];
  trusted: boolean;
  has2fa: boolean;
}) {
  let riskScore = 0;
  const reasons: string[] = [];
  const userAgent = input.userAgent.toLowerCase();

  if (!input.has2fa) {
    riskScore += 100;
    reasons.push('owner_missing_2fa');
  }

  if (input.allowedIps.length > 0 && !input.allowedIps.includes(input.ip)) {
    riskScore += input.trusted ? 25 : 100;
    reasons.push('owner_ip_not_allowlisted');
  }

  if (!input.trusted) {
    riskScore += 35;
    reasons.push('new_owner_device');
  }

  if (!input.userAgent || userAgent === 'unknown') {
    riskScore += 20;
    reasons.push('missing_user_agent');
  }

  if (/(curl|wget|python-requests|httpclient|postman|bot|spider|crawler)/i.test(input.userAgent)) {
    riskScore += 40;
    reasons.push('automation_user_agent');
  }

  return { riskScore, reasons };
}

async function runOwnerLoginAiLayerTwo(input: {
  userId: number;
  ip: string;
  deviceHash: string;
}) {
  await ensureOwnerSecurityTables();
  const [recentDenies, recentIpUsers] = await Promise.all([
    db.$queryRawUnsafe<Array<{ total: number | bigint }>>(
      `
        SELECT COUNT(*) AS total
        FROM owner_security_events
        WHERE user_id = ?
          AND verdict IN ('blocked', 'denied')
          AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      `,
      input.userId
    ).catch(() => [{ total: 0 }]),
    db.$queryRawUnsafe<Array<{ total: number | bigint }>>(
      `
        SELECT COUNT(DISTINCT user_id) AS total
        FROM activity_logs
        WHERE ip_address = ?
          AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      `,
      input.ip
    ).catch(() => [{ total: 0 }]),
  ]);

  let riskScore = 0;
  const reasons: string[] = [];
  if (Number(recentDenies[0]?.total || 0) >= 3) {
    riskScore += 35;
    reasons.push('recent_owner_denies');
  }
  if (Number(recentIpUsers[0]?.total || 0) >= 5) {
    riskScore += 25;
    reasons.push('ip_used_by_many_accounts');
  }
  if (!input.deviceHash) {
    riskScore += 20;
    reasons.push('missing_device_hash');
  }

  return { riskScore, reasons };
}

export async function verifyOwnerLoginSecurity(
  req: NextRequest,
  user: OwnerSecurityUser,
  input: { manualCode?: string | null }
): Promise<OwnerGuardVerdict> {
  const ip = normalizeIp(getClientIp(req));
  const userAgent = req.headers.get('user-agent') || 'unknown';
  const deviceHash = getOwnerDeviceHash(req);
  const currentDevice = await getOwnerDeviceRecord(user.id, deviceHash);
  const trusted = Boolean(currentDevice && !currentDevice.revoked_at);
  const allowedIps = getOwnerAllowedIps();
  const has2fa = Boolean(user.fa_enabled || user.telegram_2fa_enabled);
  const manualOk = checkManualCode(input.manualCode);
  const layerOne = runOwnerLoginAiLayerOne({ ip, userAgent, allowedIps, trusted, has2fa });
  const layerTwo = await runOwnerLoginAiLayerTwo({ userId: user.id, ip, deviceHash });
  const riskScore = layerOne.riskScore + layerTwo.riskScore;
  const reasons = [...layerOne.reasons, ...layerTwo.reasons];
  const ipAllowlistEnabled = allowedIps.length > 0;
  const ipAllowed = !ipAllowlistEnabled || allowedIps.includes(ip);
  const previousTrustedIp = currentDevice?.last_ip ? normalizeIp(currentDevice.last_ip) : null;
  const trustedDeviceNewIp = Boolean(
    trusted &&
      previousTrustedIp &&
      previousTrustedIp !== 'unknown' &&
      previousTrustedIp !== ip
  );

  if (currentDevice?.revoked_at) {
    await sendOwnerLoginAlertOnce({
      key: `owner-login-revoked-device:${user.id}:${deviceHash}:${ip}`,
      user,
      req,
      title: 'Owner bị chặn vì thiết bị đã bị logout và khóa',
      severity: 'CRITICAL',
      reason: 'Thiết bị owner đã bị revoke nhưng vẫn cố đăng nhập.',
      deviceHash,
      details: {
        ip,
        revoked_at: currentDevice.revoked_at,
      },
    });
    await logOwnerSecurityEvent({
      user,
      req,
      eventType: 'OWNER_LOGIN_REVOKED_DEVICE',
      layer: 'device-revocation',
      verdict: 'blocked',
      riskScore: 100,
      reasons: ['owner_device_revoked'],
      deviceHash,
    });
    return {
      allowed: false,
      message: 'Thiết bị owner này đã bị đăng xuất và khóa. Cần owner mở thủ công trước khi đăng nhập lại.',
      riskScore: 100,
      reasons: ['owner_device_revoked'],
      deviceHash,
    };
  }

  if (!has2fa) {
    await sendOwnerLoginAlertOnce({
      key: `owner-login-missing-2fa:${user.id}:${deviceHash}:${ip}`,
      user,
      req,
      title: 'Owner bị chặn vì chưa bật 2FA',
      severity: 'CRITICAL',
      reason: 'Tài khoản owner bắt buộc có 2FA trước khi đăng nhập.',
      deviceHash,
      details: { ip },
    });
    await logOwnerSecurityEvent({
      user,
      req,
      eventType: 'OWNER_LOGIN',
      layer: 'manual+ai',
      verdict: 'blocked',
      riskScore,
      reasons,
      deviceHash,
    });
    return {
      allowed: false,
      message: 'Owner bắt buộc bật Google/Telegram 2FA trước khi đăng nhập.',
      riskScore,
      reasons,
      deviceHash,
    };
  }

  if (!ipAllowed && !trusted) {
    await sendOwnerLoginAlertOnce({
      key: `owner-login-blocked-untrusted-ip:${user.id}:${deviceHash}:${ip}`,
      user,
      req,
      title: 'Owner bị chặn vì IP/thiết bị chưa được cấp quyền',
      severity: 'CRITICAL',
      reason: 'Thiết bị owner chưa được xác nhận và IP không nằm trong OWNER_ALLOWED_IPS.',
      deviceHash,
      details: {
        ip,
        allowed_ips: allowedIps,
      },
    });
    await logOwnerSecurityEvent({
      user,
      req,
      eventType: 'OWNER_LOGIN',
      layer: 'manual+ai',
      verdict: 'blocked',
      riskScore,
      reasons,
      deviceHash,
    });
    return {
      allowed: false,
      message: 'IP này chưa được tin cậy. Hãy đăng nhập từ thiết bị owner đã xác thực hoặc dùng IP trong OWNER_ALLOWED_IPS lần đầu.',
      riskScore,
      reasons,
      deviceHash,
    };
  }

  if ((!trusted || riskScore >= 50) && !manualOk) {
    await sendOwnerLoginAlertOnce({
      key: `owner-login-manual-code-required:${user.id}:${deviceHash}:${ip}`,
      user,
      req,
      title: trusted ? 'Owner trusted device cần xác thực lại' : 'Owner thiết bị mới cần xác nhận thủ công',
      severity: trusted ? 'HIGH' : 'CRITICAL',
      reason: trusted
        ? 'Thiết bị owner đã trusted nhưng risk score cao nên cần mã thủ công.'
        : 'Thiết bị owner chưa được xác nhận thử đăng nhập.',
      deviceHash,
      details: {
        ip,
        risk_score: riskScore,
        reasons,
      },
    });
    await logOwnerSecurityEvent({
      user,
      req,
      eventType: 'OWNER_LOGIN',
      layer: 'manual+ai',
      verdict: 'denied',
      riskScore,
      reasons: [...reasons, 'manual_code_required'],
      deviceHash,
    });
    return {
      allowed: false,
      message: 'Owner cần nhập mã bảo mật thủ công cho thiết bị/IP này.',
      riskScore,
      reasons,
      deviceHash,
    };
  }

  if (trustedDeviceNewIp) {
    await sendOwnerLoginAlertOnce({
      key: `owner-login-trusted-device-new-ip:${user.id}:${deviceHash}:${ip}`,
      user,
      req,
      title: 'Owner trusted device đăng nhập từ IP mới',
      severity: 'HIGH',
      reason: 'Thiết bị owner đã được duyệt nhưng đăng nhập từ IP mới. Email này chỉ gửi một lần cho cặp device/IP này.',
      deviceHash,
      details: {
        previous_ip: previousTrustedIp,
        current_ip: ip,
        allowed_ips: allowedIps,
      },
    });
  }

  if (!trusted && manualOk) {
    await sendOwnerLoginAlertOnce({
      key: `owner-login-new-device-approved:${user.id}:${deviceHash}`,
      user,
      req,
      title: 'Owner device mới đã được duyệt đăng nhập',
      severity: 'HIGH',
      reason: 'Thiết bị owner chưa xác nhận đã nhập đúng mã thủ công và được trust.',
      deviceHash,
      details: {
        ip,
        allowed_ips: allowedIps,
      },
    });
  }

  if (manualOk) {
    await trustOwnerDevice({ userId: user.id, deviceHash, ip, userAgent });
  } else if (trusted) {
    await trustOwnerDevice({ userId: user.id, deviceHash, ip, userAgent });
  }

  await logOwnerSecurityEvent({
    user,
    req,
    eventType: 'OWNER_LOGIN',
    layer: 'manual+ai',
    verdict: 'allowed',
    riskScore,
    reasons: trusted ? reasons : [...reasons, 'trusted_by_manual_code'],
    deviceHash,
  });

  return { allowed: true, riskScore, reasons, deviceHash };
}

export async function verifyOwnerActionSecurity(req: NextRequest, user: AdminSessionUser, action: string) {
  const role = String(user.role || '').toLowerCase();
  if (!isOwnerRole(role)) {
    await logOwnerSecurityEvent({
      user,
      req,
      eventType: 'OWNER_ACTION',
      layer: 'rbac',
      verdict: 'blocked',
      riskScore: 100,
      reasons: ['owner_role_required', action],
    });
    return NextResponse.json({ success: false, message: 'Chỉ owner mới có quyền truy cập khu vực này.' }, { status: 403 });
  }

  const ip = normalizeIp(getClientIp(req));
  const allowedIps = getOwnerAllowedIps();
  const deviceHash = getOwnerDeviceHash(req);
  const currentDevice = await getOwnerDeviceRecord(user.id, deviceHash);
  const trusted = Boolean(currentDevice && !currentDevice.revoked_at);
  const reasons: string[] = [];
  let riskScore = trusted ? 0 : 35;

  if (currentDevice?.revoked_at) {
    await logOwnerSecurityEvent({
      user,
      req,
      eventType: 'OWNER_REVOKED_DEVICE_BLOCKED',
      layer: 'device-revocation',
      verdict: 'blocked',
      riskScore: 100,
      reasons: ['owner_device_revoked', action],
      deviceHash,
    });
    return NextResponse.json(
      {
        success: false,
        code: 'OWNER_DEVICE_REVOKED',
        blocked: true,
        message: 'Thiết bị owner này đã bị đăng xuất và khóa. Cần owner mở thủ công trước khi dùng lại.',
      },
      { status: 403 }
    );
  }

  if (!trusted) {
    reasons.push('owner_action_from_untrusted_device');
  }
  if (allowedIps.length > 0 && !allowedIps.includes(ip)) {
    riskScore += trusted ? 25 : 100;
    reasons.push('owner_action_ip_not_allowlisted');
  }

  if (!trusted || riskScore >= 100) {
    await logOwnerSecurityEvent({
      user,
      req,
      eventType: 'OWNER_ACTION',
      layer: 'ai-action',
      verdict: 'blocked',
      riskScore,
      reasons: [...reasons, action],
      deviceHash,
    });
    return NextResponse.json({ success: false, message: 'Owner action bị chặn do IP/thiết bị không hợp lệ.' }, { status: 403 });
  }

  await logOwnerSecurityEvent({
    user,
    req,
    eventType: 'OWNER_ACTION',
    layer: 'ai-action',
    verdict: riskScore > 0 ? 'watch' : 'allowed',
    riskScore,
    reasons: [...reasons, action],
    deviceHash,
  });

  return null;
}

export async function ensureOwnerSecurityResources() {
  await ensureOwnerSecurityTables();
}

export async function listOwnerTrustedDevices() {
  await ensureOwnerSecurityTables();
  const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `
      SELECT
        d.*,
        u.username,
        u.email,
        CASE
          WHEN d.revoked_at IS NOT NULL THEN 'revoked'
          ELSE 'trusted'
        END AS device_status,
        CASE
          WHEN b.id IS NULL THEN 0
          ELSE 1
        END AS ip_banned
      FROM owner_trusted_devices d
      LEFT JOIN users u ON u.id = d.user_id
      LEFT JOIN banned_ips b
        ON b.ip = d.last_ip
       AND (b.expire_at IS NULL OR b.expire_at > NOW())
      ORDER BY COALESCE(d.revoked_at, d.last_seen_at) DESC, d.id DESC
    `
  ).catch(() => []);
  return rows;
}

export async function revokeOwnerTrustedDevice(input: {
  deviceId: number;
  adminId: number;
  req: NextRequest;
  reason?: string;
}) {
  await ensureOwnerSecurityTables();
  const rows = await db.$queryRawUnsafe<Array<{
    id: number | bigint;
    user_id: number | bigint;
    device_hash: string | null;
    label: string | null;
    last_ip: string | null;
    revoked_at: Date | null;
    username: string | null;
    email: string | null;
  }>>(
    `
      SELECT d.*, u.username, u.email
      FROM owner_trusted_devices d
      LEFT JOIN users u ON u.id = d.user_id
      WHERE d.id = ?
      LIMIT 1
    `,
    input.deviceId
  );
  const device = rows[0];
  if (!device) {
    throw new Error('Không tìm thấy thiết bị owner.');
  }

  const rawReason = String(input.reason || '').trim();
  const reason = (
    rawReason.toLowerCase().includes('owner logout device')
      ? rawReason
      : `Owner logout device and lock IP${rawReason ? `: ${rawReason}` : ''}`
  ).slice(0, 1000);
  await db.$executeRawUnsafe(
    `
      UPDATE owner_trusted_devices
      SET revoked_at = NOW(), revoked_reason = ?, revoked_by = ?
      WHERE id = ?
    `,
    reason,
    input.adminId,
    input.deviceId
  );

  const ip = String(device.last_ip || '').trim();
  if (ip && ip !== 'unknown') {
    const updated = await db.$executeRawUnsafe(
      `
        UPDATE banned_ips
        SET reason = ?, banned_by = 'admin', user_id = ?, expire_at = NULL, created_at = NOW()
        WHERE ip = ?
      `,
      reason,
      input.adminId,
      ip
    ).catch(() => 0);

    if (Number(updated || 0) === 0) {
      await db.$executeRawUnsafe(
        `
          INSERT INTO banned_ips (ip, reason, banned_by, user_id, expire_at)
          VALUES (?, ?, 'admin', ?, NULL)
        `,
        ip,
        reason,
        input.adminId
      ).catch(() => undefined);
    }

    await sendSecurityAlertEmail({
      event: 'OWNER_DEVICE_REVOKED',
      title: 'Owner đã đăng xuất và khóa một thiết bị/IP',
      severity: 'CRITICAL',
      ip,
      userId: Number(device.user_id || 0) || null,
      username: device.username,
      email: device.email,
      reason,
      path: input.req.nextUrl.pathname,
      method: input.req.method,
      userAgent: input.req.headers.get('user-agent') || null,
      details: {
        owner_device_id: String(device.id),
        device_hash: device.device_hash,
        label: device.label,
        revoked_by: input.adminId,
      },
      cooldownKey: `owner-device-revoked:${device.id}:${ip}`,
      force: true,
    }).catch(() => undefined);
  }

  await logOwnerSecurityEvent({
    user: {
      id: Number(device.user_id || 0),
      username: device.username,
      email: device.email,
      role: 'owner',
    },
    req: input.req,
    eventType: 'OWNER_DEVICE_REVOKED',
    layer: 'manual-device-control',
    verdict: 'blocked',
    riskScore: 100,
    reasons: [reason, ip ? `ip:${ip}` : 'missing_ip'],
    deviceHash: device.device_hash || undefined,
    details: {
      owner_device_id: String(device.id),
      revoked_by: input.adminId,
    },
  }).catch(() => undefined);

  return { success: true, ip, device_id: input.deviceId };
}

export async function restoreOwnerTrustedDevice(input: {
  deviceId: number;
  adminId: number;
  req: NextRequest;
  unblockIp?: boolean;
}) {
  await ensureOwnerSecurityTables();
  const rows = await db.$queryRawUnsafe<Array<{
    id: number | bigint;
    user_id: number | bigint;
    device_hash: string | null;
    last_ip: string | null;
    username: string | null;
    email: string | null;
  }>>(
    `
      SELECT d.*, u.username, u.email
      FROM owner_trusted_devices d
      LEFT JOIN users u ON u.id = d.user_id
      WHERE d.id = ?
      LIMIT 1
    `,
    input.deviceId
  );
  const device = rows[0];
  if (!device) {
    throw new Error('Không tìm thấy thiết bị owner.');
  }

  await db.$executeRawUnsafe(
    `
      UPDATE owner_trusted_devices
      SET revoked_at = NULL, revoked_reason = NULL, revoked_by = NULL, last_seen_at = NOW()
      WHERE id = ?
    `,
    input.deviceId
  );

  const ip = String(device.last_ip || '').trim();
  if (input.unblockIp !== false && ip && ip !== 'unknown') {
    await db.$executeRawUnsafe(
      'DELETE FROM banned_ips WHERE ip = ? AND reason LIKE ?',
      ip,
      '%Owner logout device%'
    ).catch(() => undefined);
  }

  await logOwnerSecurityEvent({
    user: {
      id: Number(device.user_id || 0),
      username: device.username,
      email: device.email,
      role: 'owner',
    },
    req: input.req,
    eventType: 'OWNER_DEVICE_RESTORED',
    layer: 'manual-device-control',
    verdict: 'allowed',
    riskScore: 0,
    reasons: [ip ? `ip:${ip}` : 'missing_ip'],
    deviceHash: device.device_hash || undefined,
    details: {
      owner_device_id: String(device.id),
      restored_by: input.adminId,
    },
  }).catch(() => undefined);

  return { success: true, ip, device_id: input.deviceId };
}
