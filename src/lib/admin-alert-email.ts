import nodemailer from 'nodemailer';
import { db } from '@/lib/db';

const DEFAULT_ADMIN_ALERT_EMAIL = 'nhhkha.91tn@gmail.com';
const ALERT_SETTING_KEYS = [
  'admin_alert_digest_enabled',
  'admin_alert_recipients',
  'admin_alert_from_email',
];

function parseBoolean(value: unknown, fallback: boolean) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
}

function parseEmailList(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[,\n;]+/)
        .map((item) => item.trim())
        .filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item))
    )
  );
}

async function loadAlertSettingsMap() {
  const rows = await db.settings.findMany({
    where: { setting_key: { in: ALERT_SETTING_KEYS } },
    orderBy: { id: 'asc' },
    select: {
      setting_key: true,
      setting_value: true,
    },
  }).catch(() => []);

  return rows.reduce<Record<string, string>>((acc, row) => {
    if (!(row.setting_key in acc)) {
      acc[row.setting_key] = row.setting_value || '';
    }
    return acc;
  }, {});
}

function smtpPort() {
  const port = Number(process.env.SMTP_PORT || 465);
  return Number.isFinite(port) && port > 0 ? Math.trunc(port) : 465;
}

export interface AdminAlertEmailConfig {
  enabled: boolean;
  recipients: string[];
  from: string;
}

export async function getAdminAlertEmailConfig(): Promise<AdminAlertEmailConfig> {
  const settings = await loadAlertSettingsMap();
  const enabled = parseBoolean(
    settings.admin_alert_digest_enabled || process.env.ADMIN_ALERT_DIGEST_ENABLED || '1',
    true
  );
  const recipients = parseEmailList(
    settings.admin_alert_recipients ||
      process.env.ADMIN_ALERT_RECIPIENTS ||
      DEFAULT_ADMIN_ALERT_EMAIL
  );
  const from =
    String(settings.admin_alert_from_email || process.env.ADMIN_ALERT_FROM_EMAIL || process.env.SMTP_USER || DEFAULT_ADMIN_ALERT_EMAIL).trim() ||
    DEFAULT_ADMIN_ALERT_EMAIL;

  return {
    enabled,
    recipients: recipients.length > 0 ? recipients : [DEFAULT_ADMIN_ALERT_EMAIL],
    from,
  };
}

export async function sendAdminAlertEmail(input: {
  subject: string;
  text: string;
  html?: string;
}) {
  const config = await getAdminAlertEmailConfig();
  if (!config.enabled) {
    return {
      sent: false,
      skipped: true,
      reason: 'Digest email đã bị tắt trong cấu hình.',
      recipients: config.recipients,
    };
  }

  const host = String(process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = smtpPort();
  const secure = parseBoolean(process.env.SMTP_SECURE || (port === 465 ? '1' : '0'), port === 465);
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();

  if (!user || !pass) {
    return {
      sent: false,
      skipped: true,
      reason: 'Thiếu SMTP_USER hoặc SMTP_PASS để gửi email digest.',
      recipients: config.recipients,
    };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  const result = await transporter.sendMail({
    from: config.from,
    to: config.recipients.join(', '),
    subject: input.subject,
    text: input.text,
    html: input.html || input.text.replace(/\n/g, '<br />'),
  });

  return {
    sent: true,
    skipped: false,
    recipients: config.recipients,
    from: config.from,
    message_id: result.messageId,
  };
}
