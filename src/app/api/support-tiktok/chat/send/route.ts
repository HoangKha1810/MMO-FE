import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  createSupportConversationMessage,
  getSupportTiktokContext,
} from '@/lib/support-tiktok';

function getClientIp(req: NextRequest) {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip')?.trim() ||
    undefined
  );
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const userId = Number(cookieStore.get('user_id')?.value || 0);

  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const context = await getSupportTiktokContext(userId, getClientIp(req));
  if (!context) {
    return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
  }

  if (!context.canAccess) {
    return NextResponse.json({ success: false, message: 'Module đang bảo trì' }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const message = String(body?.message || '').trim();
  const targetUserId = Number(body?.user_id || 0);

  if (!message) {
    return NextResponse.json(
      { success: false, message: 'Nội dung tin nhắn không được để trống' },
      { status: 400 }
    );
  }

  if (message.length > 2000) {
    return NextResponse.json(
      { success: false, message: 'Tin nhắn tối đa 2000 ký tự' },
      { status: 400 }
    );
  }

  if (context.isSupport && targetUserId <= 0) {
    return NextResponse.json(
      { success: false, message: 'Support cần chọn user để gửi tin nhắn' },
      { status: 400 }
    );
  }

  const conversationUserId = context.isSupport ? targetUserId : userId;
  const created = await createSupportConversationMessage({
    conversationUserId,
    message,
    senderType: context.isSupport ? 'support' : 'user',
    supportUsername: context.supportUsername,
  });

  return NextResponse.json({
    success: true,
    message: created,
  });
}
