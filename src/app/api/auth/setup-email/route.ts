import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getVerifiedSessionUserId } from '@/lib/session-cookie';
import { assertUserEmailAvailable, isValidUserEmail, normalizeUserEmail } from '@/lib/user-email-guard';

export async function POST(req: NextRequest) {
  const userId = await getVerifiedSessionUserId();
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const email = normalizeUserEmail(body.email);
  if (!isValidUserEmail(email)) {
    return NextResponse.json({ success: false, message: 'Email không hợp lệ' }, { status: 400 });
  }

  try {
    await assertUserEmailAvailable(email, userId);
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Email đã được sử dụng' },
      { status: 409 }
    );
  }

  await db.users.update({
    where: { id: userId },
    data: { email, requires_email_setup: false, email_verified: true, last_activity: new Date() },
  });

  return NextResponse.json({ success: true, message: 'Đã cập nhật email' });
}
