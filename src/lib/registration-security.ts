import 'server-only';

import { resolveMx } from 'node:dns/promises';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getRequestDeviceInfo } from '@/lib/device-info';
import { getRequestIp, isTrackableIp, logSecurityEvent } from '@/lib/ip-security';
import { isValidUserEmail, normalizeUserEmail } from '@/lib/user-email-guard';

type RegistrationProvider = 'password' | 'google';
type RegistrationIntent = 'signup' | 'login';

interface RegistrationRiskInput {
  req: NextRequest;
  email: string;
  provider: RegistrationProvider;
  intent?: RegistrationIntent;
  username?: string | null;
}

export interface RegistrationRiskResult {
  allowed: boolean;
  message: string;
  riskScore: number;
  reasons: string[];
  ip: string;
  deviceHash: string;
  deviceName: string;
  emailDomain: string;
}

export class RegistrationSecurityError extends Error {
  result: RegistrationRiskResult;

  constructor(result: RegistrationRiskResult) {
    super(result.message);
    this.name = 'RegistrationSecurityError';
    this.result = result;
  }
}

const DEFAULT_BLOCKED_EMAIL_DOMAINS = [
  'web-library.net',
  'mailinator.com',
  'guerrillamail.com',
  'sharklasers.com',
  'yopmail.com',
  'tempmail.com',
  '10minutemail.com',
  'maildrop.cc',
  'dispostable.com',
  'getnada.com',
  'trashmail.com',
  'moakt.com',
];

const SUSPICIOUS_DOMAIN_PATTERNS = [
  /(^|\.)temp-?mail/i,
  /(^|\.)fake-?mail/i,
  /(^|\.)throwaway/i,
  /(^|\.)disposable/i,
  /(^|\.)mailinator/i,
  /(^|\.)guerrilla/i,
  /(^|\.)yopmail/i,
  /(^|\.)10minute/i,
];

const SUSPICIOUS_USER_AGENT_PATTERNS = [
  /curl/i,
  /python-requests/i,
  /postmanruntime/i,
  /axios\//i,
  /go-http-client/i,
  /httpclient/i,
  /scrapy/i,
];

const globalForRegistrationSecurity = globalThis as unknown as {
  registrationSecurityTablesReady?: Promise<void>;
  registrationMxCache?: Map<string, { ok: boolean; reason: string; expiresAt: number }>;
};

const mxCache =
  globalForRegistrationSecurity.registrationMxCache ??
  new Map<string, { ok: boolean; reason: string; expiresAt: number }>();

if (!globalForRegistrationSecurity.registrationMxCache) {
  globalForRegistrationSecurity.registrationMxCache = mxCache;
}

function envInt(key: string, fallback: number) {
  const value = Number(process.env[key] || '');
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : fallback;
}

function envBoolean(key: string, fallback = false) {
  const value = String(process.env[key] || '').trim().toLowerCase();
  if (!value) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value);
}

function parseBlockedDomains() {
  const raw = `${process.env.REGISTRATION_BLOCKED_EMAIL_DOMAINS || ''},${process.env.BLOCKED_EMAIL_DOMAINS || ''}`;
  const extra = raw
    .split(/[,\n;]+/)
    .map((item) => item.trim().toLowerCase().replace(/^\.+|\.+$/g, ''))
    .filter(Boolean);
  return Array.from(new Set([...DEFAULT_BLOCKED_EMAIL_DOMAINS, ...extra]));
}

export function getEmailDomain(email: string) {
  const normalized = normalizeUserEmail(email);
  return (normalized.split('@').pop() || '').trim().toLowerCase().replace(/\.$/, '');
}

function isBlockedEmailDomain(domain: string) {
  const normalized = domain.toLowerCase();
  return parseBlockedDomains().some((blocked) => normalized === blocked || normalized.endsWith(`.${blocked}`));
}

function isSuspiciousEmailDomain(domain: string) {
  return SUSPICIOUS_DOMAIN_PATTERNS.some((pattern) => pattern.test(domain));
}

function isSuspiciousUserAgent(userAgent: string) {
  return SUSPICIOUS_USER_AGENT_PATTERNS.some((pattern) => pattern.test(userAgent));
}

