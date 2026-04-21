import OpenAI from 'openai';
import type { ResponseInput, ResponseInputItem, ResponseFunctionToolCall } from 'openai/resources/responses/responses';
import { buildKnowledgeContext } from '@/lib/chatbot-knowledge';
import { executeAdminAiTool, adminAiTools, type AdminToolContext, type AdminToolExecution } from '@/lib/admin-ai-tools';
import { formatTranscript, lastUserMessage, type AssistantMessage } from '@/lib/assistant-shared';

let openAiClient: OpenAI | null = null;

function getOpenAiClient() {
  const apiKey = process.env.OPENAI_API_KEY || '';
  if (!apiKey) {
    throw new Error('Thiếu OPENAI_API_KEY để chạy AI admin.');
  }

  if (!openAiClient) {
    openAiClient = new OpenAI({ apiKey });
  }

  return openAiClient;
}

function buildInitialInput(transcript: string, knowledgeContext: string): ResponseInput {
  return [
    {
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: [
            'Ngữ cảnh tri thức nội bộ TRUNGTAMMMO:',
            knowledgeContext,
            '',
            'Lịch sử hội thoại gần đây:',
            transcript,
          ].join('\n'),
        },
      ],
    },
  ];
}

function collectToolCalls(output: unknown): ResponseFunctionToolCall[] {
  if (!Array.isArray(output)) {
    return [];
  }

  return output.filter(
    (item): item is ResponseFunctionToolCall =>
      Boolean(item) &&
      typeof item === 'object' &&
      (item as { type?: string }).type === 'function_call' &&
      typeof (item as { name?: unknown }).name === 'string' &&
      typeof (item as { call_id?: unknown }).call_id === 'string'
  );
}

export async function generateOpenAiAdminReply(context: AdminToolContext, messages: AssistantMessage[]) {
  const latest = lastUserMessage(messages);
  if (!latest) {
    throw new Error('Không tìm thấy câu hỏi admin.');
  }

  const client = getOpenAiClient();
  const model = process.env.OPENAI_ADMIN_MODEL || 'gpt-5.4';
  const transcript = formatTranscript(messages);
  const knowledgeContext = await buildKnowledgeContext(latest.content, 6);

  let input: ResponseInput = buildInitialInput(transcript, knowledgeContext);
  const toolTrail: AdminToolExecution[] = [];

  for (let round = 0; round < 6; round += 1) {
    const response = await client.responses.create({
      model,
      instructions:
        'Bạn là AI nội bộ dành cho admin của TRUNGTAMMMO. Bạn có thể dùng tool để đọc database, file trong workspace và biến môi trường khi thật sự cần. Chỉ trả lời bằng tiếng Việt. Ưu tiên dùng tài liệu nội bộ trước, chỉ dùng tool nhạy cảm khi cần xác minh dữ liệu hoặc xem cấu hình. Khi dùng tool, phải giải thích ngắn gọn kết quả cho admin. Không thực thi thao tác ghi, chỉ đọc.',
      input,
      tools: adminAiTools,
      parallel_tool_calls: false,
    });

    const toolCalls = collectToolCalls(response.output);
    if (toolCalls.length === 0) {
      const text = String(response.output_text || '').trim();
      if (!text) {
        throw new Error('OpenAI không trả về nội dung phản hồi.');
      }
      return {
        answer: text,
        toolTrail,
      };
    }

    const toolOutputs: ResponseInputItem[] = [];
    for (const call of toolCalls) {
      const args = call.arguments ? JSON.parse(call.arguments) as Record<string, unknown> : {};
      const execution = await executeAdminAiTool(context, call.name, args);
      toolTrail.push(execution);
      toolOutputs.push({
        type: 'function_call_output',
        call_id: call.call_id,
        output: JSON.stringify(execution.output),
      });
    }

    input = [...input, ...toolCalls, ...toolOutputs];
  }

  throw new Error('OpenAI admin assistant vượt quá số vòng tool call cho phép.');
}
