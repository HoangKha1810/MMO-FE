import { NextRequest, NextResponse } from 'next/server';
import { buildDirectBeApiUrl, getBeApiBaseUrl, withNgrokHeaders } from '@/lib/be-api';

export const dynamic = 'force-dynamic';

function buildTargetUrl(req: NextRequest, pathSegments: string[]) {
  const pathname = `/${pathSegments.join('/')}`;
  const target = new URL(buildDirectBeApiUrl(pathname));

  req.nextUrl.searchParams.forEach((value, key) => {
    target.searchParams.append(key, value);
  });

  return target;
}

function copyResponseHeaders(source: Headers) {
  const headers = new Headers();
  const excluded = new Set([
    'content-encoding',
    'content-length',
    'connection',
    'keep-alive',
    'transfer-encoding',
  ]);

  source.forEach((value, key) => {
    if (!excluded.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  return headers;
}

async function proxyBeRequest(req: NextRequest, pathSegments: string[]) {
  const baseUrl = getBeApiBaseUrl();
  if (!baseUrl) {
    return NextResponse.json(
      { success: false, message: 'Thiếu BE_API_URL hoặc NEXT_PUBLIC_BE_API_URL.' },
      { status: 500 }
    );
  }

  const targetUrl = buildTargetUrl(req, pathSegments);
  const method = req.method.toUpperCase();
  const outgoingHeaders = withNgrokHeaders(undefined, baseUrl);
  const forwardedHeaderNames = [
    'authorization',
    'content-type',
    'accept-language',
    'x-requested-with',
    'x-api-key',
  ];

  for (const key of forwardedHeaderNames) {
    const value = req.headers.get(key);
    if (value) {
      outgoingHeaders.set(key, value);
    }
  }

  const response = await fetch(targetUrl.toString(), {
    method,
    headers: outgoingHeaders,
    body: method === 'GET' || method === 'HEAD' ? undefined : await req.text(),
    cache: 'no-store',
    redirect: 'follow',
  }).catch((error) => {
    return NextResponse.json(
      {
        success: false,
        message: 'Không kết nối được tới BE API.',
        error: error instanceof Error ? error.message : 'Unknown BE API proxy error',
        target: targetUrl.toString(),
      },
      { status: 502 }
    );
  });

  if (response instanceof NextResponse) {
    return response;
  }

  const body = await response.arrayBuffer();
  return new NextResponse(body, {
    status: response.status,
    headers: copyResponseHeaders(response.headers),
  });
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  return proxyBeRequest(req, Array.isArray(path) ? path : []);
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  return proxyBeRequest(req, Array.isArray(path) ? path : []);
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  return proxyBeRequest(req, Array.isArray(path) ? path : []);
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  return proxyBeRequest(req, Array.isArray(path) ? path : []);
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  return proxyBeRequest(req, Array.isArray(path) ? path : []);
}

export async function OPTIONS(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  return proxyBeRequest(req, Array.isArray(path) ? path : []);
}
