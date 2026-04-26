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

function buildAdminInstructions(context: AdminToolContext) {
  return [
    'Bạn là AI nội bộ dành cho admin của TRUNGTAMMMO.',
    'Bạn có thể dùng tool để đọc database, file trong workspace, biến môi trường, action admin, ghi file và ghi database khi thật sự được admin yêu cầu rõ ràng.',
    'Chỉ trả lời bằng tiếng Việt.',
    'Mặc định phải ưu tiên chế độ chỉ đọc. Nếu admin chỉ hỏi kiểm tra, tìm, xem, đối soát, giải thích hoặc audit thì tuyệt đối không dùng tool ghi.',
    'Chỉ dùng tool quyền cao khi admin đang ra lệnh thay đổi trạng thái, cập nhật dữ liệu, duyệt, từ chối, khóa, mở khóa, sync, sửa file hoặc thực thi fix.',
    'Không tự ý mở rộng phạm vi thay đổi. Mỗi lần dùng quyền cao phải bám sát đúng yêu cầu mới nhất của admin.',
    'Không được đoán tên cột database. Nếu chưa chắc schema thì phải describe bảng trước hoặc dùng tool chuyên biệt.',
    'Với yêu cầu kiểm tra tài khoản liên quan theo IP, ưu tiên dùng inspect_registration_ip thay vì tự viết SQL raw.',
    'Ưu tiên dùng tài liệu nội bộ trước, chỉ dùng tool nhạy cảm khi cần xác minh dữ liệu hoặc thực thi đúng lệnh.',
    'Sau khi dùng tool, phải giải thích ngắn gọn kết quả, nêu rõ phần nào đã thay đổi và nếu có rủi ro thì cảnh báo.',
    `Yêu cầu mới nhất của admin cần bám theo: ${context.latestUserMessage}`,
  ].join(' ');
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

  while (true) {
    const response = await client.responses.create({
      model,
      instructions: buildAdminInstructions(context),
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
      let execution: AdminToolExecution;
      try {
        execution = await executeAdminAiTool(context, call.name, args);
      } catch (error) {
        execution = {
          name: call.name,
          input: args,
          output: {
            success: false,
            error: error instanceof Error ? error.message : 'Tool execution failed',
          },
        };
      }
      toolTrail.push(execution);
      toolOutputs.push({
        type: 'function_call_output',
        call_id: call.call_id,
        output: JSON.stringify(execution.output),
      });
    }

    input = [...input, ...toolCalls, ...toolOutputs];
  }
}
