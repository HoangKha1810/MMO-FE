export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function normalizeAssistantMessages(input: unknown): AssistantMessage[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => {
      const role = item && typeof item === 'object' ? String((item as { role?: unknown }).role || '') : '';
      const content = item && typeof item === 'object' ? String((item as { content?: unknown }).content || '') : '';
      if ((role === 'user' || role === 'assistant') && content.trim()) {
        return {
          role,
          content: content.trim().slice(0, 6000),
        } satisfies AssistantMessage;
      }
      return null;
    })
    .filter((item): item is AssistantMessage => Boolean(item))
    .slice(-12);
}

export function formatTranscript(messages: AssistantMessage[]) {
  return messages
    .map((message) => `${message.role === 'user' ? 'Người dùng' : 'Trợ lý'}: ${message.content}`)
    .join('\n');
}

export function lastUserMessage(messages: AssistantMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') {
      return messages[index];
    }
  }
  return null;
}
