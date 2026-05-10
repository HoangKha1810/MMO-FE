import {
  AuthPayload,
  RegisterPayload,
  AuthResponse,
  BatchDeleteResponse,
  CatalogResponse,
  ChatSession,
  ChatTurnPayload,
  ConversationCreatePayload,
  ConversationUpdatePayload,
  DeleteConversationResponse,
  PricingCatalog,
  PricingOrder,
  PricingOrderAdminUpdatePayload,
  PricingOrderCreatePayload,
  PricingPlan,
  PricingPlanInput,
  PricingUpdateWaitResponse,
  RevealPayload,
  SessionTurn,
  ShareConversationResponse,
  StopStreamPayload,
  StopStreamResponse,
  StreamEvent,
  UploadedAsset,
  WebSummaryPayload,
  WebSummaryResponse,
  ToolImageGeneratePayload,
  ToolImageGenerateResponse,
  ToolTranslatePayload,
  ToolTranslateResponse,
  VoteChoice,
  VoteResponse
} from "./types";
import {
  clearAuthToken,
  clearAuthUser,
  loadAuthToken
} from "./storage";

const API_BASE =
  process.env.NEXT_PUBLIC_AI_ARENA_API_BASE_URL ?? "/api/ai-proxy";
const isNgrokApi = /https:\/\/[^/]*ngrok(?:-free)?\.(?:dev|app|io)\b/i.test(API_BASE);

const notifyAuthExpired = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("ttmmo-ai-auth-expired"));
  }
};

const buildHeaders = (init?: RequestInit, isJson = true) => {
  const token = loadAuthToken();
  const method = (init?.method ?? "GET").toUpperCase();
  const shouldAttachJsonHeader = isJson && method !== "GET" && method !== "HEAD";

  return {
    Accept: "application/json",
    ...(shouldAttachJsonHeader ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(isNgrokApi ? { "ngrok-skip-browser-warning": "true" } : {}),
    ...(init?.headers ?? {})
  };
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: buildHeaders(init),
    ...init
  });

  const rawText = await response.text();
  let payload:
    | (T & {
        detail?: string;
        message?: string;
      })
    | string
    | null = null;

  if (rawText) {
    try {
      payload = JSON.parse(rawText) as T & {
        detail?: string;
        message?: string;
      };
    } catch {
      payload = rawText;
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearAuthToken();
      clearAuthUser();
      notifyAuthExpired();
    }

    if (typeof payload === "string") {
      throw new Error(
        payload === "Internal Server Error"
          ? "Backend đang gặp lỗi nội bộ. Hãy xem terminal BE để biết chi tiết."
          : payload
      );
    }

    throw new Error(
      payload?.detail ?? payload?.message ?? "Không thể kết nối backend."
    );
  }

  return (payload ?? {}) as T;
};

const fileNameFromDisposition = (value: string | null, fallback: string) => {
  if (!value) {
    return fallback;
  }

  const match = /filename="?([^"]+)"?/i.exec(value);
  return match?.[1] ?? fallback;
};

export const getCatalog = () => request<CatalogResponse>("/api/models");

export const getHealth = () =>
  request<{ ok: boolean; app: string; timestamp: string }>("/api/health");

export const getMe = () => request<import("./types").User>("/api/auth/me");

