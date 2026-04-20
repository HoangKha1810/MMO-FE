import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  getSupportConversationMessages,
  getSupportTiktokContext,
} from '@/lib/support-tiktok';

function getClientIp(req: NextRequest) {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip')?.trim() ||
    undefined
  );
}

export async function GET(req: NextRequest) {
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

  const { searchParams } = new URL(req.url);
  const targetUserId = Number(searchParams.get('user_id') || 0);
  const afterId = Number(searchParams.get('after_id') || 0);
  const conversationUserId = context.isSupport && targetUserId > 0 ? targetUserId : userId;

  const messages = await getSupportConversationMessages(
    conversationUserId,
    context.supportUsername,
    afterId > 0 ? afterId : 0
  );

  return NextResponse.json({
    success: true,
    conversation_user_id: conversationUserId,
    messages,
  });
}
