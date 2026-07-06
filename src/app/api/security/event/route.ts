import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedSessionUserId } from '@/lib/session-cookie';
import { recordSecurityEvent } from '@/lib/security-events';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const sessionUserId = await getVerifiedSessionUserId();
    const details = body?.details && typeof body.details === 'object' && !Array.isArray(body.details)
      ? body.details
      : {};
    const verdict = await recordSecurityEvent(req, {
      eventType: body?.eventType || body?.type || 'CLIENT_SECURITY_EVENT',
      userId: sessionUserId || null,
      field: body?.field || null,
      payload: body?.payload || null,
      details: {
        ...details,
        path: String(body?.path || ''),
        href: String(body?.href || ''),
        source: String(body?.source || 'client'),
        signal: String(body?.signal || ''),
        client_user_agent: String(body?.userAgent || ''),
        language: String(body?.language || ''),
        platform: String(body?.platform || ''),
        timezone: String(body?.timezone || ''),
        tool_name: String(details?.tool_name || body?.tool_name || ''),
        tool_type: String(details?.tool_type || body?.tool_type || ''),
        attempted_code: String(details?.attempted_code || body?.attempted_code || body?.payload || ''),
      },
    });

    return NextResponse.json({
      success: true,
      riskScore: verdict.riskScore,
      severity: verdict.severity,
      autoBanned: verdict.autoBanned,
      bannedUser: verdict.bannedUser,
    });
  } catch {
    return NextResponse.json(
      { success: false, message: 'Không ghi được security event' },
      { status: 500 }
    );
  }
}
