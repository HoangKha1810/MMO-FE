import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const IMAGE_CACHE = 'public, max-age=86400, stale-while-revalidate=604800';
const FALLBACK_CACHE = 'public, max-age=300, stale-while-revalidate=3600';

function readFirstEnv(names: string[]) {
  for (const name of names) {
    const value = String(process.env[name] || '').trim();
    if (value) return value;
  }
  return '';
}

function getProviderPrefix(hostname: string) {
  if (/shopreg61\.com$/i.test(hostname)) return 'SHOPREG61';
  return 'RANDOM1K';
}

function isAllowedProviderMediaUrl(url: URL) {
  if (!/^https?:$/i.test(url.protocol)) return false;
  return (
    /(^|\.)random1k\.(?:com|net|vn)$/i.test(url.hostname) ||
    /(^|\.)randomm1k\.vn$/i.test(url.hostname) ||
    /(^|\.)shopreg61\.com$/i.test(url.hostname)
  );
}

function buildProviderHeaders(url: URL) {
  const prefix = getProviderPrefix(url.hostname);
  const userAgent = readFirstEnv([
    `${prefix}_USER_AGENT`,
    `${prefix}_UA`,
    'GAME_ACCOUNT_PROVIDER_USER_AGENT',
  ]) || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
  const fullCookie = readFirstEnv([
    `${prefix}_CLOUDFLARE_COOKIE`,
    `${prefix}_CF_COOKIE`,
    `${prefix}_COOKIE`,
  ]);
  const clearance = readFirstEnv([
    `${prefix}_CF_CLEARANCE`,
    `${prefix}_CLOUDFLARE_CLEARANCE`,
  ]);
  const accessToken = readFirstEnv([
    `${prefix}_ACCESS_TOKEN`,
    `${prefix}_ACCESSTOKEN`,
    `${prefix}_AUTH_TOKEN`,
  ]);
  const cookieParts = [
    fullCookie,
    !fullCookie && clearance ? `cf_clearance=${clearance}` : '',
    accessToken ? `accessToken=${accessToken}` : '',
  ].filter(Boolean);
  const headers: Record<string, string> = {
    Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    Referer: `${url.origin}/`,
    'User-Agent': userAgent,
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
    headers['x-access-token'] = accessToken;
    headers['access-token'] = accessToken;
    headers.accesstoken = accessToken;
  }

  if (cookieParts.length > 0) {
    headers.Cookie = cookieParts.join('; ');
  }

  return headers;
}

function fallbackImage() {
  return new NextResponse(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" role="img" aria-label="Provider image">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#2563eb"/>
          <stop offset=".55" stop-color="#06b6d4"/>
          <stop offset="1" stop-color="#10b981"/>
        </linearGradient>
      </defs>
      <rect width="160" height="160" rx="34" fill="#071527"/>
      <rect x="12" y="12" width="136" height="136" rx="28" fill="url(#g)" opacity=".2"/>
      <path d="M47 91h28l-9 32 47-58H85l9-28z" fill="url(#g)"/>
      <text x="80" y="132" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="800" fill="#dbeafe">API</text>
    </svg>`,
    {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': FALLBACK_CACHE,
      },
    }
  );
}

export async function GET(req: NextRequest) {
  const rawUrl = String(req.nextUrl.searchParams.get('url') || '').trim();
  if (!rawUrl) return fallbackImage();

  let mediaUrl: URL;
  try {
    mediaUrl = new URL(rawUrl);
  } catch {
    return fallbackImage();
  }

  if (!isAllowedProviderMediaUrl(mediaUrl)) {
    return NextResponse.json({ ok: false, message: 'Provider media URL khong hop le' }, { status: 400 });
  }

  try {
    const response = await fetch(mediaUrl.toString(), {
      method: 'GET',
      headers: buildProviderHeaders(mediaUrl),
      cache: 'no-store',
      redirect: 'follow',
    });
    const contentType = response.headers.get('content-type') || '';

    if (!response.ok || !response.body || !/^image\//i.test(contentType)) {
      return fallbackImage();
    }

    return new NextResponse(response.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': IMAGE_CACHE,
      },
    });
  } catch {
    return fallbackImage();
  }
}
