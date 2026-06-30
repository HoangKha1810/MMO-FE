import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerApi } from '@/lib/admin-auth';
import {
  appendAssistantConversationExchange,
  createAssistantConversation,
  getAssistantConversation,
  getAssistantConversationContext,
  listAssistantConversations,
} from '@/lib/assistant-conversation-store';
import { generateOpenAiAdminReply } from '@/lib/openai-admin-assistant';
import { getChatbotDocumentCatalog } from '@/lib/chatbot-knowledge';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function buildConversationPayload(adminId: number, requestedConversationId?: string | null) {
  const conversations = await listAssistantConversations({ userId: adminId, audience: 'admin' });
  const requestedId = requestedConversationId?.trim() || null;
  let activeConversationId = requestedId || conversations[0]?.id || null;
  let conversation = activeConversationId
    ? await getAssistantConversation(adminId, 'admin', activeConversationId)
    : null;
  if (!conversation && requestedId && conversations[0]?.id) {
    activeConversationId = conversations[0].id;
    conversation = await getAssistantConversation(adminId, 'admin', activeConversationId);
  }

  return {
    conversations,
    activeConversationId,
    conversation,
    messages: conversation?.messages || [],
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireOwnerApi(req);
  if (auth.response || !auth.user) {
    return auth.response as NextResponse;
  }

  const payload = await buildConversationPayload(
    auth.user.id,
    req.nextUrl.searchParams.get('conversation_id')
  );

  return NextResponse.json({
    success: true,
    ...payload,
    documents: getChatbotDocumentCatalog(),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireOwnerApi(req);
  if (auth.response || !auth.user) {
    return auth.response as NextResponse;
  }

  try {
    const body = await req.json();
    const action = String(body.action || 'send_message').trim();

    if (action === 'create_conversation') {
      const conversation = await createAssistantConversation({
        userId: auth.user.id,
        audience: 'admin',
      });
      const payload = await buildConversationPayload(auth.user.id, conversation?.id || null);

      return NextResponse.json({
        success: true,
        ...payload,
        documents: getChatbotDocumentCatalog(),
      });
    }

    const content = String(body.content || '').trim();
    const conversationId = String(body.conversationId || '').trim();
    if (!content || !conversationId) {
      return NextResponse.json({ success: false, message: 'Thiếu nội dung hoặc conversation.' }, { status: 400 });
    }

    const context = await getAssistantConversationContext({
      userId: auth.user.id,
      audience: 'admin',
      conversationId,
      includePendingUserMessage: content,
      limit: 24,
    });
    if (!context) {
      return NextResponse.json({ success: false, message: 'Không tìm thấy cuộc trò chuyện.' }, { status: 404 });
    }

    const result = await generateOpenAiAdminReply({
      adminId: auth.user.id,
      latestUserMessage: content,
      auditRequest: req,
      allowFullAccess: true,
    }, context.messages);
    const updatedConversation = await appendAssistantConversationExchange({
      userId: auth.user.id,
      audience: 'admin',
      conversationId,
      userMessage: content,
      assistantMessage: result.answer,
    });
    const conversations = await listAssistantConversations({ userId: auth.user.id, audience: 'admin' });

    return NextResponse.json({
      success: true,
      conversation: updatedConversation,
      conversations,
      activeConversationId: updatedConversation?.id || conversationId,
      toolTrail: result.toolTrail,
      documents: getChatbotDocumentCatalog(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể xử lý AI admin.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
