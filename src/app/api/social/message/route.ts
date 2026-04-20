import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { sendPrivateMessage } from '@/lib/legacy-modules';

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
    const receiverId = Number(body.receiver_id || 0);
    const content = String(body.content || '').trim();
    if (!receiverId || content.length < 1) {
      return NextResponse.json({ success: false, message: 'Thiếu người nhận hoặc nội dung' }, { status: 400 });
    }
    if (receiverId === userId) {
      return NextResponse.json({ success: false, message: 'Không thể tự nhắn cho chính mình' }, { status: 400 });
    }

    await sendPrivateMessage(userId, receiverId, content);
    return NextResponse.json({ success: true, message: 'Đã gửi tin nhắn' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không gửi được tin nhắn';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
