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
  const ip = String(input.ip || 'unknown').trim() || 'unknown';
  const severity = input.severity || 'HIGH';
  const reason = String(input.reason || '').trim();
  const cooldownKey = input.cooldownKey || `${event}:${ip}:${reason.slice(0, 80)}`;

  try {
    if (!input.force && await shouldSkipByCooldown(cooldownKey)) {
      return { sent: false, skipped: true, reason: 'security-alert-cooldown' };
    }

    const rows = [
      ['Mức độ', severity],
      ['Sự kiện', event],
      ['IP', ip],
      ['User ID', input.userId || ''],
      ['Username', input.username || ''],
      ['Email', input.email || ''],
      ['Lý do', reason],
      ['Path', input.path || ''],
      ['Method', input.method || ''],
      ['User-Agent', input.userAgent || ''],
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
