import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedSessionUserId } from '@/lib/session-cookie';
import {
  createSupportConversationMessage,
  ensureSupportTikTokChatTable,
  getSupportTiktokContext,
  validateSupportTikTokChatOrder,
} from '@/lib/support-tiktok';
import { saveUploadedFile } from '@/lib/server-upload';

function getClientIp(req: NextRequest) {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip')?.trim() ||
    undefined
  );
}

function isUploadFile(value: FormDataEntryValue | null): value is File {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'arrayBuffer' in value &&
    'size' in value &&
    Number((value as { size?: unknown }).size || 0) > 0
  );
}

export async function POST(req: NextRequest) {
  try {
    await ensureSupportTikTokChatTable();

    const userId = await getVerifiedSessionUserId();

    if (!userId) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const context = await getSupportTiktokContext(userId, getClientIp(req));
    if (!context) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    if (!context.canAccess) {
      return NextResponse.json({ success: false, message: 'Module đang bảo trì' }, { status: 200 });
    }
    if (!context.chatModuleAvailable) {
      return NextResponse.json({ success: false, message: 'Thiếu bảng support_tiktok_messages' }, { status: 200 });
    }
    if (context.isAdmin) {
      return NextResponse.json(
        { success: false, message: 'Admin không được chat Support TikTok. Hãy dùng tài khoản role support-tiktok.' },
        { status: 403 }
      );
    }
    if (!context.isSupport && !context.canUseChat) {
      return NextResponse.json(
        { success: false, message: context.chatBlockedReason || 'Mua hàng thành công rồi mới chat được.' },
        { status: 200 }
      );
    }

    const contentType = req.headers.get('content-type') || '';
    const body = contentType.includes('multipart/form-data')
      ? await req.formData().catch(() => null)
      : await req.json().catch(() => null);
    const readValue = (key: string) => body instanceof FormData ? String(body.get(key) || '') : String(body?.[key] || '');
    const message = readValue('message').trim();
    const targetUserId = Number(readValue('user_id') || 0);
    const orderId = Number(readValue('order_id') || 0);
    const supportCategory = readValue('support_category').slice(0, 120);
    const imageUrls: string[] = [];

    if (body instanceof FormData) {
      for (const key of ['attachment_file', 'image', 'file']) {
        const file = body.get(key);
        if (isUploadFile(file)) {
          imageUrls.push(await saveUploadedFile({
            file,
            folder: ['support-tiktok', String(context.isSupport ? targetUserId || userId : userId)],
            prefix: `support_${userId}`,
            maxSize: 8 * 1024 * 1024,
            allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
          }));
        }
      }
    }

    if (!message && imageUrls.length === 0) {
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
    if (!context.isSupport && orderId <= 0) {
      return NextResponse.json(
        { success: false, message: 'Vui lòng chọn ID TikTok đã mua trước khi gửi chat.' },
        { status: 400 }
      );
    }

    const order = orderId > 0
      ? await validateSupportTikTokChatOrder({
          orderId,
          conversationUserId,
          isSupport: context.isSupport,
        })
      : null;
    const created = await createSupportConversationMessage({
      conversationUserId,
      orderId: order?.id || null,
      supportCategory: supportCategory || null,
      message: message || '[Ảnh đính kèm]',
      senderType: context.isSupport ? 'support' : 'user',
      supportUsername: context.supportUsername,
      imageUrls,
    });

    return NextResponse.json({
      success: true,
      message: created,
    });
  } catch (error) {
    console.error('[support-tiktok/chat/send]', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Không thể gửi tin nhắn',
      },
      { status: 500 }
    );
  }
}