export async function ensureRegistrationSecurityTables() {
  if (!globalForRegistrationSecurity.registrationSecurityTablesReady) {
    globalForRegistrationSecurity.registrationSecurityTablesReady = db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS registration_security_events (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        email VARCHAR(190) NULL,
        email_domain VARCHAR(190) NULL,
        ip VARCHAR(45) NULL,
        device_hash VARCHAR(80) NULL,
        device_name VARCHAR(190) NULL,
        provider VARCHAR(32) NOT NULL DEFAULT 'password',
        verdict VARCHAR(32) NOT NULL,
        risk_score INT NOT NULL DEFAULT 0,
        reasons TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_reg_sec_ip_created (ip, created_at),
        KEY idx_reg_sec_device_created (device_hash, created_at),
        KEY idx_reg_sec_domain_created (email_domain, created_at),
        KEY idx_reg_sec_created (created_at)
      )
    `).then(() => undefined).catch((error) => {
      globalForRegistrationSecurity.registrationSecurityTablesReady = undefined;
      throw error;
    });
  }

  return globalForRegistrationSecurity.registrationSecurityTablesReady;
}

async function verifyMxRecord(domain: string) {
  if (envBoolean('REGISTRATION_SKIP_MX_CHECK', false)) {
    return { ok: true, reason: 'mx_check_disabled' };
  }

  const cached = mxCache.get(domain);
  if (cached && cached.expiresAt > Date.now()) {
    return { ok: cached.ok, reason: cached.reason };
  }

  let result = { ok: false, reason: 'mx_lookup_failed' };

  try {
    const timeoutMs = envInt('REGISTRATION_MX_TIMEOUT_MS', 3500);
    const records = await Promise.race([
      resolveMx(domain),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('mx_lookup_timeout')), timeoutMs);
      }),
    ]);

    result = records.length > 0
      ? { ok: true, reason: 'mx_ok' }
      : { ok: false, reason: 'mx_empty' };
  } catch (error) {
    result = {
      ok: false,
      reason: error instanceof Error && error.message ? error.message : 'mx_lookup_failed',
    };
  }

  mxCache.set(domain, {
    ...result,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });
  return result;
}

async function countRecentRegistrationEvents(ip: string, deviceHash: string, since: Date) {
  await ensureRegistrationSecurityTables();

  const rows = await db.$queryRawUnsafe<Array<{
    ip_events: number | bigint | null;
    device_events: number | bigint | null;
  }>>(
    `
      SELECT
        SUM(CASE WHEN ip = ? THEN 1 ELSE 0 END) AS ip_events,
        SUM(CASE WHEN device_hash = ? THEN 1 ELSE 0 END) AS device_events
      FROM registration_security_events
      WHERE created_at >= ?
    `,
    ip,
    deviceHash,
    since
  ).catch(() => []);

  return {
    ipEvents: Number(rows[0]?.ip_events || 0),
    deviceEvents: Number(rows[0]?.device_events || 0),
  };
}

async function countRecentAccountsByIp(ip: string, since: Date) {
  if (!isTrackableIp(ip)) {
    return 0;
  }

  return db.users.count({
    where: {
      last_ip: ip,
      created_at: {
        gte: since,
      },
    },
  }).catch(() => 0);
}

async function recordRegistrationRiskEvent(input: RegistrationRiskInput, result: RegistrationRiskResult) {
  await ensureRegistrationSecurityTables().catch(() => undefined);

  await db.$executeRawUnsafe(
    `
      INSERT INTO registration_security_events
        (email, email_domain, ip, device_hash, device_name, provider, verdict, risk_score, reasons)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    normalizeUserEmail(input.email).slice(0, 190),
    result.emailDomain.slice(0, 190),
    isTrackableIp(result.ip) ? result.ip : null,
    result.deviceHash.slice(0, 80),
    result.deviceName.slice(0, 190),
    input.provider,
    result.allowed ? 'allowed' : 'blocked',
    result.riskScore,
    JSON.stringify(result.reasons).slice(0, 2000)
  ).catch(() => undefined);

  await logSecurityEvent({
    eventType: result.allowed ? 'REGISTRATION_RISK_CHECK' : 'REGISTRATION_RISK_BLOCK',
    severity: result.allowed ? 'LOW' : 'HIGH',
    ip: result.ip,
    uri: input.req.nextUrl.pathname,
    method: input.req.method,
    field: 'email',
    payload: `${normalizeUserEmail(input.email)}; score=${result.riskScore}; ${result.reasons.join('; ')}`,
    userAgent: input.req.headers.get('user-agent'),
  }).catch(() => undefined);
}

