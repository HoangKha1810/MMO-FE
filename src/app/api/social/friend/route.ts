import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createFriendRequest } from '@/lib/legacy-modules';

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const userId = Number(cookieStore.get('user_id')?.value || 0);
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const targetUserId = Number(body.target_user_id || body.user_id || 0);

  try {
    const friendship = await createFriendRequest(userId, targetUserId);
    return NextResponse.json({ success: true, message: 'Đã gửi/cập nhật kết nối bạn bè', data: friendship });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'Không thể kết bạn' }, { status: 400 });
  }
}
