import { db } from '@/lib/db';
import type { AssistantMessage } from '@/lib/assistant-shared';

export type AssistantAudience = 'user' | 'admin';

interface ConversationRow {
  id: string;
  user_id: number;
  audience: string;
  title: string;
  created_at: Date | string;
  updated_at: Date | string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  created_at: Date | string;
}

const globalAssistantStore = globalThis as unknown as {
  assistantStoreReady?: Promise<void>;
};

const DEFAULT_CONVERSATION_TITLE = 'Cuộc trò chuyện mới';
const LEGACY_DEFAULT_CONVERSATION_TITLE = 'Cuoc tro chuyen moi';

function isoDate(value: Date | string) {
  return new Date(value).toISOString();
}

function nextStoredSecond(previous?: Date | string | null) {
  const now = new Date();
  now.setMilliseconds(0);

  if (!previous) {
    return now;
  }

  const previousDate = new Date(previous);
  if (Number.isNaN(previousDate.getTime())) {
    return now;
  }

  previousDate.setMilliseconds(0);
  const nextAfterPrevious = new Date(previousDate.getTime() + 1000);
  return now.getTime() > nextAfterPrevious.getTime() ? now : nextAfterPrevious;
}

export async function ensureAssistantConversationTables() {
  if (!globalAssistantStore.assistantStoreReady) {
    globalAssistantStore.assistantStoreReady = (async () => {
      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS assistant_conversations (
          id VARCHAR(36) NOT NULL PRIMARY KEY,
          user_id INT NOT NULL,
          audience VARCHAR(20) NOT NULL,
          title VARCHAR(255) NOT NULL,
          created_at DATETIME NOT NULL,
          updated_at DATETIME NOT NULL,
          INDEX idx_assistant_conversations_user_audience_updated (user_id, audience, updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS assistant_messages (
          id VARCHAR(36) NOT NULL PRIMARY KEY,
          conversation_id VARCHAR(36) NOT NULL,
          role VARCHAR(20) NOT NULL,
          content MEDIUMTEXT NOT NULL,
          created_at DATETIME NOT NULL,
          INDEX idx_assistant_messages_conversation_created (conversation_id, created_at),
          CONSTRAINT fk_assistant_messages_conversation
            FOREIGN KEY (conversation_id) REFERENCES assistant_conversations(id)
            ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `).catch(async (error) => {
        const message = error instanceof Error ? error.message : String(error);
        if (!/Duplicate key|already exists|errno: 121|errno: 1826/i.test(message)) {
          throw error;
        }
      });
    })();
  }

  await globalAssistantStore.assistantStoreReady;
}

export function getDefaultAssistantWelcome(audience: AssistantAudience) {
  if (audience === 'admin') {
    return 'AI admin đã sẵn sàng. Tôi có thể dùng tài liệu nội bộ, đọc schema database, chạy truy vấn chỉ đọc, đọc file trong workspace và đọc file .env để hỗ trợ vận hành hệ thống.';
  }

  return 'Xin chào. Tôi là chatbot hỗ trợ TRUNGTAMMMO, có thể giải thích tổng quan hệ thống, hướng dẫn mua SMM, tài nguyên MMO, VPS, nạp tiền và các bước thao tác cơ bản.';
}

export async function listAssistantConversations(input: {
  userId: number;
  audience: AssistantAudience;
}) {
  await ensureAssistantConversationTables();

  const rows = await db.$queryRawUnsafe<Array<ConversationRow & { message_count: bigint | number }>>(
    `
      SELECT c.id, c.user_id, c.audience, c.title, c.created_at, c.updated_at, COUNT(m.id) AS message_count
      FROM assistant_conversations c
      LEFT JOIN assistant_messages m ON m.conversation_id = c.id
      WHERE c.user_id = ? AND c.audience = ?
      GROUP BY c.id, c.user_id, c.audience, c.title, c.created_at, c.updated_at
      ORDER BY c.updated_at DESC
    `,
    input.userId,
    input.audience
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    audience: row.audience,
    created_at: isoDate(row.created_at),
    updated_at: isoDate(row.updated_at),
    message_count: Number(row.message_count || 0),
  }));
}

export async function createAssistantConversation(input: {
  userId: number;
  audience: AssistantAudience;
  title?: string;
}) {
  await ensureAssistantConversationTables();

  const id = crypto.randomUUID();
  const now = new Date();
  const title = String(input.title || DEFAULT_CONVERSATION_TITLE).trim() || DEFAULT_CONVERSATION_TITLE;
  const welcome = getDefaultAssistantWelcome(input.audience);

  await db.$executeRawUnsafe(
    `
      INSERT INTO assistant_conversations (id, user_id, audience, title, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    id,
    input.userId,
    input.audience,
    title,
    now,
    now
  );

  await db.$executeRawUnsafe(
    `
      INSERT INTO assistant_messages (id, conversation_id, role, content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `,
    crypto.randomUUID(),
    id,
    'assistant',
    welcome,
    now
  );

  return getAssistantConversation(input.userId, input.audience, id);
}

export async function getAssistantConversation(
  userId: number,
  audience: AssistantAudience,
  conversationId: string
) {
  await ensureAssistantConversationTables();

  const conversationRows = await db.$queryRawUnsafe<Array<ConversationRow>>(
    `
      SELECT id, user_id, audience, title, created_at, updated_at
      FROM assistant_conversations
      WHERE id = ? AND user_id = ? AND audience = ?
      LIMIT 1
    `,
    conversationId,
    userId,
    audience
  );

  const conversation = conversationRows[0];
  if (!conversation) {
    return null;
  }

  const messageRows = await db.$queryRawUnsafe<Array<MessageRow>>(
    `
      SELECT id, conversation_id, role, content, created_at
      FROM assistant_messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC, CASE WHEN role = 'user' THEN 0 ELSE 1 END, id ASC
    `,
    conversationId
  );

  return {
    id: conversation.id,
    title: conversation.title,
    audience: conversation.audience,
    created_at: isoDate(conversation.created_at),
    updated_at: isoDate(conversation.updated_at),
    messages: messageRows.map((row) => ({
      id: row.id,
      role: row.role as 'user' | 'assistant',
      content: row.content,
      created_at: isoDate(row.created_at),
    })),
  };
}

export async function appendAssistantConversationExchange(input: {
  userId: number;
  audience: AssistantAudience;
  conversationId: string;
  userMessage: string;
  assistantMessage: string;
}) {
  await ensureAssistantConversationTables();

  const latestMessageRows = await db.$queryRawUnsafe<Array<{ created_at: Date | string }>>(
    `
      SELECT created_at
      FROM assistant_messages
      WHERE conversation_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `,
    input.conversationId
  );
  const userCreatedAt = nextStoredSecond(latestMessageRows[0]?.created_at);
  const assistantCreatedAt = new Date(userCreatedAt.getTime() + 1000);

  await db.$executeRawUnsafe(
    `
      INSERT INTO assistant_messages (id, conversation_id, role, content, created_at)
      VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)
    `,
    crypto.randomUUID(),
    input.conversationId,
    'user',
    input.userMessage,
    userCreatedAt,
    crypto.randomUUID(),
    input.conversationId,
    'assistant',
    input.assistantMessage,
    assistantCreatedAt
  );

  const currentTitleRows = await db.$queryRawUnsafe<Array<{ title: string }>>(
    `
      SELECT title
      FROM assistant_conversations
      WHERE id = ? AND user_id = ? AND audience = ?
      LIMIT 1
    `,
    input.conversationId,
    input.userId,
    input.audience
  );

  const currentTitle = String(currentTitleRows[0]?.title || '');
  const fallbackTitle =
    currentTitle === DEFAULT_CONVERSATION_TITLE ||
    currentTitle === LEGACY_DEFAULT_CONVERSATION_TITLE ||
    !currentTitle.trim();
  const nextTitle = fallbackTitle
    ? input.userMessage.replace(/\s+/g, ' ').trim().slice(0, 80)
    : currentTitle;

  await db.$executeRawUnsafe(
    `
      UPDATE assistant_conversations
      SET title = ?, updated_at = ?
      WHERE id = ? AND user_id = ? AND audience = ?
    `,
    nextTitle || DEFAULT_CONVERSATION_TITLE,
    assistantCreatedAt,
    input.conversationId,
    input.userId,
    input.audience
  );

  return getAssistantConversation(input.userId, input.audience, input.conversationId);
}

export async function getAssistantConversationContext(input: {
  userId: number;
  audience: AssistantAudience;
  conversationId: string;
  includePendingUserMessage?: string;
  limit?: number;
}) {
  const conversation = await getAssistantConversation(input.userId, input.audience, input.conversationId);
  if (!conversation) {
    return null;
  }

  const persistedMessages: AssistantMessage[] = conversation.messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  const capped = persistedMessages.slice(-Math.max(1, input.limit || 20));
  if (input.includePendingUserMessage?.trim()) {
    capped.push({
      role: 'user',
      content: input.includePendingUserMessage.trim(),
    });
  }

  return {
    conversation,
    messages: capped,
  };
}

function getVietnamDayBounds(reference = new Date()) {
  const offsetMs = 7 * 60 * 60 * 1000;
  const shifted = new Date(reference.getTime() + offsetMs);
  shifted.setUTCHours(0, 0, 0, 0);
  const startUtc = new Date(shifted.getTime() - offsetMs);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);
  return { startUtc, endUtc };
}

export async function countUserAssistantMessagesToday(userId: number) {
  await ensureAssistantConversationTables();
  const { startUtc, endUtc } = getVietnamDayBounds();
  const rows = await db.$queryRawUnsafe<Array<{ total: bigint | number }>>(
    `
      SELECT COUNT(*) AS total
      FROM assistant_messages m
      INNER JOIN assistant_conversations c ON c.id = m.conversation_id
      WHERE c.user_id = ?
        AND c.audience = 'user'
        AND m.role = 'user'
        AND m.created_at >= ?
        AND m.created_at < ?
    `,
    userId,
    startUtc,
    endUtc
  );

  return Number(rows[0]?.total || 0);
}