export async function evaluateRegistrationRisk(input: RegistrationRiskInput): Promise<RegistrationRiskResult> {
  const email = normalizeUserEmail(input.email);
  const domain = getEmailDomain(email);
  const ip = getRequestIp(input.req);
  const deviceInfo = getRequestDeviceInfo(input.req);
  const intent = input.intent || 'signup';
  const reasons: string[] = [];
  let riskScore = 0;
  let hardBlock = false;
  let message = 'Đăng ký bị chặn vì tín hiệu bảo mật không hợp lệ.';

  if (!isValidUserEmail(email) || !domain) {
    riskScore += 100;
    hardBlock = true;
    reasons.push('invalid_email_format');
    message = 'Email không hợp lệ.';
  }

  if (domain && isBlockedEmailDomain(domain)) {
    riskScore += 100;
    hardBlock = true;
    reasons.push(`blocked_email_domain:${domain}`);
    message = 'Email này thuộc domain tạm/ảo hoặc không đủ tin cậy. Vui lòng dùng email thật như Gmail, Outlook hoặc email doanh nghiệp.';
  } else if (domain && isSuspiciousEmailDomain(domain)) {
    riskScore += 50;
    reasons.push(`suspicious_email_domain:${domain}`);
  }

  if (domain && !hardBlock) {
    const mx = await verifyMxRecord(domain);
    if (!mx.ok) {
      riskScore += 80;
      hardBlock = true;
      reasons.push(`mx_invalid:${domain}:${mx.reason}`);
      message = 'Domain email không có bản ghi MX hợp lệ nên chưa thể đăng ký. Vui lòng dùng email thật có thể nhận thư.';
    } else {
      reasons.push(`mx_ok:${domain}`);
    }
  }

  if (!isTrackableIp(ip)) {
    riskScore += 25;
    reasons.push('untrackable_ip');
  }

  if (isSuspiciousUserAgent(deviceInfo.userAgent)) {
    riskScore += 90;
    hardBlock = true;
    reasons.push(`automation_user_agent:${deviceInfo.browser}`);
    message = 'Trình duyệt hoặc tool hiện tại không được phép đăng ký/đăng nhập OAuth.';
  }

  const windowHours = envInt('REGISTRATION_RISK_WINDOW_HOURS', 24);
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const recentAccountsByIp = await countRecentAccountsByIp(ip, since);
  const recentEvents = await countRecentRegistrationEvents(ip, deviceInfo.deviceHash, since);

  const maxIpAccounts = envInt('REGISTRATION_MAX_IP_ACCOUNTS_24H', 3);
  const maxIpEvents = envInt('REGISTRATION_MAX_IP_ATTEMPTS_24H', 8);
  const maxDeviceEvents = envInt('REGISTRATION_MAX_DEVICE_ATTEMPTS_24H', 5);

  if (intent === 'signup' && isTrackableIp(ip) && recentAccountsByIp >= maxIpAccounts) {
    riskScore += 75;
    hardBlock = true;
    reasons.push(`too_many_accounts_ip:${recentAccountsByIp}/${maxIpAccounts}`);
    message = 'IP này đã tạo nhiều tài khoản trong thời gian ngắn. Vui lòng thử lại sau hoặc liên hệ admin.';
  }

  if (intent === 'signup' && isTrackableIp(ip) && recentEvents.ipEvents >= maxIpEvents) {
    riskScore += 55;
    reasons.push(`too_many_registration_attempts_ip:${recentEvents.ipEvents}/${maxIpEvents}`);
  }

  if (intent === 'signup' && recentEvents.deviceEvents >= maxDeviceEvents) {
    riskScore += 65;
    reasons.push(`too_many_registration_attempts_device:${recentEvents.deviceEvents}/${maxDeviceEvents}`);
  }

  if (input.provider === 'google') {
    reasons.push('provider:google');
  }

  if (input.username) {
    reasons.push(`username:${String(input.username).slice(0, 80)}`);
  }

  const blockScore = envInt('REGISTRATION_RISK_BLOCK_SCORE', 70);
  const allowed = !hardBlock && riskScore < blockScore;

  if (!allowed && message === 'Đăng ký bị chặn vì tín hiệu bảo mật không hợp lệ.') {
    message = 'Thiết bị/IP này đang tạo tài khoản hoặc đăng nhập OAuth quá nhanh. Vui lòng thử lại sau hoặc liên hệ admin.';
  }

  const result: RegistrationRiskResult = {
    allowed,
    message,
    riskScore,
    reasons,
    ip,
    deviceHash: deviceInfo.deviceHash,
    deviceName: deviceInfo.deviceName,
    emailDomain: domain,
  };

  await recordRegistrationRiskEvent(input, result);
  return result;
}

export async function assertRegistrationRiskAllowed(input: RegistrationRiskInput) {
  const result = await evaluateRegistrationRisk(input);
  if (!result.allowed) {
    throw new RegistrationSecurityError(result);
  }
  return result;
}
