import { NextRequest, NextResponse } from 'next/server';

const AUTH_SESSION_COOKIE = 'ttmmo_session';
const AUTH_SESSION_ROLE_COOKIE = 'ttmmo_session_role';
const LEGACY_USER_ID_COOKIE = 'user_id';
const TWO_FACTOR_PENDING_COOKIE = 'ttmmo_2fa_pending';
const LEGACY_TWO_FACTOR_PENDING_COOKIE = '2fa_pending';

const STATIC_PATH_PREFIXES = [
  '/_next/',
  '/assets/',
  '/uploads/',
  '/favicon',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.webmanifest',
];

const REQUEST_LIMIT_WINDOW_MS = 60_000;
const REQUEST_LIMIT_MAX = 240;
const DDOS_WINDOW_MS = 30_000;
const DDOS_SOFT_LIMIT = 180;
const DDOS_HARD_LIMIT = 420;
const DDOS_TEMP_BAN_MS = 15 * 60_000;
const requestWindow = new Map<string, { count: number; resetAt: number }>();
const ddosWindow = new Map<string, { count: number; apiCount: number; resetAt: number; bannedUntil?: number }>();

function getSessionSecret() {
  const secret =
    process.env.SESSION_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.JWT_SECRET ||
    process.env.APP_KEY ||
    '';

  if (secret) {
    return secret;
  }

  return process.env.NODE_ENV === 'production'
    ? ''
    : 'development-only-session-secret-change-in-env';
}

function base64url(bytes: ArrayBuffer) {
  const raw = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function generateNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return base64url(bytes.buffer);
}

async function signPayload(payload: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return base64url(signature);
}

async function verifySessionToken(userId: number, token: string | undefined) {
  const secret = getSessionSecret();
  if (!secret || !userId || !token) {
    return false;
  }

  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    return false;
  }

  const tokenUserId = Math.trunc(Number(parts[1] || 0));
  const expiresAt = Number(parts[2] || 0);
  if (tokenUserId !== userId || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return false;
  }

  const payload = parts.slice(0, 3).join('.');
  return await signPayload(payload, secret) === parts[3];
}

function nextWithPathname(req: NextRequest) {
  const nonce = generateNonce();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pathname', req.nextUrl.pathname);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', buildSecurityHeaders(req, nonce)['Content-Security-Policy']);
  return applySecurityHeaders(NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  }), req, nonce);
}

function clearSession(response: NextResponse) {
  response.cookies.set(LEGACY_USER_ID_COOKIE, '', { maxAge: 0, path: '/' });
  response.cookies.set(AUTH_SESSION_COOKIE, '', { maxAge: 0, path: '/' });
  response.cookies.set(AUTH_SESSION_ROLE_COOKIE, '', { maxAge: 0, path: '/' });
  response.cookies.set(TWO_FACTOR_PENDING_COOKIE, '', { maxAge: 0, path: '/' });
  response.cookies.set(LEGACY_TWO_FACTOR_PENDING_COOKIE, '', { maxAge: 0, path: '/' });
  return response;
}

function normalizeRole(role: string) {
  return String(role || '').trim().toLowerCase().replace(/-/g, '_');
}

async function getVerifiedSessionRole(userId: number, token: string | undefined) {
  const secret = getSessionSecret();
  if (!secret || !userId || !token) {
    return '';
  }

  const parts = token.split('.');
  if (parts.length !== 5 || parts[0] !== 'v1') {
    return '';
  }

  const tokenUserId = Math.trunc(Number(parts[1] || 0));
  const role = normalizeRole(parts[2] || '');
  const expiresAt = Number(parts[3] || 0);
  if (tokenUserId !== userId || !role || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return '';
  }

  const payload = parts.slice(0, 4).join('.');
  return await signPayload(payload, secret) === parts[4] ? role : '';
}

function isSupportTikTokAllowedPath(pathname: string) {
  return (
    pathname === '/user/support-tiktok' ||
    pathname.startsWith('/user/support-tiktok/') ||
    pathname.startsWith('/api/support-tiktok/') ||
    pathname === '/api/user/me' ||
    pathname === '/api/auth/logout' ||
    pathname === '/api/security/event' ||
    pathname === '/api/security/network-risk'
  );
}

