import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { isAdminRole, isOwnerRole } from '@/lib/admin-permissions';
import { ensureBlueTickTables } from '@/lib/blue-tick';
import { db } from '@/lib/db';
import { getIpBlock, getRequestIp, logSecurityEvent } from '@/lib/ip-security';
import { findOAuthAccount, upsertOAuthAccount } from '@/lib/oauth-accounts';
import { logOwnerSecurityEvent } from '@/lib/owner-security';
import { evaluateRegistrationRisk } from '@/lib/registration-security';
import {
  clearTwoFactorPendingCookie,
  setAuthenticatedSessionCookies,
} from '@/lib/session-cookie';
import { isSupportTikTokStaffRole } from '@/lib/support-tiktok';
import { assertUserEmailUniqueForLogin, normalizeUserEmail } from '@/lib/user-email-guard';

export const runtime = 'nodejs';

const GOOGLE_OAUTH_STATE_COOKIE = 'ttmmo_google_oauth_state';
const GOOGLE_OAUTH_MODE_COOKIE = 'ttmmo_google_oauth_mode';
const GOOGLE_PROVIDER = 'google';
const DEFAULT_PUBLIC_ORIGIN = 'https://trungtammmo.vn';

interface GoogleTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  id_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleProfile {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

const userSelect = {
  id: true,
  username: true,
  email: true,
  balance: true,
  game_balance: true,
  rank: true,
  role: true,
  status: true,
  avatar: true,
  is_blue_tick: true,
  blue_tick_expiry: true,
  fa_enabled: true,
  email_verified: true,
  requires_email_setup: true,
  created_at: true,
} as const;

function normalizePublicOrigin(value: string) {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(trimmed)) {
    return '';
  }

  return trimmed;
}

function publicOrigin(req: NextRequest) {
  const configured = [
    process.env.GOOGLE_OAUTH_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.SITE_URL,
    process.env.CANONICAL_SITE_URL,
    process.env.NEXT_PUBLIC_BASE_URL,
    process.env.APP_URL,
  ]
    .map((value) => normalizePublicOrigin(String(value || '')))
    .find(Boolean);

  if (configured) {
    return configured;
  }

  const forwardedHost = String(req.headers.get('x-forwarded-host') || '').split(',')[0]?.trim();
  if (forwardedHost && !/^localhost(?::\d+)?$/i.test(forwardedHost)) {
    const forwardedProto = String(req.headers.get('x-forwarded-proto') || 'https').split(',')[0]?.trim() || 'https';
    return `${forwardedProto}://${forwardedHost}`.replace(/\/+$/, '');
  }

  const requestOrigin = normalizePublicOrigin(req.nextUrl.origin);
  if (requestOrigin && !/^https?:\/\/localhost(?::\d+)?$/i.test(requestOrigin)) {
    return requestOrigin;
  }

  return DEFAULT_PUBLIC_ORIGIN;
}

function googleRedirectUri(req: NextRequest) {
  return String(process.env.GOOGLE_OAUTH_REDIRECT_URI || new URL('/api/auth/google/callback', publicOrigin(req))).trim();
}

function clearGoogleOAuthCookies(response: NextResponse) {
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, '', { maxAge: 0, path: '/' });
  response.cookies.set(GOOGLE_OAUTH_MODE_COOKIE, '', { maxAge: 0, path: '/' });
}

function redirectWithOauthError(req: NextRequest, message: string, mode?: string | null) {
  const url = new URL('/auth', publicOrigin(req));
  if (mode === 'register') {
    url.searchParams.set('tab', 'register');
  }
  url.searchParams.set('oauth_error', message);
  const response = NextResponse.redirect(url);
  clearGoogleOAuthCookies(response);
  return response;
}

async function exchangeCodeForToken(req: NextRequest, code: string) {
  const clientId = String(process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.GOOGLE_OAUTH_CLIENT_SECRET || '').trim();

  if (!clientId || !clientSecret) {
    throw new Error('Thiếu GOOGLE_OAUTH_CLIENT_ID hoặc GOOGLE_OAUTH_CLIENT_SECRET.');
  }

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: googleRedirectUri(req),
    grant_type: 'authorization_code',
  });

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const tokenJson = await tokenResponse.json().catch(() => ({})) as GoogleTokenResponse;
  if (!tokenResponse.ok || !tokenJson.access_token) {
    throw new Error(tokenJson.error_description || tokenJson.error || 'Không lấy được Google access token.');
  }

  return tokenJson;
}

