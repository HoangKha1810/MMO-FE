import 'server-only';

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getRequestIp, isTrackableIp, logSecurityEvent } from '@/lib/ip-security';
import { sendSecurityAlertEmail } from '@/lib/security-alert-email';
import { invalidateSessionUserCache } from '@/lib/session-cookie';

type SecuritySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

type SecurityUser = {
  id: number;
  role: string | null;
  status: string | null;
};

export type SecurityEventInput = {
  eventType: string;
  userId?: number | null;
  field?: string | null;
  payload?: string | null;
  details?: Record<string, unknown> | null;
};

type SecurityVerdict = {
  severity: SecuritySeverity;
  riskScore: number;
  reasons: string[];
  autoBanned: boolean;
  bannedUser: boolean;
};

const SECURITY_TABLES_SQL = [
  `
    CREATE TABLE IF NOT EXISTS security_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      event_type VARCHAR(50) NOT NULL,
      severity ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL DEFAULT 'HIGH',
      ip VARCHAR(45) NOT NULL,
      user_id INT UNSIGNED NULL,
      uri VARCHAR(512) NULL,
      method VARCHAR(10) NULL,
      field VARCHAR(100) NULL,
      payload TEXT NULL,
      user_agent TEXT NULL,
      auto_banned TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_ip (ip),
      KEY idx_event_type (event_type),
      KEY idx_severity (severity),
      KEY idx_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `,
  `
    CREATE TABLE IF NOT EXISTS banned_ips (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      ip VARCHAR(45) NOT NULL,
      reason TEXT NULL,
      banned_by ENUM('auto','admin') NOT NULL DEFAULT 'auto',
      user_id INT UNSIGNED NULL,
      expire_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_ip_expire (ip, expire_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `,
];

let tablesReady = false;

async function ensureSecurityTables() {
  if (tablesReady) {
    return;
  }

  for (const sql of SECURITY_TABLES_SQL) {
    await db.$executeRawUnsafe(sql).catch(() => undefined);
  }

  tablesReady = true;
}

function compactText(value: unknown, limit: number) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

function normalizeEventType(value: unknown) {
  return compactText(value || 'SECURITY_EVENT', 50)
    .replace(/[^A-Z0-9_:-]/gi, '_')
    .toUpperCase()
    .slice(0, 50) || 'SECURITY_EVENT';
}

function severityFromScore(score: number): SecuritySeverity {
  if (score >= 90) return 'CRITICAL';
  if (score >= 65) return 'HIGH';
  if (score >= 30) return 'MEDIUM';
  return 'LOW';
}

function addPatternScore(input: {
  haystack: string;
  pattern: RegExp;
  score: number;
  reason: string;
  reasons: string[];
}) {
  if (input.pattern.test(input.haystack)) {
    input.reasons.push(input.reason);
    return input.score;
  }
  return 0;
}

