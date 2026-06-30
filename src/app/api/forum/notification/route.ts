import { NextResponse } from 'next/server';
import { getVerifiedSessionUserId } from '@/lib/session-cookie';
import { listForumNotifications, markForumNotificationsRead } from '@/lib/forum-actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

async function getUserId() {
  return getVerifiedSessionUserId();
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });
  }

  const data = await listForumNotifications(userId);
  return NextResponse.json({ success: true, data }, { headers: noStoreHeaders });
}

export async function POST() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });
  }

  await markForumNotificationsRead(userId);
  return NextResponse.json({ success: true, message: 'Đã đánh dấu đã đọc' }, { headers: noStoreHeaders });
}
