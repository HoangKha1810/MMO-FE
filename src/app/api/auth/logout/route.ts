// src/app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';
import { siteUrl } from '@/lib/seo';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set('user_id', '', { maxAge: 0, path: '/' });
  response.cookies.set('2fa_pending', '', { maxAge: 0, path: '/' });
  response.cookies.set('integrated_ai_bridge', '', { maxAge: 0, path: '/' });
  response.cookies.set('integrated_vps_bridge', '', { maxAge: 0, path: '/' });
  return response;
}

export async function GET() {
  return NextResponse.redirect(new URL('/auth/login', process.env.NEXT_PUBLIC_BASE_URL || siteUrl));
}
