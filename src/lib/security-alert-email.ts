import 'server-only';

import { sendSystemEmail, normalizeEmailRecipients } from '@/lib/admin-alert-email';
import { db } from '@/lib/db';

const DEFAULT_OWNER_ALERT_EMAIL = 'nhhkha.91tn@gmail.com';

function parseRecipients(value: string) {
  return normalizeEmailRecipients(
    String(value || '')
      .split(/[,\n;]+/)
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function alertRecipients() {
  const recipients = parseRecipients(
    process.env.SECURITY_ALERT_RECIPIENTS ||
      process.env.OWNER_ALERT_EMAIL ||
      process.env.OWNER_EMAIL ||
      process.env.ADMIN_ALERT_RECIPIENTS ||
      DEFAULT_OWNER_ALERT_EMAIL
  );

  return recipients.length > 0 ? recipients : [DEFAULT_OWNER_ALERT_EMAIL];
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function compactAlertText(value: unknown, limit = 2000) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

function detailValue(details: Record<string, unknown>, keys: string[], limit = 2000) {
  for (const key of keys) {
    const value = details[key];
    if (value === undefined || value === null || value === '') {
      continue;
    }
    if (Array.isArray(value)) {
      return value.map((item) => compactAlertText(item, 120)).filter(Boolean).join(', ').slice(0, limit);
    }
    if (typeof value === 'object') {
      return JSON.stringify(value).slice(0, limit);
    }
    return compactAlertText(value, limit);
  }
  return '';
}

function detailNumber(details: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = Number(details[key]);
    if (Number.isFinite(value) && value > 0) {
      return Math.trunc(value);
    }
  }
  return null;
}

async function resolveAlertUser(input: {
  ip: string;
  userId?: number | null;
  username?: string | null;
  email?: string | null;
}) {
  const directUserId = Math.trunc(Number(input.userId || 0));

  if (directUserId && (!input.username || !input.email)) {
    const rows = await db.$queryRawUnsafe<Array<{
      id: number | bigint;
      username: string | null;
      email: string | null;
      role: string | null;
      status: string | null;
    }>>(
      'SELECT id, username, email, role, status FROM users WHERE id = ? LIMIT 1',
      directUserId
    ).catch(() => []);
    if (rows[0]) {
      return rows[0];
    }
  }

  if (!input.username && !input.email && input.ip && input.ip !== 'unknown') {
    const byLastIp = await db.$queryRawUnsafe<Array<{
      id: number | bigint;
      username: string | null;
      email: string | null;
      role: string | null;
      status: string | null;
    }>>(
      `
        SELECT id, username, email, role, status
        FROM users
        WHERE last_ip = ?
        ORDER BY COALESCE(last_activity, last_login, updated_at, created_at) DESC, id DESC
        LIMIT 1
      `,
      input.ip
    ).catch(() => []);
    if (byLastIp[0]) {
      return byLastIp[0];
    }

    const byActivity = await db.$queryRawUnsafe<Array<{
      id: number | bigint;
      username: string | null;
      email: string | null;
      role: string | null;
      status: string | null;
    }>>(
      `
        SELECT u.id, u.username, u.email, u.role, u.status
        FROM activity_logs al
        JOIN users u ON u.id = al.user_id
        WHERE al.ip_address = ?
          AND al.user_id IS NOT NULL
        ORDER BY al.created_at DESC, al.id DESC
        LIMIT 1
      `,
      input.ip
    ).catch(() => []);
    if (byActivity[0]) {
      return byActivity[0];
    }
  }

  return null;
}

function cooldownMinutes() {
  const raw = Number(process.env.SECURITY_ALERT_EMAIL_COOLDOWN_MINUTES || 5);
  return Number.isFinite(raw) ? Math.max(0, Math.min(120, Math.trunc(raw))) : 5;
}

function fingerprint(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 42);
}

async function shouldSkipByCooldown(key: string) {
  const minutes = cooldownMinutes();
  if (minutes <= 0) {
    return false;
  }

  const settingKey = `sec_mail:${fingerprint(key)}`;
  const rows = await db.settings.findMany({
    where: { setting_key: settingKey },
    orderBy: { id: 'desc' },
    take: 1,
    select: { id: true, setting_value: true },
  }).catch(() => []);

  const lastSentAt = rows[0]?.setting_value ? Date.parse(String(rows[0].setting_value)) : 0;
  if (lastSentAt && Date.now() - lastSentAt < minutes * 60_000) {
    return true;
  }

  if (rows[0]?.id) {
    await db.settings.update({
      where: { id: rows[0].id },
      data: { setting_value: new Date().toISOString(), updated_at: new Date() },
    }).catch(() => undefined);
  } else {
    await db.settings.create({
      data: { setting_key: settingKey, setting_value: new Date().toISOString() },
    }).catch(() => undefined);
  }

  return false;
}

export async function sendSecurityAlertEmail(input: {
  event: string;
  title: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  ip?: string | null;
  userId?: number | null;
  username?: string | null;
  email?: string | null;
  reason?: string | null;
  path?: string | null;
  method?: string | null;
  userAgent?: string | null;
  details?: Record<string, unknown> | null;
  cooldownKey?: string | null;
  force?: boolean;
}) {
  const event = String(input.event || 'SECURITY_ALERT').trim().slice(0, 80);
  const details = input.details || {};
  const ip = String(input.ip || detailValue(details, ['ip', 'ip_address'], 80) || 'unknown').trim() || 'unknown';
  const severity = input.severity || 'HIGH';
  const reason = String(input.reason || detailValue(details, ['reason'], 2000) || '').trim();
  const cooldownKey = input.cooldownKey || `${event}:${ip}:${reason.slice(0, 80)}`;

  try {
    if (!input.force && await shouldSkipByCooldown(cooldownKey)) {
      return { sent: false, skipped: true, reason: 'security-alert-cooldown' };
    }

    const resolvedUser = await resolveAlertUser({
      ip,
      userId: input.userId || detailNumber(details, ['user_id', 'userId']),
      username: input.username || detailValue(details, ['username']),
      email: input.email || detailValue(details, ['email']),
    });

    const userId = input.userId || detailNumber(details, ['user_id', 'userId']) || Number(resolvedUser?.id || 0) || '';
    const username = input.username || detailValue(details, ['username']) || resolvedUser?.username || '';
    const email = input.email || detailValue(details, ['email']) || resolvedUser?.email || '';
    const path = input.path || detailValue(details, ['path', 'request_path', 'uri']);
    const method = input.method || detailValue(details, ['method', 'request_method']);
    const userAgent = input.userAgent || detailValue(details, ['user_agent', 'userAgent', 'client_user_agent']);
    const toolName = detailValue(details, ['tool_name', 'toolName', 'detected_tool', 'tool', 'runtime_marker', 'signal'], 500);
    const toolType = detailValue(details, ['tool_type', 'toolType', 'execution_type', 'source'], 500);
    const blockedPayload = detailValue(details, [
      'attempted_code',
      'attemptedCode',
      'clipboard_text',
      'payload',
      'payload_sample',
      'code',
      'command',
      'snippet',
      'runtime_marker',
    ], 2200);

    const rows = [
      ['Mức độ', severity],
      ['Sự kiện', event],
      ['IP', ip],
      ['User ID', userId],
      ['Username', username],
      ['Email', email],
      ['Lý do', reason],
      ['Hành vi/tool', toolName],
      ['Loại tool', toolType],
      ['Code/payload bị chặn', blockedPayload],
      ['Path', path],
      ['Method', method],
      ['User-Agent', userAgent],
      ['Thời gian', new Date().toISOString()],
    ];

    const text = [
      `[${severity}] ${input.title}`,
      '',
      ...rows.map(([label, value]) => `${label}: ${value}`),
      input.details ? ['', 'Details:', JSON.stringify(input.details, null, 2)] : '',
    ].flat().filter(Boolean).join('\n');

    const htmlRows = rows
      .map(([label, value]) => `
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;color:#64748b;font-weight:700;width:150px;">${escapeHtml(label)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;color:#0f172a;word-break:break-word;">${escapeHtml(value)}</td>
        </tr>
      `)
      .join('');

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;background:#020617;padding:24px;color:#e2e8f0;">
        <div style="max-width:760px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #1e293b;">
          <div style="padding:22px 26px;background:linear-gradient(135deg,#991b1b,#0f172a);color:#ffffff;">
            <div style="font-size:11px;font-weight:900;letter-spacing:.22em;text-transform:uppercase;opacity:.8;">TRUNGTAMMMO SECURITY</div>
            <h1 style="margin:10px 0 0;font-size:26px;line-height:1.25;">${escapeHtml(input.title)}</h1>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">${htmlRows}</table>
          ${
            input.details
              ? `<pre style="white-space:pre-wrap;margin:18px 26px 26px;padding:14px;border-radius:12px;background:#f8fafc;color:#0f172a;border:1px solid #e2e8f0;">${escapeHtml(JSON.stringify(input.details, null, 2))}</pre>`
              : ''
          }
        </div>
      </div>
    `;

    return await sendSystemEmail({
      to: alertRecipients(),
      subject: `[TRUNGTAMMMO SECURITY] ${severity} - ${input.title}`,
      text,
      html,
    });
  } catch (error) {
    return {
      sent: false,
      skipped: true,
      reason: error instanceof Error ? error.message : 'security-alert-email-failed',
    };
  }
}
