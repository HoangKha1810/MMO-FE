import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  getFriendStatus,
  getSocialCounters,
  listBlockedUsers,
  listPendingFriendRequests,
  listSocialFriendsAdvanced,
  runFriendAction,
} from '@/lib/social';

async function getUserId() {
  const cookieStore = await cookies();
  return Number(cookieStore.get('user_id')?.value || 0);
}

export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const targetUserId = Number(req.nextUrl.searchParams.get('target_user_id') || req.nextUrl.searchParams.get('user_id') || 0);

  try {
    if (targetUserId > 0) {
      const status = await getFriendStatus(userId, targetUserId);
      return NextResponse.json({ success: true, data: status });
    }

    const [friends, pending, blocked, counters] = await Promise.all([
      listSocialFriendsAdvanced(userId),
      listPendingFriendRequests(userId),
      listBlockedUsers(userId),
      getSocialCounters(userId),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        friends,
        pending,
        blocked,
        counters,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể tải social graph' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const targetUserId = Number(body.target_user_id || body.user_id || 0);
  const action = String(body.action || 'request').trim().toLowerCase();

  try {
    const result = await runFriendAction(userId, targetUserId, action);
    return NextResponse.json({
      success: true,
      message: 'message' in result && typeof result.message === 'string' ? result.message : 'Đã cập nhật kết nối bạn bè',
      data: result,
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'Không thể kết bạn' }, { status: 400 });
  }
}
