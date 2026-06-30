import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedSessionUserId } from '@/lib/session-cookie';
import { createForumReply } from '@/lib/forum-actions';

async function getUserId() {
  return getVerifiedSessionUserId();
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const threadId = Number(body.thread_id || 0);
    const content = String(body.content || '').trim();

    if (!threadId || content.length < 2) {
      return NextResponse.json({ success: false, message: 'Thiếu thread hoặc nội dung phản hồi' }, { status: 400 });
    }

    const data = await createForumReply(userId, threadId, content);
    return NextResponse.json({ success: true, message: 'Đã gửi phản hồi cho admin duyệt. Khi được duyệt bài mới hiển thị công khai.', data });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không đăng được phản hồi' },
      { status: 400 }
    );
  }
}
