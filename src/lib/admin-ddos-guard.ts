import { db } from '@/lib/db';
import { getAdminAlertEmailConfig, sendSystemEmail } from '@/lib/admin-alert-email';
import { formatDatabaseDateTime, serializeAbsoluteDateTime } from '@/lib/date-time';
import { tableExists } from '@/lib/legacy-modules';
import { isTrackableIp } from '@/lib/ip-security';
import { sendSecurityAlertEmail } from '@/lib/security-alert-email';
import { toNumber } from '@/lib/utils';

const DDOS_ALERT_STATE_KEY = 'admin_ddos_alert_state';
const DEFAULT_WINDOW_MINUTES = 10;
const DEFAULT_ACTIVITY_THRESHOLD = 30;
const DEFAULT_SECURITY_THRESHOLD = 8;
const DEFAULT_EMAIL_COOLDOWN_MINUTES = 30;

interface DdosActivityRow {
  ip: string | null;
  total_events: number | bigint;
  distinct_users: number | bigint | null;
  distinct_actions: number | bigint | null;
  first_seen: Date | string | null;
  last_seen: Date | string | null;
  sample_activities: string | null;
}

interface DdosSecurityRow {
  ip: string | null;
  total_events: number | bigint;
  critical_events: number | bigint | null;
  high_events: number | bigint | null;
  first_seen: Date | string | null;
  last_seen: Date | string | null;
  sample_event_types: string | null;
}

interface DdosAccountRow {
  ip: string | null;
  accounts_count: number | bigint;
}

interface DdosBanRow {
  ip: string;
}

interface DdosSignal {
  ip: string;
  activity_events: number;
  security_events: number;
  critical_security_events: number;
  high_security_events: number;
  distinct_users: number;
  distinct_actions: number;
  accounts_count: number;
  first_seen: string | null;
  last_seen: string | null;
  sample_activities: string[];
  sample_event_types: string[];
  already_blocked: boolean;
  weighted_score: number;
}

export interface DdosReport {
  generated_at: string;
  window_minutes: number;
  window_start: string;
  window_end: string;
  thresholds: {
    activity_events: number;
    security_events: number;
  };
  suspicious_ips: DdosSignal[];
}

