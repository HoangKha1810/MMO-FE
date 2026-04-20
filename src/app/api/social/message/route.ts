import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import {
  clearSocialConversation,
  deleteSocialMessage,
  getAdminMessages,
  getConversationPoll,
  getMiniInbox,
  searchSocialDirectory,
  sendSocialMessage,
  setSocialTyping,
} from '@/lib/social';
import { saveUploadedFile } from '@/lib/server-upload';

export const runtime = 'nodejs';

async function getUserId() {
  const cookieStore = await cookies();
  return Number(cookieStore.get('user_id')?.value || 0);
}

export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const mode = String(req.nextUrl.searchParams.get('mode') || 'mini');

  try {
    if (mode === 'search') {
      const keyword = String(req.nextUrl.searchParams.get('q') || '');
      const data = await searchSocialDirectory(userId, keyword);
      return NextResponse.json({ success: true, data });
    }

    if (mode === 'conversation' || mode === 'poll') {
      const otherId = Number(req.nextUrl.searchParams.get('other_id') || 0);
      const afterId = Number(req.nextUrl.searchParams.get('after_id') || 0);
      if (!otherId) {
        return NextResponse.json({ success: false, message: 'Thiếu ID hội thoại' }, { status: 400 });
      }
      const data = await getConversationPoll(userId, otherId, afterId);
      return NextResponse.json({ success: true, data });
    }

    if (mode === 'admin') {
      const data = await getAdminMessages(userId);
      return NextResponse.json({ success: true, data });
    }

    const data = await getMiniInbox(userId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể tải dữ liệu tin nhắn';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    const body = contentType.includes('multipart/form-data') ? await req.formData() : await req.json().catch(() => ({}));
    const getValue = (key: string) => {
      if (body instanceof FormData) {
        const value = body.get(key);
        return typeof value === 'string' ? value.trim() : '';
      }
      return String((body as Record<string, unknown>)[key] || '').trim();
    };
    const action = (getValue('action') || 'send').toLowerCase();

    if (action === 'delete') {
      const messageId = Number(getValue('message_id') || getValue('id') || 0);
      if (!messageId) {
        return NextResponse.json({ success: false, message: 'Thiếu ID tin nhắn' }, { status: 400 });
      }
      const data = await deleteSocialMessage(userId, messageId);
      return NextResponse.json(data);
    }

    if (action === 'clear') {
      const otherId = Number(getValue('other_id') || getValue('receiver_id') || 0);
      if (!otherId) {
        return NextResponse.json({ success: false, message: 'Thiếu người dùng hội thoại' }, { status: 400 });
      }
      const data = await clearSocialConversation(userId, otherId);
      return NextResponse.json(data);
    }

    if (action === 'typing') {
      const otherId = Number(getValue('other_id') || getValue('receiver_id') || 0);
      if (!otherId) {
        return NextResponse.json({ success: false, message: 'Thiếu người nhận typing' }, { status: 400 });
      }
      const data = await setSocialTyping(userId, otherId);
      return NextResponse.json({ success: true, data });
    }

    let attachment = getValue('attachment');
    let fileType = getValue('file_type');
    const receiverId = Number(getValue('receiver_id') || getValue('other_id') || 0);
    const content = getValue('content');

    if (body instanceof FormData) {
      const file = body.get('attachment_file');
      if (file instanceof File && file.size > 0) {
        attachment = await saveUploadedFile({
          file,
          folder: ['social'],
          prefix: `social_${userId}`,
          maxSize: 10 * 1024 * 1024,
          allowedExtensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf', 'zip', 'rar', 'txt'],
        });
        fileType = file.type || fileType;
      }
    }

    if (!receiverId || (content.length < 1 && !attachment)) {
      return NextResponse.json({ success: false, message: 'Thiếu người nhận hoặc nội dung' }, { status: 400 });
    }
    if (receiverId === userId) {
      return NextResponse.json({ success: false, message: 'Không thể tự nhắn cho chính mình' }, { status: 400 });
    }

    const message = await sendSocialMessage({
      senderId: userId,
      receiverId,
      content: content || '[Tệp đính kèm]',
      attachment,
      fileType,
    });
    return NextResponse.json({ success: true, message: 'Đã gửi tin nhắn', data: message });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không gửi được tin nhắn';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
