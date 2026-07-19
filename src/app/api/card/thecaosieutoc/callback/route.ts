import { NextRequest, NextResponse } from 'next/server';
import { settleTheCaoSieuTocCardOrder } from '@/lib/thecaosieutoc-card';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function parseCallbackPayload(req: NextRequest) {
  if (req.method === 'GET') {
    return Object.fromEntries(req.nextUrl.searchParams.entries());
  }

  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return req.json().catch(() => ({}));
  }

  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const form = await req.formData().catch(() => null);
    if (form) return Object.fromEntries(form.entries());
  }

  const text = await req.text().catch(() => '');
  return Object.fromEntries(new URLSearchParams(text).entries());
}

async function handleCallback(req: NextRequest) {
  try {
    const payload = await parseCallbackPayload(req);
    const data = await settleTheCaoSieuTocCardOrder(payload, { verifySignature: true });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể xử lý callback thẻ';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  return handleCallback(req);
}

export async function POST(req: NextRequest) {
  return handleCallback(req);
}
