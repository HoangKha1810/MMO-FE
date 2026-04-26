import OpenAI from 'openai';
import { db } from '@/lib/db';
import { formatDatabaseDateTime, serializeDatabaseDateTime } from '@/lib/date-time';
import { getAdminAlertEmailConfig, sendAdminAlertEmail } from '@/lib/admin-alert-email';
import { safeCount, safeRows, tableExists, type LegacyRow } from '@/lib/legacy-modules';
import { toNumber } from '@/lib/utils';

const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const DIGEST_LAST_SENT_SETTING_KEY = 'admin_alert_digest_last_sent_date';
const DEFAULT_DEPOSIT_THRESHOLD = 500_000;
const DEFAULT_WITHDRAW_THRESHOLD = 500_000;

let digestOpenAiClient: OpenAI | null = null;

interface AdminAnomalyReport {
  generated_at: string;
  vietnam_day_key: string;
  window_start: string;
  window_end: string;
  severity: 'info' | 'warning' | 'critical';
  metrics: {
    total_pending_deposits: number;
    stale_pending_deposits: number;
    high_value_deposits: number;
    high_value_withdrawals: number;
    risky_ips: number;
    severe_security_events: number;
    recent_locked_users: number;
    high_risk_admin_actions: number;
  };
  thresholds: {
    deposit_amount_vnd: number;
    withdraw_amount_vnd: number;
  };
  sections: {
    high_value_deposits: LegacyRow[];
    high_value_withdrawals: LegacyRow[];
    stale_pending_deposits: LegacyRow[];
    multi_attempt_deposit_users: LegacyRow[];
    risky_registration_ips: LegacyRow[];
    security_events: LegacyRow[];
    recent_locked_users: LegacyRow[];
    high_risk_admin_actions: LegacyRow[];
  };
}

function numberFromEnv(name: string, fallback: number) {
  const value = Number(process.env[name] || fallback);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

function formatMoney(value: unknown) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(toNumber(value, 0)));
}

function vietnamDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: VIETNAM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function displayDigestDate(date = new Date()) {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: VIETNAM_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getDigestOpenAiClient() {
  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!apiKey) {
    return null;
  }

  if (!digestOpenAiClient) {
    digestOpenAiClient = new OpenAI({ apiKey });
  }

  return digestOpenAiClient;
}

async function readDigestLastSentDate() {
  const setting = await db.settings.findFirst({
    where: { setting_key: DIGEST_LAST_SENT_SETTING_KEY },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      setting_value: true,
    },
  }).catch(() => null);

  return {
    id: setting?.id || null,
    value: String(setting?.setting_value || '').trim(),
  };
}

async function saveDigestLastSentDate(dayKey: string) {
  const existing = await db.settings.findFirst({
    where: { setting_key: DIGEST_LAST_SENT_SETTING_KEY },
    orderBy: { id: 'asc' },
    select: { id: true },
  }).catch(() => null);

  if (existing?.id) {
    await db.settings.update({
      where: { id: existing.id },
      data: {
        setting_value: dayKey,
        updated_at: new Date(),
      },
    });
    return;
  }

  await db.settings.create({
    data: {
      setting_key: DIGEST_LAST_SENT_SETTING_KEY,
      setting_value: dayKey,
    },
  });
}

function deriveSeverity(report: Omit<AdminAnomalyReport, 'severity'>): AdminAnomalyReport['severity'] {
  let score = 0;

  if (report.metrics.stale_pending_deposits >= 5) score += 2;
  if (report.metrics.high_value_deposits >= 2) score += 2;
  if (report.metrics.high_value_withdrawals >= 1) score += 2;
  if (report.metrics.risky_ips >= 1) score += 1;
  if (report.metrics.severe_security_events >= 3) score += 2;
  if (report.metrics.recent_locked_users >= 3) score += 1;
  if (report.metrics.high_risk_admin_actions >= 5) score += 1;

  if (score >= 6) return 'critical';
  if (score >= 3) return 'warning';
  return 'info';
}