async function loadGoogleProfile(accessToken: string) {
  const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const profile = await profileResponse.json().catch(() => ({})) as GoogleProfile;
  if (!profileResponse.ok || !profile.sub || !profile.email) {
    throw new Error('Không lấy được thông tin Google profile.');
  }

  if (profile.email_verified !== true) {
    throw new Error('Google chưa xác thực email này. Vui lòng dùng email Google đã xác thực.');
  }

  return profile;
}

async function makeUniqueGoogleUsername(email: string, name?: string | null) {
  const emailPrefix = email.split('@')[0] || 'googleuser';
  const normalizedName = String(name || emailPrefix)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '')
    .replace(/^[-_.]+|[-_.]+$/g, '')
    .slice(0, 34);

  const base = normalizedName || emailPrefix.toLowerCase().replace(/[^a-z0-9_.-]+/g, '').slice(0, 34) || 'googleuser';

  for (let index = 0; index < 20; index += 1) {
    const suffix = index === 0 ? '' : crypto.randomInt(1000, 999999).toString();
    const candidate = `${base}${suffix}`.slice(0, 50);
    const existing = await db.users.findUnique({
      where: { username: candidate },
      select: { id: true },
    }).catch(() => null);

    if (!existing) {
      return candidate;
    }
  }

  return `g${crypto.randomBytes(12).toString('hex')}`.slice(0, 50);
}

async function createGoogleUser(input: {
  req: NextRequest;
  email: string;
  profile: GoogleProfile;
  ip: string;
}) {
  const username = await makeUniqueGoogleUsername(input.email, input.profile.name);
  const password = await bcrypt.hash(crypto.randomBytes(36).toString('base64url'), 10);
  const fullname = String(input.profile.name || username).trim().slice(0, 100);
  const avatar = input.profile.picture && input.profile.picture.length <= 255 ? input.profile.picture : undefined;

  const user = await db.users.create({
    data: {
      username,
      email: input.email,
      password,
      fullname,
      role: 'member',
      status: 'active',
      balance: 0,
      game_balance: 0,
      rank: 'Member',
      avatar,
      last_ip: input.ip,
      last_login: new Date(),
      last_activity: new Date(),
      email_verified: true,
      requires_email_setup: false,
    },
    select: userSelect,
  });

  await db.activity_logs.create({
    data: {
      user_id: user.id,
      activity: `Đăng ký bằng Google OAuth từ IP ${input.ip}`,
      ip_address: input.ip,
      user_agent: input.req.headers.get('user-agent') || undefined,
    },
  }).catch(() => undefined);

  return user;
}