function blockSupportTikTokOutsideChat(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  if (isSupportTikTokAllowedPath(pathname)) {
    return null;
  }

  if (pathname.startsWith('/api/')) {
    return applySecurityHeaders(NextResponse.json(
      {
        success: false,
        code: 'SUPPORT_TIKTOK_CHAT_ONLY',
        message: 'Tài khoản Support TikTok chỉ được dùng khu vực chat Support TikTok.',
      },
      { status: 403 }
    ), req);
  }

  if (pathname.startsWith('/user/') || pathname.startsWith('/admin/')) {
    return applySecurityHeaders(NextResponse.redirect(new URL('/user/support-tiktok', req.url)), req);
  }

  return null;
}

function buildInvalidSessionResponse(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return applySecurityHeaders(clearSession(NextResponse.json(
      { success: false, code: 'INVALID_SESSION', message: 'Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại.' },
      { status: 401 }
    )), req);
  }

  const loginUrl = new URL('/auth/login', req.url);
  loginUrl.searchParams.set('reason', 'invalid-session');
  loginUrl.searchParams.set('next', req.nextUrl.pathname);
  return applySecurityHeaders(clearSession(NextResponse.redirect(loginUrl)), req);
}

function firstHeaderIp(value: string | null) {
  return value?.split(',')[0]?.trim() || '';
}

function getRequestIp(req: NextRequest) {
  return (
    firstHeaderIp(req.headers.get('cf-connecting-ip')) ||
    req.headers.get('x-real-ip')?.trim() ||
    firstHeaderIp(req.headers.get('x-forwarded-for')) ||
    'unknown'
  ).replace(/^::ffff:/, '');
}