async function collectAnomalyRows() {
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const stalePendingBefore = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const depositThreshold = numberFromEnv('ADMIN_ALERT_DEPOSIT_THRESHOLD', DEFAULT_DEPOSIT_THRESHOLD);
  const withdrawThreshold = numberFromEnv('ADMIN_ALERT_WITHDRAW_THRESHOLD', DEFAULT_WITHDRAW_THRESHOLD);

  const [
    highValueDeposits,
    highValueWithdrawals,
    stalePendingDeposits,
    multiAttemptDepositUsers,
    riskyRegistrationIps,
    securityEvents,
    recentLockedUsers,
    highRiskAdminActions,
    totalPendingDeposits,
    stalePendingCount,
  ] = await Promise.all([
    safeRows<LegacyRow>(`
      SELECT
        t.id,
        t.user_id,
        u.username,
        u.email,
        t.amount,
        t.status,
        t.content,
        t.created_at
      FROM transactions t
      LEFT JOIN users u ON u.id = t.user_id
      WHERE t.type = 'deposit'
        AND t.created_at >= ?
        AND t.amount >= ?
      ORDER BY t.amount DESC, t.id DESC
      LIMIT 12
    `, since, depositThreshold),
    safeRows<LegacyRow>(`
      SELECT
        t.id,
        t.user_id,
        u.username,
        u.email,
        t.amount,
        t.status,
        t.content,
        t.created_at
      FROM transactions t
      LEFT JOIN users u ON u.id = t.user_id
      WHERE t.type = 'withdraw'
        AND t.created_at >= ?
        AND t.amount >= ?
      ORDER BY t.amount DESC, t.id DESC
      LIMIT 12
    `, since, withdrawThreshold),
    safeRows<LegacyRow>(`
      SELECT
        t.id,
        t.user_id,
        u.username,
        u.email,
        t.amount,
        t.status,
        t.content,
        t.created_at,
        TIMESTAMPDIFF(MINUTE, t.created_at, NOW()) AS pending_minutes
      FROM transactions t
      LEFT JOIN users u ON u.id = t.user_id
      WHERE t.type = 'deposit'
        AND t.status = 'pending'
        AND t.created_at <= ?
      ORDER BY t.created_at ASC
      LIMIT 20
    `, stalePendingBefore),
    safeRows<LegacyRow>(`
      SELECT
        t.user_id,
        u.username,
        u.email,
        COUNT(*) AS attempts,
        SUM(t.amount) AS total_amount,
        SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
        MIN(t.created_at) AS first_at,
        MAX(t.created_at) AS last_at
      FROM transactions t
      LEFT JOIN users u ON u.id = t.user_id
      WHERE t.type = 'deposit'
        AND t.created_at >= ?
      GROUP BY t.user_id, u.username, u.email
      HAVING COUNT(*) >= 3
      ORDER BY attempts DESC, total_amount DESC
      LIMIT 12
    `, since),
    safeRows<LegacyRow>(`
      SELECT
        last_ip AS ip,
        COUNT(*) AS accounts_count,
        MIN(created_at) AS first_at,
        MAX(created_at) AS last_at,
        SUBSTRING_INDEX(GROUP_CONCAT(CONCAT(username, '#', id) ORDER BY id DESC SEPARATOR ', '), ', ', 8) AS sample_users
      FROM users
      WHERE created_at >= ?
        AND last_ip IS NOT NULL
        AND last_ip <> ''
      GROUP BY last_ip
      HAVING COUNT(*) >= 3
      ORDER BY accounts_count DESC, last_at DESC
      LIMIT 12
    `, since),
    (await tableExists('security_logs'))
      ? safeRows<LegacyRow>(`
        SELECT
          id,
          event_type,
          severity,
          ip,
          user_id,
          uri,
          method,
          auto_banned,
          created_at
        FROM security_logs
        WHERE created_at >= ?
          AND severity IN ('HIGH', 'CRITICAL')
        ORDER BY created_at DESC
        LIMIT 20
      `, since)
      : Promise.resolve([]),
    safeRows<LegacyRow>(`
      SELECT
        id,
        username,
        email,
        status,
        lock_reason,
        last_ip,
        locked_at,
        updated_at
      FROM users
      WHERE status IN ('locked', 'banned', 'suspended')
        AND COALESCE(locked_at, updated_at, created_at) >= ?
      ORDER BY COALESCE(locked_at, updated_at, created_at) DESC
      LIMIT 15
    `, since),
    safeRows<LegacyRow>(`
      SELECT
        id,
        user_id,
        activity,
        ip_address,
        created_at
      FROM activity_logs
      WHERE created_at >= ?
        AND (
          activity LIKE '%ban user%'
          OR activity LIKE '%reject deposit%'
          OR activity LIKE '%refund%'
          OR activity LIKE '%registration-ip%'
          OR activity LIKE '%admin_ai:run_database_mutation%'
          OR activity LIKE '%admin_ai:write_workspace_file%'
          OR activity LIKE '%admin_ai:delete_admin_resource_record%'
        )
      ORDER BY created_at DESC
      LIMIT 20
    `, since),
    safeCount(`
      SELECT COUNT(*) AS total
      FROM transactions
      WHERE type = 'deposit'
        AND status = 'pending'
    `),
    safeCount(`
      SELECT COUNT(*) AS total
      FROM transactions
      WHERE type = 'deposit'
        AND status = 'pending'
        AND created_at <= ?
    `, stalePendingBefore),
  ]);

  const baseReport = {
    generated_at: serializeDatabaseDateTime(now),
    vietnam_day_key: vietnamDateKey(now),
    window_start: serializeDatabaseDateTime(since),
    window_end: serializeDatabaseDateTime(now),
    metrics: {
      total_pending_deposits: totalPendingDeposits,
      stale_pending_deposits: stalePendingCount,
      high_value_deposits: highValueDeposits.length,
      high_value_withdrawals: highValueWithdrawals.length,
      risky_ips: riskyRegistrationIps.length,
      severe_security_events: securityEvents.length,
      recent_locked_users: recentLockedUsers.length,
      high_risk_admin_actions: highRiskAdminActions.length,
    },
    thresholds: {
      deposit_amount_vnd: depositThreshold,
      withdraw_amount_vnd: withdrawThreshold,
    },
    sections: {
      high_value_deposits: highValueDeposits,
      high_value_withdrawals: highValueWithdrawals,
      stale_pending_deposits: stalePendingDeposits,
      multi_attempt_deposit_users: multiAttemptDepositUsers,
      risky_registration_ips: riskyRegistrationIps,
      security_events: securityEvents,
      recent_locked_users: recentLockedUsers,
      high_risk_admin_actions: highRiskAdminActions,
    },
  };

  return {
    ...baseReport,
    severity: deriveSeverity(baseReport),
  } satisfies AdminAnomalyReport;
}

