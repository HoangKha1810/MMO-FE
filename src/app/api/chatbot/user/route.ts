import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import {
  appendAssistantConversationExchange,
  countUserAssistantMessagesToday,
  createAssistantConversation,
  getAssistantConversation,
  getAssistantConversationContext,
  listAssistantConversations,
} from '@/lib/assistant-conversation-store';
import { generateGeminiSupportReply } from '@/lib/gemini-support-assistant';
import { retrieveKnowledgeChunks } from '@/lib/chatbot-knowledge';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DAILY_USER_MESSAGE_LIMIT = 5;

async function getAuthorizedUser() {
  const cookieStore = await cookies();
  const userId = Number(cookieStore.get('user_id')?.value || 0);

  if (!userId) {
    return null;
  }

  const user = await db.users.findUnique({
    where: { id: userId },
    select: { id: true, status: true },
  });

  if (!user || user.status !== 'active') {
    return null;
  }

  return user;
}

async function buildConversationPayload(userId: number, requestedConversationId?: string | null) {
  const conversations = await listAssistantConversations({ userId, audience: 'user' });
  const requestedId = requestedConversationId?.trim() || null;
  let activeConversationId = requestedId || conversations[0]?.id || null;
  let conversation = activeConversationId
    ? await getAssistantConversation(userId, 'user', activeConversationId)
    : null;
  if (!conversation && requestedId && conversations[0]?.id) {
    activeConversationId = conversations[0].id;
    conversation = await getAssistantConversation(userId, 'user', activeConversationId);
  }
  const usedMessagesToday = await countUserAssistantMessagesToday(userId);

  return {
    conversations,
    activeConversationId,
    conversation,
    messages: conversation?.messages || [],
    dailyLimit: DAILY_USER_MESSAGE_LIMIT,
    remainingMessages: Math.max(0, DAILY_USER_MESSAGE_LIMIT - usedMessagesToday),
  };
}

export async function GET(req: Request) {
  const user = await getAuthorizedUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const payload = await buildConversationPayload(
    user.id,
    url.searchParams.get('conversation_id')
  );

  return NextResponse.json({
    success: true,
    ...payload,
  });
}

export async function POST(req: Request) {
  const user = await getAuthorizedUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const action = String(body.action || 'send_message').trim();

    if (action === 'create_conversation') {
      const conversation = await createAssistantConversation({
        userId: user.id,
        audience: 'user',
      });
      const payload = await buildConversationPayload(user.id, conversation?.id || null);

      return NextResponse.json({
        success: true,
        ...payload,
      });
    }

    const content = String(body.content || '').trim();
    const conversationId = String(body.conversationId || '').trim();
    if (!content || !conversationId) {
      return NextResponse.json({ success: false, message: 'Thiếu nội dung hoặc conversation.' }, { status: 400 });
    }

    const usedMessagesToday = await countUserAssistantMessagesToday(user.id);
    if (usedMessagesToday >= DAILY_USER_MESSAGE_LIMIT) {
      return NextResponse.json(
        {
          success: false,
          message: 'Bạn đã dùng hết 5 tin nhắn hôm nay cho chatbot người dùng.',
          dailyLimit: DAILY_USER_MESSAGE_LIMIT,
          remainingMessages: 0,
        },
        { status: 429 }
      );
    }

    const context = await getAssistantConversationContext({
      userId: user.id,
      audience: 'user',
      conversationId,
      includePendingUserMessage: content,
      limit: 18,
    });
    if (!context) {
      return NextResponse.json({ success: false, message: 'Không tìm thấy cuộc trò chuyện.' }, { status: 404 });
    }

    const reply = await generateGeminiSupportReply(context.messages);
    const citations = await retrieveKnowledgeChunks(content, 4);
    const updatedConversation = await appendAssistantConversationExchange({
      userId: user.id,
      audience: 'user',
      conversationId,
      userMessage: content,
      assistantMessage: reply,
    });
    const conversations = await listAssistantConversations({ userId: user.id, audience: 'user' });

    return NextResponse.json({
      success: true,
      conversation: updatedConversation,
      conversations,
      activeConversationId: updatedConversation?.id || conversationId,
      citations: citations.map((item) => ({
        documentId: item.documentId,
        documentTitle: item.documentTitle,
        heading: item.heading,
      })),
      dailyLimit: DAILY_USER_MESSAGE_LIMIT,
      remainingMessages: Math.max(0, DAILY_USER_MESSAGE_LIMIT - usedMessagesToday - 1),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể xử lý chatbot người dùng.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
