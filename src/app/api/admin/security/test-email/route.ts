import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerApi } from '@/lib/admin-auth';
import { sendSystemEmail } from '@/lib/admin-alert-email';
import { siteName } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const auth = await requireOwnerApi(req);
  if (auth.response) {
    return auth.response;
  }

  const body = await req.json().catch(() => ({}));
  const to = String(body.to || body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return NextResponse.json({ success: false, message: 'Email test không hợp lệ.' }, { status: 400 });
  }

  const result = await sendSystemEmail({
    to: [to],
    subject: `[${siteName}] Test SMTP`,
    text: [
      `Đây là email test SMTP từ ${siteName}.`,
      `Người gửi test: ${auth.user?.username || auth.user?.email || 'owner'}`,
      `Thời gian: ${new Date().toISOString()}`,
    ].join('\n'),
  });

  return NextResponse.json({
    success: Boolean(result.sent),
    result,
    message: result.sent
      ? `SMTP đã nhận yêu cầu gửi tới ${to}. Kiểm tra inbox/spam.`
      : String(result.reason || 'SMTP chưa gửi được email test.'),
  }, { status: result.sent ? 200 : 500 });
}
