import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { reportForumPost } from '@/lib/forum-actions';

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
    const reason = String(body.reason || '').trim();
    const details = String(body.details || '').trim();

    if (!postId || reason.length < 3) {
      return NextResponse.json({ success: false, message: 'Thiếu bài viết hoặc lý do report' }, { status: 400 });
    }

    const data = await reportForumPost(userId, { postId, reason, details });
    return NextResponse.json({ success: true, message: 'Đã gửi report', data });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể gửi report' },
      { status: 400 }
    );
  }
}