export async function GET(req: NextRequest) {
  const mode = req.cookies.get(GOOGLE_OAUTH_MODE_COOKIE)?.value || req.nextUrl.searchParams.get('mode') || 'login';
  const ip = getRequestIp(req);
  const blockedIp = await getIpBlock(ip);
  if (blockedIp) {
    await logSecurityEvent({
      eventType: 'GOOGLE_OAUTH_BLOCKED_IP',
      severity: 'HIGH',
      ip,
      uri: req.nextUrl.pathname,
      method: req.method,
      field: 'ip',
      payload: String(blockedIp.reason || 'blocked'),
      userAgent: req.headers.get('user-agent'),
    });
    return redirectWithOauthError(req, blockedIp.reason || 'Địa chỉ IP của bạn đã bị chặn. Vui lòng liên hệ admin để mở khóa.', mode);
  }

  const expectedState = req.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value || '';
  const state = req.nextUrl.searchParams.get('state') || '';
  const code = req.nextUrl.searchParams.get('code') || '';
  const googleError = req.nextUrl.searchParams.get('error') || '';

  if (googleError) {
    return redirectWithOauthError(req, `Google OAuth bị hủy hoặc lỗi: ${googleError}`, mode);
  }

  if (!expectedState || !state || expectedState !== state) {
    await logSecurityEvent({
      eventType: 'GOOGLE_OAUTH_STATE_MISMATCH',
      severity: 'HIGH',
      ip,
      uri: req.nextUrl.pathname,
      method: req.method,
      field: 'state',
      payload: 'oauth_state_mismatch',
      userAgent: req.headers.get('user-agent'),
    });
    return redirectWithOauthError(req, 'Phiên đăng nhập Google không hợp lệ. Vui lòng thử lại.', mode);
  }

  if (!code) {
    return redirectWithOauthError(req, 'Google không trả về mã xác thực. Vui lòng thử lại.', mode);
  }

  try {
    await ensureBlueTickTables();

    const token = await exchangeCodeForToken(req, code);
    const profile = await loadGoogleProfile(token.access_token || '');
    const normalizedEmail = normalizeUserEmail(profile.email);
    const oauthAccount = await findOAuthAccount(GOOGLE_PROVIDER, profile.sub || '');
    const linkedUserId = oauthAccount?.user_id ? Math.trunc(Number(oauthAccount.user_id)) : 0;

    let user = linkedUserId
      ? await db.users.findUnique({ where: { id: linkedUserId }, select: userSelect })
      : null;

    if (!user) {
      user = await db.users.findUnique({
        where: { email: normalizedEmail },
        select: userSelect,
      });
    }

    const risk = await evaluateRegistrationRisk({
      req,
      email: normalizedEmail,
      provider: 'google',
      intent: user ? 'login' : 'signup',
      username: user?.username || null,
    });

    if (!risk.allowed) {
      return redirectWithOauthError(req, risk.message, mode);
    }

    if (!user) {
      user = await createGoogleUser({
        req,
        email: normalizedEmail,
        profile,
        ip,
      });
    } else {
      try {
        await assertUserEmailUniqueForLogin(user.email, user.id);
      } catch (error) {
        return redirectWithOauthError(
          req,
          error instanceof Error ? error.message : 'Email tài khoản đang bị trùng, vui lòng liên hệ owner/admin.',
          mode
        );
      }

      if (user.status === 'suspended' && !user.email_verified && user.requires_email_setup) {
        user = await db.users.update({
          where: { id: user.id },
          data: {
            status: 'active',
            email_verified: true,
            requires_email_setup: false,
            last_ip: ip,
            last_login: new Date(),
            last_activity: new Date(),
          },
          select: userSelect,
        });
      }
    }

    const role = String(user.role || 'member');
    if (isOwnerRole(role) || isAdminRole(role)) {
      await logSecurityEvent({
        eventType: 'GOOGLE_OAUTH_ADMIN_BLOCKED',
        severity: 'HIGH',
        ip,
        userId: user.id,
        uri: req.nextUrl.pathname,
        method: req.method,
        field: 'role',
        payload: role,
        userAgent: req.headers.get('user-agent'),
      });
      return redirectWithOauthError(req, 'Tài khoản admin/owner không được đăng nhập qua Google OAuth public.', mode);
    }

    if (user.status === 'banned' || user.status === 'locked') {
      await logSecurityEvent({
        eventType: 'GOOGLE_OAUTH_BLOCKED_USER',
        severity: 'HIGH',
        ip,
        userId: user.id,
        uri: req.nextUrl.pathname,
        method: req.method,
        field: 'status',
        payload: String(user.status),
        userAgent: req.headers.get('user-agent'),
      });
      return redirectWithOauthError(req, 'Tài khoản đã bị khóa. Vui lòng liên hệ owner để mở khóa.', mode);
    }

    if (user.status !== 'active') {
      return redirectWithOauthError(req, 'Tài khoản không hoạt động hoặc chưa được kích hoạt.', mode);
    }

    await upsertOAuthAccount({
      userId: user.id,
      provider: GOOGLE_PROVIDER,
      providerAccountId: profile.sub || '',
      email: normalizedEmail,
    });

    await db.users.update({
      where: { id: user.id },
      data: {
        last_ip: ip,
        last_login: new Date(),
        last_activity: new Date(),
        email_verified: true,
        requires_email_setup: false,
      },
    }).catch(() => undefined);

    await logOwnerSecurityEvent({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role,
      },
      req,
      eventType: user.created_at && Date.now() - new Date(user.created_at).getTime() < 60_000
        ? 'GOOGLE_OAUTH_REGISTER'
        : 'GOOGLE_OAUTH_LOGIN',
      layer: 'audit',
      verdict: 'google_verified',
      riskScore: risk.riskScore,
      reasons: risk.reasons,
      details: {
        provider: GOOGLE_PROVIDER,
        google_sub: profile.sub,
        email_verified: profile.email_verified,
      },
    }).catch(() => undefined);

    const redirectPath = isSupportTikTokStaffRole(role) ? '/user/support-tiktok' : '/user/home';
    const response = NextResponse.redirect(new URL(redirectPath, publicOrigin(req)));
    clearGoogleOAuthCookies(response);
    clearTwoFactorPendingCookie(response);
    setAuthenticatedSessionCookies(response, user.id, 60 * 60 * 24, role);
    return response;
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return redirectWithOauthError(
      req,
      error instanceof Error ? error.message : 'Không đăng nhập được bằng Google. Vui lòng thử lại.',
      mode
    );
  }
}