function scoreSecurityEvent(input: {
  eventType: string;
  payload: string;
  path: string;
  userAgent: string;
}) {
  const reasons: string[] = [];
  const haystack = `${input.eventType} ${input.path} ${input.payload} ${input.userAgent}`.toLowerCase();
  let riskScore = 0;

  riskScore += addPatternScore({
    haystack,
    pattern: /(union\s+select|information_schema|sleep\s*\(|benchmark\s*\(|load_file\s*\(|into\s+outfile|or\s+1\s*=\s*1|drop\s+table)/i,
    score: 45,
    reason: 'sql_injection_signature',
    reasons,
  });
  riskScore += addPatternScore({
    haystack,
    pattern: /(<script|javascript:|onerror\s*=|onload\s*=|document\.cookie|localstorage|sessionstorage|<\/script>)/i,
    score: 45,
    reason: 'xss_or_cookie_exfiltration_signature',
    reasons,
  });
  riskScore += addPatternScore({
    haystack,
    pattern: /(\.\.\/|\.\.\\|%2e%2e|etc\/passwd|\/proc\/self|boot\.ini)/i,
    score: 40,
    reason: 'path_traversal_signature',
    reasons,
  });
  riskScore += addPatternScore({
    haystack,
    pattern: /(curl\s+|wget\s+|powershell|cmd\.exe|bash\s+-c|nc\s+-e|phpinfo|base64_decode|child_process|process\.env)/i,
    score: 45,
    reason: 'command_or_runtime_probe_signature',
    reasons,
  });
  riskScore += addPatternScore({
    haystack,
    pattern: /(sqlmap|nikto|nuclei|acunetix|wpscan|masscan|zgrab|python-requests|go-http-client|httpclient|headlesschrome)/i,
    score: 45,
    reason: 'scanner_or_automation_signature',
    reasons,
  });

  if (/CONSOLE_OR_TOOL_PASTE_BLOCKED|AUTOMATION_RUNTIME_DETECTED|SUSPICIOUS_CLIENT_STORAGE_ACCESS/.test(input.eventType)) {
    riskScore += 100;
    reasons.push('client_tool_execution_attempt');
  } else if (/DEVTOOLS_OPENED|DEVTOOLS_SHORTCUT/.test(input.eventType)) {
    riskScore += 18;
    reasons.push('developer_tools_signal');
  }

  if (/\/api\/admin|\/admin|\/api\/payment|\/api\/external|\/api\/cron/.test(input.path.toLowerCase())) {
    riskScore += 15;
    reasons.push('sensitive_path');
  }

  return {
    riskScore: Math.min(100, riskScore),
    reasons: reasons.length ? Array.from(new Set(reasons)) : ['low_risk_observation'],
  };
}

async function readSecurityUser(userId: number | null | undefined): Promise<SecurityUser | null> {
  const safeUserId = Math.trunc(Number(userId || 0));
  if (!safeUserId) {
    return null;
  }

  return db.users.findUnique({
    where: { id: safeUserId },
    select: {
      id: true,
      role: true,
      status: true,
    },
  }).catch(() => null);
}

function isPrivilegedRole(role: unknown) {
  const normalized = String(role || '').trim().toLowerCase();
  return normalized === 'owner' || normalized === 'admin';
}

async function countRecentHighRiskEvents(ip: string, userId: number | null) {
  const rows = await db.$queryRawUnsafe<Array<{ total: number | bigint }>>(
    `
      SELECT COUNT(*) AS total
      FROM security_logs
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 10 MINUTE)
        AND (ip = ? OR (? IS NOT NULL AND user_id = ?))
        AND severity IN ('HIGH', 'CRITICAL')
    `,
    ip,
    userId,
    userId
  ).catch(() => []);

  return Number(rows[0]?.total || 0);
}

async function banSecuritySubject(input: {
  ip: string;
  user: SecurityUser | null;
  reason: string;
}) {
  if (isTrackableIp(input.ip)) {
    const updated = await db.$executeRawUnsafe(
      `
        UPDATE banned_ips
        SET reason = ?, banned_by = 'auto', user_id = ?, expire_at = NULL, created_at = NOW()
        WHERE ip = ?
      `,
      input.reason,
      input.user?.id || null,
      input.ip
    ).catch(() => 0);

    if (Number(updated || 0) === 0) {
      await db.$executeRawUnsafe(
        `
          INSERT INTO banned_ips (ip, reason, banned_by, user_id, expire_at, created_at)
          VALUES (?, ?, 'auto', ?, NULL, NOW())
        `,
        input.ip,
        input.reason,
        input.user?.id || null
      ).catch(() => undefined);
    }
  }

  if (input.user?.id && !isPrivilegedRole(input.user.role)) {
    await db.users.update({
      where: { id: input.user.id },
      data: {
        status: 'banned',
        lock_reason: input.reason,
        locked_at: new Date(),
      },
    }).catch(() => undefined);
    invalidateSessionUserCache(input.user.id);
  }

  await sendSecurityAlertEmail({
    event: 'SECURITY_SUBJECT_BANNED',
    title: 'IP/tài khoản bị khóa do hành vi chạy code hoặc tool',
    severity: 'CRITICAL',
    ip: input.ip,
    userId: input.user?.id || null,
    reason: input.reason,
    details: {
      role: input.user?.role || null,
      user_status_before: input.user?.status || null,
    },
    cooldownKey: `security-ban:${input.ip}:${input.user?.id || 'ip'}`,
  }).catch(() => undefined);
}

export async function recordSecurityEvent(req: NextRequest, input: SecurityEventInput): Promise<SecurityVerdict> {
  await ensureSecurityTables();

  const ip = getRequestIp(req);
  const userAgent = compactText(req.headers.get('user-agent'), 500);
  const eventType = normalizeEventType(input.eventType);
  const field = compactText(input.field, 100) || null;
  const payload = compactText(input.payload || JSON.stringify(input.details || {}), 2000);
  const user = await readSecurityUser(input.userId || null);
  const score = scoreSecurityEvent({
    eventType,
    payload,
    path: req.nextUrl.pathname,
    userAgent,
  });
  const recentHighRisk = isTrackableIp(ip) ? await countRecentHighRiskEvents(ip, user?.id || null) : 0;
  const riskScore = Math.min(100, score.riskScore + (recentHighRisk >= 2 ? 20 : 0));
  const severity = severityFromScore(riskScore);
  const shouldBan = riskScore >= 95 || (riskScore >= 80 && recentHighRisk >= 2);
  const reason = `AI security guard blocked suspicious behavior: ${score.reasons.join(', ')}`;

  await logSecurityEvent({
    eventType,
    severity,
    ip,
    userId: user?.id || null,
    uri: req.nextUrl.pathname,
    method: req.method,
    field,
    payload,
    userAgent,
    autoBanned: shouldBan,
  });

  if (shouldBan && !isPrivilegedRole(user?.role)) {
    await banSecuritySubject({
      ip,
      user,
      reason,
    });
  }

  return {
    severity,
    riskScore,
    reasons: score.reasons,
    autoBanned: Boolean(shouldBan && isTrackableIp(ip)),
    bannedUser: Boolean(shouldBan && user?.id && !isPrivilegedRole(user.role)),
  };
}