function numberFromEnv(name: string, fallback: number) {
  const value = Number(process.env[name] || fallback);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

function numberFromUnknown(value: unknown, fallback = 0) {
  return Math.max(0, Math.trunc(toNumber(value, fallback)));
}

function splitSamples(value: string | null | undefined) {
  return String(value || '')
    .split(/\s*\|\s*|\s*,\s*/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function serializeMaybeDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : serializeAbsoluteDateTime(parsed);
}

async function readAlertState() {
  const row = await db.settings.findFirst({
    where: { setting_key: DDOS_ALERT_STATE_KEY },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      setting_value: true,
    },
  }).catch(() => null);

  if (!row?.setting_value) {
    return {
      id: row?.id || null,
      signature: '',
      sent_at: '',
    };
  }

  try {
    const parsed = JSON.parse(String(row.setting_value));
    return {
      id: row.id,
      signature: String(parsed.signature || ''),
      sent_at: String(parsed.sent_at || ''),
    };
  } catch {
    return {
      id: row.id,
      signature: '',
      sent_at: '',
    };
  }
}

async function saveAlertState(signature: string, sentAt: string) {
  const existing = await db.settings.findFirst({
    where: { setting_key: DDOS_ALERT_STATE_KEY },
    orderBy: { id: 'asc' },
    select: { id: true },
  }).catch(() => null);

  const payload = JSON.stringify({ signature, sent_at: sentAt });

  if (existing?.id) {
    await db.settings.update({
      where: { id: existing.id },
      data: {
        setting_value: payload,
        updated_at: new Date(),
      },
    });
    return;
  }

  await db.settings.create({
    data: {
      setting_key: DDOS_ALERT_STATE_KEY,
      setting_value: payload,
    },
  });
}

function buildSignature(report: DdosReport) {
  return report.suspicious_ips
    .map((item) => `${item.ip}:${item.activity_events}:${item.security_events}:${item.weighted_score}`)
    .join('|');
}

function shouldSkipEmailByCooldown(state: { signature: string; sent_at: string }, signature: string) {
  if (!state.signature || !state.sent_at || state.signature !== signature) {
    return false;
  }

  const sentAt = new Date(state.sent_at);
  if (Number.isNaN(sentAt.getTime())) {
    return false;
  }

  const cooldownMinutes = numberFromEnv('DDOS_EMAIL_COOLDOWN_MINUTES', DEFAULT_EMAIL_COOLDOWN_MINUTES);
  return Date.now() - sentAt.getTime() < cooldownMinutes * 60 * 1000;
}

export async function collectPotentialDdosSignals(input: {
  windowMinutes?: number;
  activityThreshold?: number;
  securityThreshold?: number;
  limit?: number;
} = {}): Promise<DdosReport> {
  const windowMinutes = input.windowMinutes || numberFromEnv('DDOS_WINDOW_MINUTES', DEFAULT_WINDOW_MINUTES);
  const activityThreshold = input.activityThreshold || numberFromEnv('DDOS_ACTIVITY_THRESHOLD', DEFAULT_ACTIVITY_THRESHOLD);
  const securityThreshold = input.securityThreshold || numberFromEnv('DDOS_SECURITY_THRESHOLD', DEFAULT_SECURITY_THRESHOLD);
  const limit = Math.max(1, Math.min(Number(input.limit || 20), 50));

  const now = new Date();
  const since = new Date(now.getTime() - windowMinutes * 60 * 1000);
  const hasSecurityLogs = await tableExists('security_logs');

  const [activityRows, securityRows] = await Promise.all([
    db.$queryRawUnsafe<DdosActivityRow[]>(`
      SELECT
        ip_address AS ip,
        COUNT(*) AS total_events,
        COUNT(DISTINCT COALESCE(user_id, 0)) AS distinct_users,
        COUNT(DISTINCT LEFT(activity, 80)) AS distinct_actions,
        MIN(created_at) AS first_seen,
        MAX(created_at) AS last_seen,
        SUBSTRING_INDEX(GROUP_CONCAT(LEFT(activity, 80) ORDER BY id DESC SEPARATOR ' | '), ' | ', 6) AS sample_activities
      FROM activity_logs
      WHERE created_at >= ?
        AND ip_address IS NOT NULL
        AND ip_address <> ''
      GROUP BY ip_address
      HAVING COUNT(*) >= ?
      ORDER BY total_events DESC, last_seen DESC
      LIMIT ?
    `, since, Math.max(5, Math.floor(activityThreshold / 2)), limit * 2).catch(() => []),
    hasSecurityLogs
      ? db.$queryRawUnsafe<DdosSecurityRow[]>(`
          SELECT
            ip,
            COUNT(*) AS total_events,
            SUM(CASE WHEN severity = 'CRITICAL' THEN 1 ELSE 0 END) AS critical_events,
            SUM(CASE WHEN severity = 'HIGH' THEN 1 ELSE 0 END) AS high_events,
            MIN(created_at) AS first_seen,
            MAX(created_at) AS last_seen,
            SUBSTRING_INDEX(GROUP_CONCAT(event_type ORDER BY id DESC SEPARATOR ', '), ', ', 8) AS sample_event_types
          FROM security_logs
          WHERE created_at >= ?
            AND ip IS NOT NULL
            AND ip <> ''
          GROUP BY ip
          HAVING COUNT(*) >= ?
          ORDER BY total_events DESC, last_seen DESC
          LIMIT ?
        `, since, Math.max(2, Math.floor(securityThreshold / 2)), limit * 2).catch(() => [])
      : Promise.resolve([]),
  ]);

  const ipSet = new Set<string>();
  for (const row of activityRows) {
    const ip = String(row.ip || '').trim();
    if (isTrackableIp(ip)) ipSet.add(ip);
  }
  for (const row of securityRows) {
    const ip = String(row.ip || '').trim();
    if (isTrackableIp(ip)) ipSet.add(ip);
  }

  const ips = Array.from(ipSet);
  const [accountRows, banRows] = ips.length > 0
    ? await Promise.all([
        db.$queryRawUnsafe<DdosAccountRow[]>(`
          SELECT last_ip AS ip, COUNT(*) AS accounts_count
          FROM users
          WHERE last_ip IN (${ips.map(() => '?').join(',')})
          GROUP BY last_ip
        `, ...ips).catch(() => []),
        db.$queryRawUnsafe<DdosBanRow[]>(`
          SELECT ip
          FROM banned_ips
          WHERE ip IN (${ips.map(() => '?').join(',')})
            AND (expire_at IS NULL OR expire_at > NOW())
        `, ...ips).catch(() => []),
      ])
    : [[], []];

  const accountMap = new Map(accountRows.map((row) => [String(row.ip || '').trim(), numberFromUnknown(row.accounts_count)]));
  const bannedSet = new Set(banRows.map((row) => String(row.ip || '').trim()).filter(Boolean));
  const activityMap = new Map(activityRows.map((row) => [String(row.ip || '').trim(), row]));
  const securityMap = new Map(securityRows.map((row) => [String(row.ip || '').trim(), row]));

  const suspiciousIps = ips
    .map((ip) => {
      const activity = activityMap.get(ip);
      const security = securityMap.get(ip);
      const activityEvents = numberFromUnknown(activity?.total_events);
      const securityEvents = numberFromUnknown(security?.total_events);
      const criticalEvents = numberFromUnknown(security?.critical_events);
      const highEvents = numberFromUnknown(security?.high_events);
      const distinctUsers = numberFromUnknown(activity?.distinct_users);
      const distinctActions = numberFromUnknown(activity?.distinct_actions);
      const weightedScore = activityEvents + securityEvents * 2 + criticalEvents * 3 + highEvents * 2;

      return {
        ip,
        activity_events: activityEvents,
        security_events: securityEvents,
        critical_security_events: criticalEvents,
        high_security_events: highEvents,
        distinct_users: distinctUsers,
        distinct_actions: distinctActions,
        accounts_count: accountMap.get(ip) || 0,
        first_seen: serializeMaybeDate(activity?.first_seen || security?.first_seen),
        last_seen: serializeMaybeDate(activity?.last_seen || security?.last_seen),
        sample_activities: splitSamples(activity?.sample_activities),
        sample_event_types: splitSamples(security?.sample_event_types),
        already_blocked: bannedSet.has(ip),
        weighted_score: weightedScore,
      } satisfies DdosSignal;
    })
    .filter((item) => item.activity_events >= activityThreshold || item.security_events >= securityThreshold)
    .sort((a, b) => b.weighted_score - a.weighted_score || b.activity_events - a.activity_events)
    .slice(0, limit);

  return {
    generated_at: serializeAbsoluteDateTime(now),
    window_minutes: windowMinutes,
    window_start: serializeAbsoluteDateTime(since),
    window_end: serializeAbsoluteDateTime(now),
    thresholds: {
      activity_events: activityThreshold,
      security_events: securityThreshold,
    },
    suspicious_ips: suspiciousIps,
  };
}

async function blockIpForDdos(ip: string, reason: string, adminId?: number | null) {
  const bannedBy = adminId ? 'admin' : 'auto';
  const updated = await db.$executeRawUnsafe(`
    UPDATE banned_ips
    SET reason = ?, banned_by = ?, user_id = ?, expire_at = NULL, created_at = NOW()
    WHERE ip = ?
  `, reason, bannedBy, adminId || null, ip);

  if (Number(updated || 0) === 0) {
    await db.$executeRawUnsafe(`
      INSERT INTO banned_ips (ip, reason, banned_by, user_id, expire_at)
      VALUES (?, ?, ?, ?, NULL)
    `, ip, reason, bannedBy, adminId || null);
  }

  await db.$executeRawUnsafe(`
    INSERT INTO security_logs (event_type, severity, ip, user_id, uri, method, field, payload, user_agent, auto_banned)
    VALUES ('DDOS_AUTO_BAN', 'CRITICAL', ?, ?, '/api/cron/run', 'SYSTEM', 'ip', ?, ?, 1)
  `, ip, adminId || null, reason, adminId ? 'admin-ai' : 'auto-ddos-guard').catch(() => undefined);

  await sendSecurityAlertEmail({
    event: 'DDOS_AUTO_BAN',
    title: 'AI DDoS guard đã khóa IP',
    severity: 'CRITICAL',
    ip,
    userId: adminId || null,
    reason,
    path: '/api/cron/run',
    method: 'SYSTEM',
    userAgent: adminId ? 'admin-ai' : 'auto-ddos-guard',
    cooldownKey: `ddos-auto-ban:${ip}`,
  }).catch(() => undefined);
}

function buildAlertText(report: DdosReport, blockedIps: string[]) {
  const lines = [
    `Phat hien ${report.suspicious_ips.length} IP co dau hieu DDOS trong ${report.window_minutes} phut gan nhat.`,
    `Khung thoi gian: ${report.window_start} -> ${report.window_end}.`,
    `Nguong canh bao: >= ${report.thresholds.activity_events} activity logs hoac >= ${report.thresholds.security_events} security logs.`,
    '',
  ];

  for (const signal of report.suspicious_ips.slice(0, 10)) {
    lines.push(
      `- ${signal.ip}: activity=${signal.activity_events}, security=${signal.security_events}, critical=${signal.critical_security_events}, blocked=${blockedIps.includes(signal.ip) ? 'yes' : signal.already_blocked ? 'already' : 'no'}`
    );
  }

  lines.push('');
  lines.push(`IP vua bi block: ${blockedIps.length > 0 ? blockedIps.join(', ') : 'khong co ip moi nao bi block'}.`);

  return lines.join('\n');
}

function buildAlertHtml(report: DdosReport, blockedIps: string[]) {
  const rows = report.suspicious_ips
    .map((signal) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid rgba(148,163,184,0.16);">${signal.ip}</td>
        <td style="padding:10px 12px;border-bottom:1px solid rgba(148,163,184,0.16);text-align:right;">${signal.activity_events}</td>
        <td style="padding:10px 12px;border-bottom:1px solid rgba(148,163,184,0.16);text-align:right;">${signal.security_events}</td>
        <td style="padding:10px 12px;border-bottom:1px solid rgba(148,163,184,0.16);text-align:right;">${signal.critical_security_events}</td>
        <td style="padding:10px 12px;border-bottom:1px solid rgba(148,163,184,0.16);">${blockedIps.includes(signal.ip) ? 'Blocked now' : signal.already_blocked ? 'Already blocked' : 'Observed'}</td>
      </tr>
    `)
    .join('');

  return `
    <div style="font-family:Arial,sans-serif;background:#0f172a;color:#e5eefb;padding:24px;">
      <div style="max-width:900px;margin:0 auto;background:#111827;border:1px solid rgba(148,163,184,0.22);border-radius:20px;padding:24px;">
        <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#93c5fd;">TRUNGTAMMMO DDOS guard</div>
        <h1 style="margin:12px 0 6px;font-size:28px;line-height:1.2;color:#ffffff;">Canh bao DDOS / request burst</h1>
        <p style="margin:0 0 18px;color:#94a3b8;">Khung thoi gian: ${formatDatabaseDateTime(report.window_start)} - ${formatDatabaseDateTime(report.window_end)}</p>
        <div style="background:#0b1220;border-radius:14px;padding:14px;border:1px solid rgba(148,163,184,0.14);margin-bottom:18px;">
          <div style="font-size:13px;color:#cbd5e1;">Phat hien <strong>${report.suspicious_ips.length}</strong> IP dang co dau hieu tan cong. IP moi bi block: <strong>${blockedIps.length}</strong>.</div>
        </div>
        <table style="width:100%;border-collapse:collapse;background:#0b1220;border-radius:14px;overflow:hidden;">
          <thead>
            <tr style="text-align:left;color:#93c5fd;">
              <th style="padding:10px 12px;">IP</th>
              <th style="padding:10px 12px;text-align:right;">Activity</th>
              <th style="padding:10px 12px;text-align:right;">Security</th>
              <th style="padding:10px 12px;text-align:right;">Critical</th>
              <th style="padding:10px 12px;">Trang thai</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
  `;
}

export async function runDdosGuard(input: {
  windowMinutes?: number;
  activityThreshold?: number;
  securityThreshold?: number;
  autoBlock?: boolean;
  sendEmail?: boolean;
  forceEmail?: boolean;
  adminId?: number | null;
} = {}) {
  const report = await collectPotentialDdosSignals(input);
  if (report.suspicious_ips.length === 0) {
    return {
      detected: 0,
      blocked: 0,
      emailed: false,
      skipped_email: true,
      reason: 'Khong thay IP nao vuot nguong DDOS trong cua so hien tai.',
      report,
    };
  }

  const blockedIps: string[] = [];
  if (input.autoBlock !== false) {
    for (const signal of report.suspicious_ips) {
      if (signal.already_blocked) {
        continue;
      }

      const reason = `Auto DDOS guard: ${signal.activity_events} activity logs, ${signal.security_events} security logs trong ${report.window_minutes} phut.`;
      await blockIpForDdos(signal.ip, reason, input.adminId || null);
      blockedIps.push(signal.ip);
    }
  }

  let emailed = false;
  let skippedEmail = true;
  let emailReason = 'Gui email ddos dang tat.';
  const shouldSendEmail = input.sendEmail !== false;
  if (shouldSendEmail) {
    const signature = buildSignature(report);
    const state = await readAlertState();
    const alertConfig = await getAdminAlertEmailConfig();

    if (!input.forceEmail && shouldSkipEmailByCooldown(state, signature)) {
      emailReason = 'Canh bao cung fingerprint da duoc gui gan day, bo qua de tranh spam.';
    } else {
      const email = await sendSystemEmail({
        to: alertConfig.recipients,
        subject: `[TRUNGTAMMMO] DDOS alert ${formatDatabaseDateTime(report.generated_at)}`,
        text: buildAlertText(report, blockedIps),
        html: buildAlertHtml(report, blockedIps),
        from: alertConfig.from,
      });
      emailed = Boolean(email.sent);
      skippedEmail = Boolean(email.skipped);
      emailReason = email.sent ? `Da gui email toi ${alertConfig.recipients.join(', ')}` : String(email.reason || '');

      if (email.sent) {
        await saveAlertState(signature, new Date().toISOString()).catch(() => undefined);
      }
    }
  }

  await db.activity_logs.create({
    data: {
      activity: `ddos guard detected=${report.suspicious_ips.length} blocked=${blockedIps.length} emailed=${emailed}: ${JSON.stringify(report.suspicious_ips.slice(0, 8)).slice(0, 900)}`,
      user_id: input.adminId || undefined,
      user_agent: input.adminId ? 'admin-ai-ddos-guard' : 'cron-ddos-guard',
    },
  }).catch(() => undefined);

  return {
    detected: report.suspicious_ips.length,
    blocked: blockedIps.length,
    blocked_ips: blockedIps,
    emailed,
    skipped_email: skippedEmail,
    email_reason: emailReason,
    report,
  };
}
