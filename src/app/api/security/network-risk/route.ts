import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getRequestIp, isTrackableIp, logSecurityEvent, temporaryBanIp } from '@/lib/ip-security';
import { getVerifiedSessionUserId, invalidateSessionUserCache } from '@/lib/session-cookie';

export const dynamic = 'force-dynamic';

type RecentIpRow = {
  ip: string | null;
  total: number | bigint;
};

const ACTION_PATH_PATTERN = /^\/user\/(smm|automxh|resources|game-accounts|random-game-accounts|game-market|support-tiktok|meta-support|proxy|vps-gpu|vibe-code|web-service|press|card|deposit|cart|orders)(?:\/|$)/;
const SESSION_WARNING_KEY_PREFIX = 'network_risk_warning:';

function normalizeText(value: unknown, limit = 500) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function hasSuspiciousUa(userAgent: string) {
  return /(vpn|proxy|tor|headlesschrome|phantom|selenium|playwright|puppeteer|curl|wget|python-requests|go-http-client|httpclient|bot|spider)/i.test(userAgent);
}

async function getRecentDistinctIpCount(userId: number) {
  const rows = await db.$queryRawUnsafe<RecentIpRow[]>(
    `
      SELECT ip, COUNT(*) AS total
      FROM (
        SELECT ip
        FROM security_logs
        WHERE user_id = ?
          AND ip IS NOT NULL
          AND ip <> ''
          AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)

        UNION ALL

        SELECT last_ip AS ip
        FROM users
        WHERE id = ?
          AND last_ip IS NOT NULL
          AND last_ip <> ''
      ) recent_ips
      GROUP BY ip
    `,
    userId,
    userId
  ).catch(() => []);

  return rows.map((row) => String(row.ip || '').trim()).filter(isTrackableIp).length;
}

async function getWarningCount(userId: number) {
  const key = `${SESSION_WARNING_KEY_PREFIX}${userId}`;
  const rows = await db.$queryRawUnsafe<Array<{ value: string | null }>>(
    'SELECT setting_value AS value FROM settings WHERE setting_key = ? LIMIT 1',
    key
  ).catch(() => []);
  let value: { count?: number; updatedAt?: string } = {};
  try {
    value = JSON.parse(rows[0]?.value || '{}') as { count?: number; updatedAt?: string };
  } catch {
    value = {};
  }
  const updatedAt = value.updatedAt ? Date.parse(value.updatedAt) : 0;
  if (!updatedAt || updatedAt + 12 * 60 * 60 * 1000 < Date.now()) {
    return 0;
  }
  return Math.max(0, Math.trunc(Number(value.count || 0)));
}

async function setWarningCount(userId: number, count: number) {
  const key = `${SESSION_WARNING_KEY_PREFIX}${userId}`;
  const value = JSON.stringify({ count, updatedAt: new Date().toISOString() });
  const updated = await db.$executeRawUnsafe(
    `
      UPDATE settings
      SET setting_value = ?, updated_at = NOW()
      WHERE setting_key = ?
    `,
    value,
    key
  ).catch(() => 0);

  if (Number(updated || 0) > 0) {
    return;
  }

  await db.$executeRawUnsafe(
    `
      INSERT INTO settings (setting_key, setting_value)
      VALUES (?, ?)
    `,
    key,
    value
  ).catch(() => undefined);
}

export async function POST(req: NextRequest) {
  const userId = await getVerifiedSessionUserId();
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const path = normalizeText(body?.path || req.nextUrl.pathname, 240);
  const action = normalizeText(body?.action || 'user-action', 80);

  if (!ACTION_PATH_PATTERN.test(path)) {
    return NextResponse.json({ success: true, risk: false, warnings: 0 });
  }

  const ip = getRequestIp(req);
  const userAgent = normalizeText(req.headers.get('user-agent'), 500);
  const signal = normalizeText(body?.signal, 800);
  const recentIpCount = await getRecentDistinctIpCount(userId);

  let riskScore = 0;
  const reasons: string[] = [];

  if (recentIpCount >= 4) {
    riskScore += 55;
    reasons.push(`ip_rotation_24h:${recentIpCount}`);
  } else if (recentIpCount >= 3) {
    riskScore += 35;
    reasons.push(`ip_rotation_24h:${recentIpCount}`);
  }

  if (hasSuspiciousUa(userAgent)) {
    riskScore += 35;
    reasons.push('suspicious_user_agent');
  }

  if (/(vpn|proxy|tor|datacenter|fake-ip|fake ip|timezone-mismatch|low-memory|automation)/i.test(signal)) {
    riskScore += 35;
    reasons.push('client_network_signal');
  }

  await logSecurityEvent({
    eventType: riskScore >= 60 ? 'NETWORK_RISK_CHECK' : 'NETWORK_RISK_OBSERVE',
    severity: riskScore >= 80 ? 'HIGH' : riskScore >= 60 ? 'MEDIUM' : 'LOW',
    ip,
    userId,
    uri: path,
    method: req.method,
    field: action,
    payload: JSON.stringify({ riskScore, recentIpCount, reasons, signal }).slice(0, 1000),
    userAgent,
    autoBanned: false,
  });

  if (riskScore < 60) {
    return NextResponse.json({ success: true, risk: false, warnings: 0, riskScore });
  }

  const warningCount = await getWarningCount(userId);
  const nextWarningCount = warningCount + 1;

  if (nextWarningCount <= 2) {
    await setWarningCount(userId, nextWarningCount);
    return NextResponse.json({
      success: true,
      risk: true,
      warning: true,
      warnings: nextWarningCount,
      riskScore,
      message: `Hệ thống phát hiện tín hiệu fake IP/VPN/proxy. Vui lòng tắt trước khi dùng dịch vụ. Cảnh báo ${nextWarningCount}/2.`,
    });
  }

  const reason = `AI network guard: continued service use with VPN/proxy/fake IP risk after 2 warnings (${reasons.join(', ')})`;
  await temporaryBanIp({
    ip,
    reason,
    userId,
    minutes: 60,
    eventType: 'AI_NETWORK_RISK_TEMP_BAN',
    uri: path,
    method: req.method,
    userAgent,
  });
  await db.users.update({
    where: { id: userId },
    data: {
      status: 'banned',
      lock_reason: reason,
      locked_at: new Date(),
    },
  }).catch(() => undefined);
  invalidateSessionUserCache(userId);

  return NextResponse.json({
    success: false,
    code: 'ACCOUNT_BANNED',
    autoBanned: true,
    bannedUser: true,
    riskScore,
    message: 'Tài khoản đã bị khóa vì tiếp tục dùng dịch vụ khi hệ thống phát hiện fake IP/VPN/proxy. Liên hệ owner để mở khóa.',
  }, { status: 403 });
}