function isStaticPath(pathname: string) {
  return STATIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function shouldSkipDdosGuard(pathname: string) {
  return isStaticPath(pathname) || pathname === '/api/security/event' || pathname === '/api/security/network-risk';
}

function buildSecurityHeaders(req: NextRequest, nonce = '') {
  const isDev = process.env.NODE_ENV !== 'production';
  const connectSrc = [
    "'self'",
    'https:',
    'wss:',
    ...(isDev ? ['http://localhost:*', 'ws://localhost:*'] : []),
  ].join(' ');
  const scriptSrc = [
    "'self'",
    nonce ? `'nonce-${nonce}'` : '',
    "'wasm-unsafe-eval'",
    ...(isDev ? ["'unsafe-eval'"] : []),
  ].filter(Boolean).join(' ');
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `script-src ${scriptSrc}`,
    `connect-src ${connectSrc}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "frame-src 'self' https:",
    ...(req.nextUrl.protocol === 'https:' ? ['upgrade-insecure-requests'] : []),
  ].join('; ');

  return {
    'Content-Security-Policy': csp,
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), clipboard-read=(), clipboard-write=(self)',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Origin-Agent-Cluster': '?1',
    'X-DNS-Prefetch-Control': 'off',
  };
}

function applySecurityHeaders(response: NextResponse, req: NextRequest, nonce = '') {
  for (const [key, value] of Object.entries(buildSecurityHeaders(req, nonce))) {
    response.headers.set(key, value);
  }
  return response;
}

function buildSecurityBlock(req: NextRequest, reason: string, status = 403) {
  const payload = {
    success: false,
    code: 'SECURITY_BLOCKED',
    message: 'Request bị hệ thống bảo mật chặn. Vui lòng liên hệ owner nếu đây là nhầm lẫn.',
    reason,
  };

  if (req.nextUrl.pathname.startsWith('/api/')) {
    return applySecurityHeaders(NextResponse.json(payload, { status }), req);
  }

  return applySecurityHeaders(new NextResponse('Security blocked', { status }), req);
}

function hasSuspiciousRequest(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const query = req.nextUrl.search;
  const userAgent = req.headers.get('user-agent') || '';
  let decodedQuery = query;
  try {
    decodedQuery = decodeURIComponent(query || '');
  } catch {
    decodedQuery = query;
  }
  const combined = `${pathname} ${query} ${decodedQuery} ${userAgent}`.toLowerCase();

  if (/(sqlmap|nikto|nuclei|acunetix|wpscan|masscan|zgrab|python-requests|go-http-client|java\/|libwww-perl)/i.test(userAgent)) {
    return 'scanner_user_agent';
  }

  if (/(\/wp-admin|\/wp-login|\/xmlrpc\.php|\/phpmyadmin|\/\.env|\/\.git|\/vendor\/phpunit|\/cgi-bin|\/shell|\/webshell)/i.test(pathname)) {
    return 'known_probe_path';
  }

  if (/(union\s+select|information_schema|sleep\s*\(|benchmark\s*\(|drop\s+table|or\s+1\s*=\s*1)/i.test(combined)) {
    return 'sql_injection_signature';
  }

  if (/(<script|javascript:|document\.cookie|localstorage|sessionstorage|onerror\s*=|onload\s*=)/i.test(combined)) {
    return 'xss_signature';
  }

  if (/(\.\.\/|\.\.\\|%2e%2e|etc\/passwd|\/proc\/self|boot\.ini)/i.test(combined)) {
    return 'path_traversal_signature';
  }

  return '';
}

function isRateLimited(req: NextRequest) {
  if (isStaticPath(req.nextUrl.pathname)) {
    return false;
  }

  const ip = getRequestIp(req);
  const bucketKey = `${ip}:${req.nextUrl.pathname.startsWith('/api/') ? 'api' : 'page'}`;
  const now = Date.now();
  const current = requestWindow.get(bucketKey);

  if (!current || current.resetAt <= now) {
    requestWindow.set(bucketKey, { count: 1, resetAt: now + REQUEST_LIMIT_WINDOW_MS });
    return false;
  }

  current.count += 1;
  return current.count > REQUEST_LIMIT_MAX;
}

function cleanupWindowMap<T extends { resetAt: number; bannedUntil?: number }>(map: Map<string, T>, now: number) {
  if (map.size < 2000) {
    return;
  }

  for (const [key, value] of map) {
    if (value.resetAt <= now && (!value.bannedUntil || value.bannedUntil <= now)) {
      map.delete(key);
    }
  }
}

function inspectDdosRisk(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  if (shouldSkipDdosGuard(pathname)) {
    return { blocked: false, reason: '' };
  }

  const ip = getRequestIp(req);
  const now = Date.now();
  cleanupWindowMap(ddosWindow, now);

  const current = ddosWindow.get(ip) || { count: 0, apiCount: 0, resetAt: now + DDOS_WINDOW_MS };
  if (current.bannedUntil && current.bannedUntil > now) {
    ddosWindow.set(ip, current);
    return { blocked: true, reason: 'ai_ddos_temp_ban' };
  }

  if (current.resetAt <= now) {
    current.count = 0;
    current.apiCount = 0;
    current.resetAt = now + DDOS_WINDOW_MS;
    current.bannedUntil = undefined;
  }

  current.count += 1;
  if (pathname.startsWith('/api/')) {
    current.apiCount += 1;
  }

  const suspiciousUa = /(curl|wget|python-requests|go-http-client|httpclient|axios|undici|bot|spider|scanner|headlesschrome)/i.test(req.headers.get('user-agent') || '');
  const hardHit = current.count > DDOS_HARD_LIMIT || current.apiCount > Math.floor(DDOS_HARD_LIMIT * 0.65);
  const softAutomationHit = suspiciousUa && (current.count > DDOS_SOFT_LIMIT || current.apiCount > Math.floor(DDOS_SOFT_LIMIT * 0.55));

  if (hardHit || softAutomationHit) {
    current.bannedUntil = now + DDOS_TEMP_BAN_MS;
    ddosWindow.set(ip, current);
    return {
      blocked: true,
      reason: hardHit ? 'ai_ddos_hard_burst' : 'ai_ddos_automation_burst',
    };
  }

  ddosWindow.set(ip, current);
  return { blocked: false, reason: '' };
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  if (isStaticPath(pathname)) {
    return nextWithPathname(req);
  }

  const suspiciousReason = hasSuspiciousRequest(req);
  if (suspiciousReason) {
    return buildSecurityBlock(req, suspiciousReason, 403);
  }

  const ddosRisk = inspectDdosRisk(req);
  if (ddosRisk.blocked) {
    return buildSecurityBlock(req, ddosRisk.reason, 429);
  }

  if (isRateLimited(req)) {
    return buildSecurityBlock(req, 'rate_limit', 429);
  }

  const userId = Math.trunc(Number(req.cookies.get(LEGACY_USER_ID_COOKIE)?.value || 0));
  if (!userId) {
    return nextWithPathname(req);
  }

  const isValid = await verifySessionToken(userId, req.cookies.get(AUTH_SESSION_COOKIE)?.value);
  if (isValid) {
    const role = await getVerifiedSessionRole(userId, req.cookies.get(AUTH_SESSION_ROLE_COOKIE)?.value);
    if (role === 'support_tiktok') {
      const supportBlock = blockSupportTikTokOutsideChat(req);
      if (supportBlock) {
        return supportBlock;
      }
    }
    return nextWithPathname(req);
  }

  return buildInvalidSessionResponse(req);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
