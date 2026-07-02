import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createSessionCookieOptions } from '@/lib/session-cookie';

export const runtime = 'nodejs';

const GOOGLE_OAUTH_STATE_COOKIE = 'ttmmo_google_oauth_state';
const GOOGLE_OAUTH_MODE_COOKIE = 'ttmmo_google_oauth_mode';

function googleRedirectUri(req: NextRequest) {
  return String(process.env.GOOGLE_OAUTH_REDIRECT_URI || new URL('/api/auth/google/callback', req.nextUrl.origin)).trim();
}

export async function GET(req: NextRequest) {
  const clientId = String(process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim();
  if (!clientId) {
    return NextResponse.redirect(new URL('/auth?oauth_error=Thi%E1%BA%BFu%20GOOGLE_OAUTH_CLIENT_ID', req.nextUrl.origin));
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
