import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createForumThreadWithPrefix } from '@/lib/forum-actions';

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
    const forumId = Number(body.forum_id || 0);
    const prefixId = Number(body.prefix_id || 0) || undefined;
    const title = String(body.title || '').trim();
    const content = String(body.content || '').trim();

    if (!forumId || title.length < 6 || content.length < 10) {
      return NextResponse.json({ success: false, message: 'Vui lòng nhập đủ folder, tiêu đề và nội dung' }, { status: 400 });
    }

    const thread = await createForumThreadWithPrefix(userId, {
      forumId,
      prefixId,
      title,
      content,
    });
    return NextResponse.json({ success: true, message: 'Đã đăng thread thành công.', data: thread });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không tạo được thread';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
