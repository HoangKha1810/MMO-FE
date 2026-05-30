export type JsonObject = Record<string, any>;

function looksLikeHtml(text: string) {
  const trimmed = text.trimStart().toLowerCase();
  return trimmed.startsWith('<!doctype') || trimmed.startsWith('<html') || trimmed.startsWith('<');
}

function extractPayloadMessage(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const record = payload as JsonObject;
  return String(record.message || record.error || '').trim();
}

function fallbackResponseMessage(response: Response, bodyText: string, fallbackMessage: string) {
  if (looksLikeHtml(bodyText)) {
    return response.status === 401 || response.status === 403
      ? 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.'
      : 'Máy chủ đang trả về trang HTML thay vì JSON. Kiểm tra lại route API hoặc cấu hình proxy.';
  }

  return bodyText.trim().slice(0, 240) || fallbackMessage;
}

export async function readJsonResponse<T = JsonObject>(
  response: Response,
  fallbackMessage = 'Máy chủ trả về dữ liệu không hợp lệ'
): Promise<T> {
  const text = await response.text();
  let payload: unknown = {};

  if (text.trim()) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(fallbackResponseMessage(response, text, fallbackMessage));
    }
  }

  if (!response.ok) {
    throw new Error(extractPayloadMessage(payload) || fallbackResponseMessage(response, text, fallbackMessage));
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error(fallbackMessage);
  }

  return payload as T;
}
