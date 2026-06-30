import { NextRequest, NextResponse } from 'next/server';

const AUTH_SESSION_COOKIE = 'ttmmo_session';
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
const requestWindow = new Map<string, { count: number; resetAt: number }>();

function getSessionSecret() {
  return (
    process.env.SESSION_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.JWT_SECRET ||
    process.env.APP_KEY ||
    ''
  );
}

function base64url(bytes: ArrayBuffer) {
  const raw = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
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
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pathname', req.nextUrl.pathname);
  return applySecurityHeaders(NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  }), req);
}

function clearSession(response: NextResponse) {
  response.cookies.set(LEGACY_USER_ID_COOKIE, '', { maxAge: 0, path: '/' });
  response.cookies.set(AUTH_SESSION_COOKIE, '', { maxAge: 0, path: '/' });
  response.cookies.set(TWO_FACTOR_PENDING_COOKIE, '', { maxAge: 0, path: '/' });
  response.cookies.set(LEGACY_TWO_FACTOR_PENDING_COOKIE, '', { maxAge: 0, path: '/' });
  return response;
}

function firstHeaderIp(value: string | null) {
  return value?.split(',')[0]?.trim() || '';
}

function getRequestIp(req: NextRequest) {
  return (
    firstHeaderIp(req.headers.get('cf-connecting-ip')) ||
    firstHeaderIp(req.headers.get('x-forwarded-for')) ||
    req.headers.get('x-real-ip')?.trim() ||
    'unknown'
  ).replace(/^::ffff:/, '');
}

function isStaticPath(pathname: string) {
  return STATIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function buildSecurityHeaders(req: NextRequest) {
  const isDev = process.env.NODE_ENV !== 'production';
  const connectSrc = [
    "'self'",
    'https:',
    'wss:',
    ...(isDev ? ['http://localhost:*', 'ws://localhost:*'] : []),
  ].join(' ');
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
    `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ''}`,
    `connect-src ${connectSrc}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "frame-src 'self' https:",
    ...(req.nextUrl.protocol === 'https:' ? ['upgrade-insecure-requests'] : []),
  ].join('; ');

  return {
    'Content-Security-Policy': csp,
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

function applySecurityHeaders(response: NextResponse, req: NextRequest) {
  for (const [key, value] of Object.entries(buildSecurityHeaders(req))) {
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

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  if (isStaticPath(pathname)) {
    return nextWithPathname(req);
  }

  const suspiciousReason = hasSuspiciousRequest(req);
  if (suspiciousReason) {
    return buildSecurityBlock(req, suspiciousReason, 403);
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
    return nextWithPathname(req);
  }

  if (pathname.startsWith('/api/')) {
    return applySecurityHeaders(clearSession(NextResponse.json(
      { success: false, code: 'INVALID_SESSION', message: 'Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại.' },
      { status: 401 }
    )), req);
  }

  const loginUrl = new URL('/auth/login', req.url);
  loginUrl.searchParams.set('reason', 'invalid-session');
  loginUrl.searchParams.set('next', pathname);
  return applySecurityHeaders(clearSession(NextResponse.redirect(loginUrl)), req);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
