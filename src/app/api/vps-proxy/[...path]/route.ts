import { NextRequest } from 'next/server';
import { getVerifiedSessionUserId } from '@/lib/session-cookie';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function buildTargetUrl(request: NextRequest, path: string[]) {
  const targetBase = String(
    process.env.VPS_PORTAL_API_BASE_URL ||
      process.env.NEXT_PUBLIC_VPS_PORTAL_API_BASE_URL ||
      process.env.INTEGRATED_VPS_API_BASE_URL ||
      ''
  ).trim().replace(/\/+$/, '');
  if (!targetBase) {
    throw new Error('Thiếu VPS_PORTAL_API_BASE_URL');
  }

  const normalizedBase = targetBase.replace(/\/api\/?$/, '');
  const upstreamUrl = new URL(`${normalizedBase}/api/${path.join('/')}`);
  request.nextUrl.searchParams.forEach((value, key) => {
    upstreamUrl.searchParams.set(key, value);
  });
  return upstreamUrl;
}

async function proxyRequest(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const userId = await getVerifiedSessionUserId();
  if (!userId) {
    return Response.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { path = [] } = await context.params;
  const targetUrl = buildTargetUrl(request, path);
  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text();

  const upstreamResponse = await fetch(targetUrl, {
    method: request.method,
    headers: {
      Accept: request.headers.get('accept') ?? 'application/json',
      Authorization: request.headers.get('authorization') ?? '',
      'Content-Type': request.headers.get('content-type') ?? '',
    },
    body,
    cache: 'no-store',
  });

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: {
      'Content-Type': upstreamResponse.headers.get('content-type') ?? 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, context);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, context);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, context);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, context);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, context);
}
