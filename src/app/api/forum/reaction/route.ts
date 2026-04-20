import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { reactForumPost } from '@/lib/forum-actions';

async function getUserId() {
  const cookieStore = await cookies();
  return Number(cookieStore.get('user_id')?.value || 0);
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const postId = Number(body.post_id || 0);
    const type = String(body.type || 'like').trim();

    if (!postId) {
      return NextResponse.json({ success: false, message: 'Thiếu ID bài viết' }, { status: 400 });
    }

    const data = await reactForumPost(userId, postId, type);
    return NextResponse.json({ success: true, message: 'Đã cập nhật reaction', data });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể reaction bài viết' },
      { status: 400 }
    );
  }
}