function buildFallbackDigestSummary(report: AdminAnomalyReport) {
  const lines = [
    `Tong quan: muc do ${report.severity.toUpperCase()} trong 24h qua (${report.window_start} -> ${report.window_end}).`,
    `Pending nap tien: ${report.metrics.total_pending_deposits}, treo hon 2h: ${report.metrics.stale_pending_deposits}.`,
    `Giao dich lon: ${report.metrics.high_value_deposits} lenh nap >= ${formatMoney(report.thresholds.deposit_amount_vnd)} VND, ${report.metrics.high_value_withdrawals} lenh rut >= ${formatMoney(report.thresholds.withdraw_amount_vnd)} VND.`,
    `Hanh vi bat thuong: ${report.metrics.risky_ips} IP dang ky nhieu tai khoan, ${report.metrics.severe_security_events} security event muc HIGH/CRITICAL, ${report.metrics.recent_locked_users} user vua bi khoa/ban.`,
    `Hanh dong admin can xem lai: ${report.metrics.high_risk_admin_actions} log rui ro cao.`,
  ];

  if (report.sections.stale_pending_deposits.length > 0) {
    const top = report.sections.stale_pending_deposits
      .slice(0, 3)
      .map((row) => `#${row.id} ${row.username || `UID ${row.user_id}`} ${formatMoney(row.amount)}d pending ${row.pending_minutes} phut`)
      .join('; ');
    lines.push(`Mau can uu tien: ${top}.`);
  } else {
    lines.push('Chua thay pending deposit treo lau can xu ly tay ngay luc nay.');
  }

  lines.push('Khuyen nghi: uu tien doi soat pending SePay treo lau, review giao dich lon, va kiem tra cac IP tao nhieu tai khoan trong ngay.');

  return lines.join('\n');
}

async function generateAiDigestSummary(report: AdminAnomalyReport) {
  const client = getDigestOpenAiClient();
  if (!client) {
    return buildFallbackDigestSummary(report);
  }

  const model = process.env.OPENAI_ADMIN_DIGEST_MODEL || process.env.OPENAI_ADMIN_MODEL || 'gpt-5.4';
  const prompt = JSON.stringify(report);

  try {
    const response = await client.responses.create({
      model,
      instructions: [
        'Bạn là chuyên gia rủi ro nội bộ của TRUNGTAMMMO.',
        'Hãy viết bản tóm tắt email tiếng Việt thật ngắn gọn nhưng sắc bén cho admin.',
        'Chỉ nêu điều bất thường thực sự đáng chú ý trong 24 giờ qua.',
        'Luôn có 4 phần với tiêu đề ngắn: Tong quan, Giao dich bat thuong, Hanh vi bat thuong, Hanh dong de xuat.',
        'Nếu một phần không có dữ liệu đáng kể, ghi rõ là chưa thấy điểm nổi bật.',
        'Không bịa dữ liệu ngoài JSON đầu vào.',
      ].join(' '),
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: prompt,
            },
          ],
        },
      ],
    });

    const summary = String(response.output_text || '').trim();
    return summary || buildFallbackDigestSummary(report);
  } catch {
    return buildFallbackDigestSummary(report);
  }
}

