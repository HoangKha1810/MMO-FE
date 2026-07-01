import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerApi } from '@/lib/admin-auth';
import { logOwnerSecurityEvent } from '@/lib/owner-security';
import { clearAdminAiAccessCookie, setAdminAiAccessCookie } from '@/lib/session-cookie';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

function getAdminAiAccessCode() {
  return String(process.env.ADMIN_AI_ACCESS_CODE || '').trim();
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export async function POST(req: NextRequest) {
  const auth = await requireOwnerApi(req);
  if (auth.response || !auth.user) {
    return auth.response as NextResponse;
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '').trim().toLowerCase();

  if (action === 'clear') {
    const response = NextResponse.json({ success: true }, { headers: noStoreHeaders });
    clearAdminAiAccessCookie(response);
    return response;
  }

  const expectedCode = getAdminAiAccessCode();
  if (!expectedCode) {
    return NextResponse.json(
      { success: false, message: 'Chưa cấu hình ADMIN_AI_ACCESS_CODE.' },
      { status: 500, headers: noStoreHeaders }
    );
  }

  const receivedCode = String(body.code || '').trim();
  const ok = Boolean(receivedCode && safeEqual(receivedCode, expectedCode));

  await logOwnerSecurityEvent({
    user: auth.user,
    req,
    eventType: 'ADMIN_AI_ACCESS_CODE',
    layer: 'manual-code',
    verdict: ok ? 'allowed' : 'denied',
    riskScore: ok ? 0 : 70,
    reasons: [ok ? 'admin_ai_code_ok' : 'admin_ai_code_invalid'],
  });

  if (!ok) {
    return NextResponse.json(
      { success: false, message: 'Mã bảo mật Admin AI không đúng.' },
      { status: 401, headers: noStoreHeaders }
    );
  }

  const response = NextResponse.json({ success: true }, { headers: noStoreHeaders });
  setAdminAiAccessCookie(response, auth.user.id, 60 * 30);
  return response;
}

export async function DELETE(req: NextRequest) {
  const auth = await requireOwnerApi(req);
  if (auth.response || !auth.user) {
    return auth.response as NextResponse;
  }

  const response = NextResponse.json({ success: true }, { headers: noStoreHeaders });
  clearAdminAiAccessCookie(response);
  return response;
}
