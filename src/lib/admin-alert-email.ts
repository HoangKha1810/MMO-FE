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

export function normalizeEmailRecipients(values: string[]) {
  return normalizeEmailList(values);
}

function normalizeEmailList(values: string[]) {
  return Array.from(
    new Set(
      values
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

interface SmtpRuntimeConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

function getSmtpRuntimeConfig() {
  const host = String(process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = smtpPort();
  const secure = parseBoolean(process.env.SMTP_SECURE || (port === 465 ? '1' : '0'), port === 465);
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();

  return {
    host,
    port,
    secure,
    user,
    pass,
  } satisfies SmtpRuntimeConfig;
}

function createSmtpTransporter(config: SmtpRuntimeConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
}

function buildFromAddress(inputFrom: string | null | undefined, configFrom: string, smtpUser: string) {
  const requestedFrom = String(inputFrom || configFrom || smtpUser || DEFAULT_ADMIN_ALERT_EMAIL).trim();
  const allowCustomFrom = parseBoolean(process.env.SMTP_ALLOW_CUSTOM_FROM || '0', false);
  const from = allowCustomFrom ? requestedFrom : smtpUser || requestedFrom;

  return {
    from,
    replyTo: requestedFrom && requestedFrom !== from ? requestedFrom : undefined,
  };
}

export async function sendSystemEmail(input: {
  to: string[];
  subject: string;
  text: string;
  html?: string;
  from?: string | null;
}) {
  const config = await getAdminAlertEmailConfig();
  const smtp = getSmtpRuntimeConfig();

  if (!smtp.user || !smtp.pass) {
    return {
      sent: false,
      skipped: true,
      reason: 'Thiếu SMTP_USER hoặc SMTP_PASS để gửi email hệ thống.',
      recipients: normalizeEmailList(input.to),
    };
  }

  const recipients = normalizeEmailList(input.to);
  const finalRecipients = recipients.length > 0 ? recipients : config.recipients;

  if (recipients.length === 0 && input.to.length > 0) {
    return {
      sent: false,
      skipped: true,
      reason: `Danh sách người nhận không hợp lệ: ${input.to.join(', ')}`,
      recipients: [],
    };
  }

  const transporter = createSmtpTransporter(smtp);
  const fromAddress = buildFromAddress(input.from, config.from, smtp.user);
  const result = await transporter.sendMail({
    from: fromAddress.from,
    replyTo: fromAddress.replyTo,
    to: finalRecipients.join(', '),
    subject: input.subject,
    text: input.text,
    html: input.html || input.text.replace(/\n/g, '<br />'),
  });

  return {
    sent: true,
    skipped: false,
    recipients: finalRecipients,
    from: fromAddress.from,
    reply_to: fromAddress.replyTo,
    accepted: result.accepted,
    rejected: result.rejected,
    message_id: result.messageId,
  };
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

  const smtp = getSmtpRuntimeConfig();

  if (!smtp.user || !smtp.pass) {
    return {
      sent: false,
      skipped: true,
      reason: 'Thiếu SMTP_USER hoặc SMTP_PASS để gửi email digest.',
      recipients: config.recipients,
    };
  }

  const transporter = createSmtpTransporter(smtp);
  const fromAddress = buildFromAddress(config.from, config.from, smtp.user);

  const result = await transporter.sendMail({
    from: fromAddress.from,
    replyTo: fromAddress.replyTo,
    to: config.recipients.join(', '),
    subject: input.subject,
    text: input.text,
    html: input.html || input.text.replace(/\n/g, '<br />'),
  });

  return {
    sent: true,
    skipped: false,
    recipients: config.recipients,
    from: fromAddress.from,
    reply_to: fromAddress.replyTo,
    accepted: result.accepted,
    rejected: result.rejected,
    message_id: result.messageId,
  };
}