function renderDigestHtml(summary: string, report: AdminAnomalyReport) {
  const summaryHtml = escapeHtml(summary).replace(/\n/g, '<br />');

  return `
    <div style="font-family:Arial,sans-serif;background:#0f172a;color:#e5eefb;padding:24px;">
      <div style="max-width:820px;margin:0 auto;background:#111827;border:1px solid rgba(148,163,184,0.22);border-radius:20px;padding:24px;">
        <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#93c5fd;">TRUNGTAMMMO daily anomaly digest</div>
        <h1 style="margin:12px 0 6px;font-size:28px;line-height:1.2;color:#ffffff;">Bao cao bat thuong ngay ${escapeHtml(displayDigestDate())}</h1>
        <p style="margin:0 0 18px;color:#94a3b8;">Khung thoi gian: ${escapeHtml(formatDatabaseDateTime(report.window_start))} - ${escapeHtml(formatDatabaseDateTime(report.window_end))}</p>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:0 0 20px;">
          <div style="background:#0b1220;border-radius:14px;padding:14px;border:1px solid rgba(148,163,184,0.14);">
            <div style="font-size:12px;color:#93c5fd;">Pending deposits</div>
            <div style="font-size:24px;font-weight:700;color:#ffffff;">${report.metrics.total_pending_deposits}</div>
            <div style="font-size:13px;color:#94a3b8;">${report.metrics.stale_pending_deposits} lenh treo hon 2 gio</div>
          </div>
          <div style="background:#0b1220;border-radius:14px;padding:14px;border:1px solid rgba(148,163,184,0.14);">
            <div style="font-size:12px;color:#93c5fd;">Security / IP</div>
            <div style="font-size:24px;font-weight:700;color:#ffffff;">${report.metrics.severe_security_events + report.metrics.risky_ips}</div>
            <div style="font-size:13px;color:#94a3b8;">${report.metrics.severe_security_events} security event, ${report.metrics.risky_ips} IP rui ro</div>
          </div>
        </div>
        <div style="background:#0b1220;border-radius:16px;padding:18px;border:1px solid rgba(148,163,184,0.14);line-height:1.75;color:#e2e8f0;">${summaryHtml}</div>
      </div>
    </div>
  `;
}

export async function runDailyAdminAnomalyDigest() {
  const alertConfig = await getAdminAlertEmailConfig();
  if (!alertConfig.enabled) {
    return {
      sent: false,
      skipped: true,
      reason: 'Digest bị tắt trong cấu hình.',
      recipients: alertConfig.recipients,
    };
  }

  const smtpUser = String(process.env.SMTP_USER || '').trim();
  const smtpPass = String(process.env.SMTP_PASS || '').trim();
  if (!smtpUser || !smtpPass) {
    return {
      sent: false,
      skipped: true,
      reason: 'Thiếu SMTP_USER hoặc SMTP_PASS nên chưa gửi được digest hằng ngày.',
      recipients: alertConfig.recipients,
    };
  }

  const todayKey = vietnamDateKey();
  const lastSent = await readDigestLastSentDate();
  if (lastSent.value === todayKey) {
    return {
      sent: false,
      skipped: true,
      reason: `Digest đã được gửi trong ngày ${todayKey}.`,
      recipients: alertConfig.recipients,
    };
  }

  const report = await collectAnomalyRows();
  const summary = await generateAiDigestSummary(report);
  const subject = `[TRUNGTAMMMO] Daily anomaly digest ${displayDigestDate()}`;
  const email = await sendAdminAlertEmail({
    subject,
    text: summary,
    html: renderDigestHtml(summary, report),
  });

  if (email.sent) {
    await saveDigestLastSentDate(todayKey);
  }

  await db.activity_logs.create({
    data: {
      activity: `admin daily digest ${email.sent ? 'sent' : 'skipped'}: ${JSON.stringify({
        severity: report.severity,
        metrics: report.metrics,
        recipients: alertConfig.recipients,
        reason: 'reason' in email ? email.reason : '',
      }).slice(0, 1200)}`,
      user_agent: 'cron-admin-digest',
    },
  }).catch(() => undefined);

  return {
    ...email,
    subject,
    severity: report.severity,
    metrics: report.metrics,
    window_start: report.window_start,
    window_end: report.window_end,
  };
}
