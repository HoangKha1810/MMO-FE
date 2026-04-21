import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupportConversations, getSupportTiktokContext } from '@/lib/support-tiktok';

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

  if (!context.isSupport) {
    return NextResponse.json({ success: false, message: 'Không có quyền truy cập' }, { status: 403 });
  }
  if (!context.chatModuleAvailable) {
    return NextResponse.json({ success: false, message: 'Thiếu bảng support_tiktok_messages' }, { status: 500 });
  }

  const conversations = await getSupportConversations();
  return NextResponse.json({
    success: true,
    conversations,
  });
}
