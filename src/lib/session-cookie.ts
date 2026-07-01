import 'server-only';

import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const AUTH_SESSION_COOKIE = 'ttmmo_session';
export const AUTH_SESSION_ROLE_COOKIE = 'ttmmo_session_role';
export const LEGACY_USER_ID_COOKIE = 'user_id';
export const TWO_FACTOR_PENDING_COOKIE = 'ttmmo_2fa_pending';
export const LEGACY_TWO_FACTOR_PENDING_COOKIE = '2fa_pending';
export const ADMIN_AI_ACCESS_COOKIE = 'ttmmo_admin_ai_access';

const globalForSession = globalThis as unknown as {
  activeSessionUserCache?: Map<number, { active: boolean; expiresAt: number }>;
};

const activeSessionUserCache =
  globalForSession.activeSessionUserCache ?? new Map<number, { active: boolean; expiresAt: number }>();

if (!globalForSession.activeSessionUserCache) {
  globalForSession.activeSessionUserCache = activeSessionUserCache;
}

function base64url(input: Buffer) {
  return input.toString('base64url');
}

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

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Thiếu SESSION_SECRET để ký phiên đăng nhập');
  }

  return 'development-only-session-secret-change-in-env';
}

function signPayload(payload: string) {
  return base64url(crypto.createHmac('sha256', getSessionSecret()).update(payload).digest());
}

function timingSafeEqualString(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function createSessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge,
    path: '/',
  };
}

export function createSignedSessionToken(userId: number, maxAgeSeconds: number) {
  const safeUserId = Math.trunc(Number(userId || 0));
  const expiresAt = Date.now() + Math.max(1, Math.trunc(maxAgeSeconds)) * 1000;
  const payload = `v1.${safeUserId}.${expiresAt}`;
  return `${payload}.${signPayload(payload)}`;
}

export function createSignedSessionRoleToken(userId: number, role: string, maxAgeSeconds: number) {
  const safeUserId = Math.trunc(Number(userId || 0));
  const safeRole = String(role || 'member').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'member';
  const expiresAt = Date.now() + Math.max(1, Math.trunc(maxAgeSeconds)) * 1000;
  const payload = `v1.${safeUserId}.${safeRole}.${expiresAt}`;
  return `${payload}.${signPayload(payload)}`;
}

function createSignedPurposeToken(purpose: string, subjectId: number, maxAgeSeconds: number) {
  const safeSubjectId = Math.trunc(Number(subjectId || 0));
  const safePurpose = String(purpose || '').replace(/[^a-z0-9_-]/gi, '');
  const expiresAt = Date.now() + Math.max(1, Math.trunc(maxAgeSeconds)) * 1000;
  const nonce = base64url(crypto.randomBytes(12));
  const payload = `v2.${safePurpose}.${safeSubjectId}.${expiresAt}.${nonce}`;
  return `${payload}.${signPayload(payload)}`;
}

function verifySignedPurposeToken(purpose: string, token: string | null | undefined) {
  const safePurpose = String(purpose || '').replace(/[^a-z0-9_-]/gi, '');
  if (!safePurpose || !token) {
    return 0;
  }

  const parts = String(token).split('.');
  if (parts.length !== 6 || parts[0] !== 'v2' || parts[1] !== safePurpose) {
    return 0;
  }

  const subjectId = Math.trunc(Number(parts[2] || 0));
  const expiresAt = Number(parts[3] || 0);
  if (!subjectId || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return 0;
  }

  const payload = parts.slice(0, 5).join('.');
  return timingSafeEqualString(signPayload(payload), parts[5]) ? subjectId : 0;
}

export function verifySignedSessionToken(userId: number, token: string | null | undefined) {
  const safeUserId = Math.trunc(Number(userId || 0));
  if (!safeUserId || !token) {
    return false;
  }

  const parts = String(token).split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    return false;
  }

  const tokenUserId = Math.trunc(Number(parts[1] || 0));
  const expiresAt = Number(parts[2] || 0);
  if (tokenUserId !== safeUserId || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return false;
  }

  const payload = parts.slice(0, 3).join('.');
  return timingSafeEqualString(signPayload(payload), parts[3]);
}

