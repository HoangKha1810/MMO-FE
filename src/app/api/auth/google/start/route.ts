import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createSessionCookieOptions } from '@/lib/session-cookie';

export const runtime = 'nodejs';

const GOOGLE_OAUTH_STATE_COOKIE = 'ttmmo_google_oauth_state';
const GOOGLE_OAUTH_MODE_COOKIE = 'ttmmo_google_oauth_mode';
const DEFAULT_PUBLIC_ORIGIN = 'https://trungtammmo.vn';

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

export async function GET(req: NextRequest) {
  const clientId = String(process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim();
  if (!clientId) {
    return NextResponse.redirect(new URL('/auth?oauth_error=Thi%E1%BA%BFu%20GOOGLE_OAUTH_CLIENT_ID', publicOrigin(req)));
  }

  const mode = req.nextUrl.searchParams.get('mode') === 'register' ? 'register' : 'login';
  const state = crypto.randomBytes(32).toString('base64url');
  const redirectUri = googleRedirectUri(req);
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');

  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('prompt', 'select_account');

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, createSessionCookieOptions(60 * 10));
  response.cookies.set(GOOGLE_OAUTH_MODE_COOKIE, mode, createSessionCookieOptions(60 * 10));
  return response;
}