export const loginAi = (payload: AuthPayload) =>
  request<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const registerAi = (payload: RegisterPayload) =>
  request<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const loginAdminAi = (payload: AuthPayload) =>
  request<AuthResponse>("/api/admin/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const logoutAi = () =>
  request<{ ok: boolean; message: string }>("/api/auth/logout", {
    method: "POST"
  });

export const getConversations = (search = "", mode = "") => {
  const params = new URLSearchParams();
  if (search.trim()) {
    params.set("search", search.trim());
  }
  if (mode.trim()) {
    params.set("mode", mode.trim());
  }
  const query = params.toString();
  return request<ChatSession[]>(`/api/conversations${query ? `?${query}` : ""}`);
};

export const getPricingPlans = (audience = "") => {
  const params = new URLSearchParams();
  if (audience.trim()) {
    params.set("audience", audience.trim());
  }
  const query = params.toString();
  return request<PricingCatalog>(`/api/pricing/plans${query ? `?${query}` : ""}`);
};

export const getAdminPricingPlans = (audience = "") => {
  const params = new URLSearchParams();
  if (audience.trim()) {
    params.set("audience", audience.trim());
  }
  const query = params.toString();
  return request<PricingCatalog>(`/api/admin/pricing/plans${query ? `?${query}` : ""}`);
};

export const createAdminPricingPlan = (payload: PricingPlanInput) =>
  request<PricingPlan>("/api/admin/pricing/plans", {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const updateAdminPricingPlan = (planId: number, payload: PricingPlanInput) =>
  request<PricingPlan>(`/api/admin/pricing/plans/${planId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });

export const updateAdminPricingPlanAllowedModels = (
  planId: number,
  payload: { allowedModelIds?: string[] | null }
) =>
  request<PricingPlan>(`/api/admin/pricing/plans/${planId}/allowed-models`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });

export const deleteAdminPricingPlan = (planId: number) =>
  request<{ ok: boolean; planId: number }>(`/api/admin/pricing/plans/${planId}`, {
    method: "DELETE"
  });

export const createPricingOrder = (payload: PricingOrderCreatePayload) =>
  request<PricingOrder>("/api/pricing/orders", {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const getAdminPricingOrders = (search = "", status = "") => {
  const params = new URLSearchParams();
  if (search.trim()) {
    params.set("search", search.trim());
  }
  if (status.trim()) {
    params.set("status", status.trim());
  }
  const query = params.toString();
  return request<PricingOrder[]>(`/api/admin/pricing/orders${query ? `?${query}` : ""}`);
};

export const updateAdminPricingOrder = (
  orderId: number,
  payload: PricingOrderAdminUpdatePayload
) =>
  request<PricingOrder>(`/api/admin/pricing/orders/${orderId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });

export const waitForPricingUpdate = (since = 0, timeout = 25) => {
  const params = new URLSearchParams();
  params.set("since", String(since));
  params.set("timeout", String(timeout));
  return request<PricingUpdateWaitResponse>(`/api/pricing/updates/wait?${params.toString()}`);
};

export const getSharedConversation = (shareSlug: string) =>
  request<ChatSession>(`/api/shared/${shareSlug}`);

export const createConversation = (payload: ConversationCreatePayload) =>
  request<ChatSession>("/api/conversations", {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const updateConversation = (
  conversationId: string,
  payload: ConversationUpdatePayload
) =>
  request<ChatSession>(`/api/conversations/${conversationId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });

export const batchDeleteConversations = (conversationIds: string[]) =>
  request<BatchDeleteResponse>("/api/conversations/batch-delete", {
    method: "POST",
    body: JSON.stringify({
      conversationIds
    })
  });

export const createConversationShare = (conversationId: string) =>
  request<ShareConversationResponse>(`/api/conversations/${conversationId}/share`, {
    method: "POST"
  });

export const deleteConversation = (conversationId: string) =>
  request<DeleteConversationResponse>(`/api/conversations/${conversationId}`, {
    method: "DELETE"
  });

export const sendArenaTurn = (payload: ChatTurnPayload) =>
  request<ChatSession>("/api/chat", {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const regenerateArenaTurn = (conversationId: string, turnId: string) =>
  request<ChatSession>("/api/chat/regenerate", {
    method: "POST",
    body: JSON.stringify({
      conversationId,
      turnId
    })
  });

export const uploadAsset = (payload: {
  fileName: string;
  contentType: string;
  dataBase64: string;
}) =>
  request<UploadedAsset>("/api/upload", {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const summarizeWebsite = (payload: WebSummaryPayload) =>
  request<WebSummaryResponse>("/api/tools/web-summary", {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const translateTextTool = (payload: ToolTranslatePayload) =>
  request<ToolTranslateResponse>("/api/tools/translate", {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const generateImageTool = (payload: ToolImageGeneratePayload) =>
  request<ToolImageGenerateResponse>("/api/tools/image-generate", {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const sendArenaTurnStream = async (
  payload: ChatTurnPayload,
  onEvent: (event: StreamEvent) => void
) => {
  const body = JSON.stringify(payload);
  const response = await fetch(`${API_BASE}/api/chat/stream`, {
    method: "POST",
    headers: buildHeaders({ method: "POST", body }),
    body
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearAuthToken();
      clearAuthUser();
      notifyAuthExpired();
    }

    const message = await response.text();
    try {
      const parsed = JSON.parse(message) as { detail?: string };
      throw new Error(parsed.detail ?? "Không thể stream câu trả lời.");
    } catch {
      throw new Error(message || "Không thể stream câu trả lời.");
    }
  }

  if (!response.body) {
    throw new Error("Trình duyệt không hỗ trợ stream phản hồi.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf("\n\n");

    while (boundary >= 0) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      const payloadText = rawEvent
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.replace(/^data:\s?/, ""))
        .join("\n");

      if (payloadText) {
        const event = JSON.parse(payloadText) as StreamEvent;
        onEvent(event);
        if (event.type === "error") {
          throw new Error(event.error || "Luồng stream bị lỗi.");
        }
      }

      boundary = buffer.indexOf("\n\n");
    }
  }
};

export const stopArenaTurnStream = (payload: StopStreamPayload) =>
  request<StopStreamResponse>("/api/chat/stop", {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const revealBattleTurn = (payload: RevealPayload) =>
  request<SessionTurn>("/api/chat/reveal", {
    method: "POST",
    body: JSON.stringify(payload)
  });

export const submitBattleVote = (turnId: string, choice: VoteChoice) =>
  request<VoteResponse>("/api/chat/vote", {
    method: "POST",
    body: JSON.stringify({
      turnId,
      choice
    })
  });

export const downloadConversationExport = async (
  conversationId: string,
  format: "markdown" | "pdf"
) => {
  const response = await fetch(
    `${API_BASE}/api/conversations/${conversationId}/export?format=${format}`,
    {
      headers: buildHeaders(undefined, false)
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      clearAuthToken();
      clearAuthUser();
      notifyAuthExpired();
    }

    const text = await response.text();
    throw new Error(text || "Không thể xuất file trò chuyện.");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileNameFromDisposition(
    response.headers.get("content-disposition"),
    `cuoc-tro-chuyen.${format === "markdown" ? "md" : "pdf"}`
  );
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};