async function isActiveSessionUser(userId: number) {
  const safeUserId = Math.trunc(Number(userId || 0));
  if (!safeUserId) {
    return false;
  }

  const cached = activeSessionUserCache.get(safeUserId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.active;
  }

  const user = await db.users.findUnique({
    where: { id: safeUserId },
    select: {
      status: true,
    },
  }).catch(() => null);

  const active = String(user?.status || '').trim().toLowerCase() === 'active';
  activeSessionUserCache.set(safeUserId, {
    active,
    expiresAt: Date.now() + 5_000,
  });
  return active;
}

export function invalidateSessionUserCache(userId: number) {
  const safeUserId = Math.trunc(Number(userId || 0));
  if (safeUserId) {
    activeSessionUserCache.delete(safeUserId);
  }
}

export function setAuthenticatedSessionCookies(response: NextResponse, userId: number, maxAgeSeconds: number, role?: string) {
  const options = createSessionCookieOptions(maxAgeSeconds);
  response.cookies.set(LEGACY_USER_ID_COOKIE, String(Math.trunc(userId)), options);
  response.cookies.set(AUTH_SESSION_COOKIE, createSignedSessionToken(userId, maxAgeSeconds), options);
  if (role) {
    response.cookies.set(AUTH_SESSION_ROLE_COOKIE, createSignedSessionRoleToken(userId, role, maxAgeSeconds), options);
  } else {
    response.cookies.set(AUTH_SESSION_ROLE_COOKIE, '', { maxAge: 0, path: '/' });
  }
}

export function setTwoFactorPendingCookie(response: NextResponse, userId: number, maxAgeSeconds = 60 * 10) {
  response.cookies.set(
    TWO_FACTOR_PENDING_COOKIE,
    createSignedPurposeToken('2fa-pending', userId, maxAgeSeconds),
    createSessionCookieOptions(maxAgeSeconds)
  );
  response.cookies.set(LEGACY_TWO_FACTOR_PENDING_COOKIE, '', { maxAge: 0, path: '/' });
}

export function setAdminAiAccessCookie(response: NextResponse, userId: number, maxAgeSeconds = 60 * 30) {
  response.cookies.set(
    ADMIN_AI_ACCESS_COOKIE,
    createSignedPurposeToken('admin-ai-access', userId, maxAgeSeconds),
    createSessionCookieOptions(maxAgeSeconds)
  );
}

export function clearAdminAiAccessCookie(response: NextResponse) {
  response.cookies.set(ADMIN_AI_ACCESS_COOKIE, '', { maxAge: 0, path: '/' });
}

export async function hasVerifiedAdminAiAccess(userId: number) {
  const cookieStore = await cookies();
  return verifySignedPurposeToken(
    'admin-ai-access',
    cookieStore.get(ADMIN_AI_ACCESS_COOKIE)?.value || ''
  ) === Math.trunc(Number(userId || 0));
}

export function clearTwoFactorPendingCookie(response: NextResponse) {
  response.cookies.set(TWO_FACTOR_PENDING_COOKIE, '', { maxAge: 0, path: '/' });
  response.cookies.set(LEGACY_TWO_FACTOR_PENDING_COOKIE, '', { maxAge: 0, path: '/' });
}

export function clearAuthenticatedSessionCookies(response: NextResponse) {
  response.cookies.set(LEGACY_USER_ID_COOKIE, '', { maxAge: 0, path: '/' });
  response.cookies.set(AUTH_SESSION_COOKIE, '', { maxAge: 0, path: '/' });
  response.cookies.set(AUTH_SESSION_ROLE_COOKIE, '', { maxAge: 0, path: '/' });
  clearAdminAiAccessCookie(response);
  clearTwoFactorPendingCookie(response);
}

export async function getVerifiedSessionUserId() {
  const cookieStore = await cookies();
  const userId = Math.trunc(Number(cookieStore.get(LEGACY_USER_ID_COOKIE)?.value || 0));
  const sessionToken = cookieStore.get(AUTH_SESSION_COOKIE)?.value || '';

  if (!verifySignedSessionToken(userId, sessionToken)) {
    return 0;
  }

  return await isActiveSessionUser(userId) ? userId : 0;
}

export async function getVerifiedPendingTwoFactorUserId() {
  const cookieStore = await cookies();
  return verifySignedPurposeToken(
    '2fa-pending',
    cookieStore.get(TWO_FACTOR_PENDING_COOKIE)?.value || ''
  );
}
