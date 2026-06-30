import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getVerifiedSessionUserId } from '@/lib/session-cookie';

export async function POST(req: NextRequest) {
  const userId = await getVerifiedSessionUserId();
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ success: false, message: 'Email không hợp lệ' }, { status: 400 });
  }

  const duplicate = await db.users.findFirst({
    where: { email, id: { not: userId } },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json({ success: false, message: 'Email đã được sử dụng' }, { status: 409 });
  }

  await db.users.update({
    where: { id: userId },
    data: { email, requires_email_setup: false, email_verified: true, last_activity: new Date() },
  });

  return NextResponse.json({ success: true, message: 'Đã cập nhật email' });
}
