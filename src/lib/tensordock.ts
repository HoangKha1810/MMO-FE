const DEFAULT_TENSORDOCK_API_BASE_URL = 'https://dashboard.tensordock.com/api/v2';

export class TensorDockApiError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = 'TensorDockApiError';
    this.status = status;
  }
}

function getTensorDockBaseUrl() {
  return String(process.env.TENSORDOCK_API_BASE_URL || DEFAULT_TENSORDOCK_API_BASE_URL)
    .trim()
    .replace(/\/+$/, '');
}

function getTensorDockToken() {
  return String(process.env.TENSORDOCK_API_TOKEN || '').trim();
}

function getTensorDockAuthorizationId() {
  return String(process.env.TENSORDOCK_AUTHORIZATION_ID || '').trim();
}

export function isTensorDockConfigured() {
  return Boolean(getTensorDockToken());
}

export async function tensorDockRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = getTensorDockToken();
  if (!token) {
    throw new Error('Thiếu TENSORDOCK_API_TOKEN');
  }

  const baseUrl = getTensorDockBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const authorizationId = getTensorDockAuthorizationId();
  let response: Response;

  try {
    response = await fetch(`${baseUrl}${normalizedPath}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(authorizationId ? { 'X-Authorization-ID': authorizationId } : {}),
        ...(init.headers || {}),
      },
      cache: 'no-store',
    });
  } catch {
    throw new TensorDockApiError(
      `Không kết nối được TensorDock API ${normalizedPath}. Kiểm tra mạng server, DNS/firewall hoặc TENSORDOCK_API_BASE_URL.`,
      502
    );
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as { message?: unknown }).message || '')
        : '';
    throw new TensorDockApiError(
      message
        ? `TensorDock API ${normalizedPath} trả HTTP ${response.status}: ${message}`
        : `TensorDock API ${normalizedPath} trả HTTP ${response.status}`,
      response.status
    );
  }

  return payload as T;
}

export function buildTensorDockQuery(params: Record<string, string | number | null | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') {
      return;
    }
    search.set(key, String(value));
  });

  const query = search.toString();
  return query ? `?${query}` : '';
}
