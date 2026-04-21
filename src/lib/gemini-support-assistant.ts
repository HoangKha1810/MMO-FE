import { GoogleGenAI } from '@google/genai';
import { buildKnowledgeContext } from '@/lib/chatbot-knowledge';
import { formatTranscript, lastUserMessage, type AssistantMessage } from '@/lib/assistant-shared';

let geminiClient: GoogleGenAI | null = null;

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  if (!apiKey) {
    throw new Error('Thiếu GEMINI_API_KEY để chạy chatbot người dùng.');
  }

  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey });
  }

  return geminiClient;
}

export async function generateGeminiSupportReply(messages: AssistantMessage[]) {
  const latest = lastUserMessage(messages);
  if (!latest) {
    throw new Error('Không tìm thấy câu hỏi người dùng.');
  }

  const knowledgeContext = await buildKnowledgeContext(latest.content, 6);
  const transcript = formatTranscript(messages);
  const client = getGeminiClient();
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  const prompt = [
    'Tài liệu nội bộ của TRUNGTAMMMO:',
    knowledgeContext,
    '',
    'Lịch sử hội thoại gần đây:',
    transcript,
    '',
    'Hãy trả lời câu hỏi mới nhất của người dùng bằng tiếng Việt rõ ràng, ngắn gọn và theo đúng tài liệu.',
    'Nếu thông tin chưa đủ để xác nhận, hãy nói rõ bạn chưa có đủ dữ liệu và hướng người dùng đến module hoặc bộ phận hỗ trợ phù hợp.',
    'Nếu người dùng hỏi cách thao tác, hãy ưu tiên hướng dẫn theo từng bước.',
  ].join('\n');

  const response = await client.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction:
        'Bạn là chatbot hỗ trợ khách hàng của TRUNGTAMMMO. Bạn chỉ được trả lời dựa trên tài liệu nội bộ được cung cấp, không tự ý thêm chính sách ngoài phạm vi tài liệu. Luôn trả lời bằng tiếng Việt, hướng dẫn thực dụng, thân thiện và dễ hiểu.',
      temperature: 0.3,
    },
  });

  const answer = String(response.text || '').trim();
  if (!answer) {
    throw new Error('Gemini không trả về nội dung phản hồi.');
  }

  return answer;
}
