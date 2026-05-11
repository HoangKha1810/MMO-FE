import {
  AdminCatalogResources,
  AdminDashboard,
  AdminInstance,
  AdminOrder,
  AuthResponse,
  CatalogItem,
  MyInstance,
  MyOrder,
  OrdersResponse,
  RemoteOs,
  Session,
  StoreSettings,
  StorefrontData,
  User,
} from "./types";
import { storefrontFallback } from "./sample-data";
import { siteConfig } from "./site";

function normalizeApiBaseUrl(rawValue: string | undefined) {
  const trimmed = String(rawValue || "").trim();
  if (!trimmed) {
    return "/api/vps-proxy";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/+$/, "").replace(/\/api$/i, "") + "/api";
  }

  return trimmed.replace(/\/+$/, "");
}

const API_BASE_URL = normalizeApiBaseUrl(
  process.env.NEXT_PUBLIC_VPS_PORTAL_API_BASE_URL
);
const SESSION_KEY = "vncloud-vps-session";
export const DEPOSIT_URL = "https://trungtammmo.vn/deposit";
export const API_ACTIVITY_EVENT = "vncloud-vps-api-activity";
export const PURCHASE_MAINTENANCE_MESSAGE =
  "Hệ thống bảo trì vui lòng liên hệ admin để có thể mua hàng.";
let cachedSessionRaw: string | null | undefined;
let cachedSessionValue: Session | null = null;
let pendingApiRequestCount = 0;

type RequestOptions = {
  method?: "GET" | "POST" | "PUT";
  token?: string;
  body?: unknown;
};

function emitApiActivity() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(API_ACTIVITY_EVENT, {
      detail: {
        pending: pendingApiRequestCount,
      },
    }),
  );
}

export function getPendingApiRequestCount() {
  return pendingApiRequestCount;
}

function normalizeSupportLink(value: unknown) {
  if (
    typeof value === "string" &&
    value.trim() &&
    !/t\.me\/your_support|telegram/i.test(value.trim())
  ) {
    return value.trim();
  }

  return siteConfig.supportUrl;
}

function normalizePositiveIntegerSetting(value: unknown, fallback: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.round(parsed);
}

function normalizeOperatingSystemName(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .replace(/^Linux\s+/i, "")
    .replace(/Ubuntu-?(\d{2}\.\d{2})/i, "Ubuntu $1")
    .replace(/Ubuntu(\d{2}\.\d{2})/i, "Ubuntu $1")
    .replace(/Almalinux/gi, "AlmaLinux")
    .replace(/-AAPanel-Nginx/gi, " · aaPanel Nginx")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized || /^OS\s*\d+$/i.test(normalized)) {
    return null;
  }

  return normalized;
}

function normalizeCatalogTitle(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return value;
  }

  return normalized
    .replace(/^CS(?=[\d-])/i, "VPS ")
    .replace(/^CS\s+/i, "VPS ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeCatalogItem(item: CatalogItem): CatalogItem {
  return {
    ...item,
    title: normalizeCatalogTitle(item.title),
    operating_system_name: normalizeOperatingSystemName(item.operating_system_name),
  };
}

function normalizeInstance(instance: MyInstance): MyInstance {
  return {
    ...instance,
    operating_system_name: normalizeOperatingSystemName(instance.operating_system_name),
  };
}

function normalizeOrder(order: MyOrder): MyOrder {
  return {
    ...order,
    instances: Array.isArray(order.instances)
      ? order.instances.map((instance) => normalizeInstance(instance))
      : [],
  };
}

function normalizeOrdersResponse(data: OrdersResponse): OrdersResponse {
  return {
    ...data,
    instances: Array.isArray(data.instances)
      ? data.instances.map((instance) => normalizeInstance(instance))
      : [],
    orders: Array.isArray(data.orders)
      ? data.orders.map((order) => normalizeOrder(order))
      : [],
  };
}

function extractApiMessage(payload: unknown) {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }

  return null;
}

function looksLikeHtmlDocument(value: string) {
  return /^\s*</.test(value);
}

function normalizeStorefrontData(
  data: Partial<StorefrontData> | null | undefined,
): StorefrontData {
  const fallback = storefrontFallback;
  const mergedSettings = {
    ...fallback.settings,
    ...(data?.settings ?? {}),
  };
  const normalizedItems = Array.isArray(data?.items)
    ? data.items.map((item) => normalizeCatalogItem(item))
    : fallback.items.map((item) => normalizeCatalogItem(item));
  const normalizedOperatingSystems = Array.from(
    new Set(
      [
        ...(Array.isArray(data?.operatingSystems) ? data.operatingSystems : []),
        ...normalizedItems.map((item) => item.operating_system_name),
      ]
        .map((item) => normalizeOperatingSystemName(item))
        .filter((item): item is string => Boolean(item)),
    ),
  );

  return {
    settings: {
      ...mergedSettings,
      support_link: normalizeSupportLink(mergedSettings.support_link),
      intro_customer_count:
        typeof mergedSettings.intro_customer_count === "string" &&
        mergedSettings.intro_customer_count.trim()
          ? mergedSettings.intro_customer_count.trim()
          : fallback.settings.intro_customer_count,
      addon_cpu_price: normalizePositiveIntegerSetting(
        mergedSettings.addon_cpu_price,
        fallback.settings.addon_cpu_price,
      ),
      addon_ram_price: normalizePositiveIntegerSetting(
        mergedSettings.addon_ram_price,
        fallback.settings.addon_ram_price,
      ),
      addon_disk_price: normalizePositiveIntegerSetting(
        mergedSettings.addon_disk_price,
        fallback.settings.addon_disk_price,
      ),
      addon_disk_step: normalizePositiveIntegerSetting(
        mergedSettings.addon_disk_step,
        fallback.settings.addon_disk_step,
      ),
    },
    stats: {
      ...fallback.stats,
      ...(data?.stats ?? {}),
    },
    operatingSystems:
      normalizedOperatingSystems.length > 0
        ? normalizedOperatingSystems
        : fallback.operatingSystems,
    items: normalizedItems,
  };
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

export function shouldRedirectToDeposit(message: string) {
  return /so du khong du|số dư không đủ/i.test(message);
}

export function shouldShowMaintenanceNotice(message: string) {
  return /hệ thống bảo trì|liên hệ admin để có thể mua hàng/i.test(message);
}

export function redirectToDeposit() {
  if (typeof window === "undefined") {
    return;
  }

  window.location.assign(DEPOSIT_URL);
}

async function apiRequest<T>(path: string, options: RequestOptions = {}) {
  pendingApiRequestCount += 1;
  emitApiActivity();

  try {
    const headers: Record<string, string> = {
      ...(options.token
        ? {
            Authorization: `Bearer ${options.token}`,
          }
        : {}),
    };

    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    });

    const rawText = await response.text();
    let data: Record<string, unknown> | null = null;

    if (rawText.trim()) {
      try {
        data = JSON.parse(rawText) as Record<string, unknown>;
      } catch {
        if (!response.ok) {
          throw new Error("Không thể kết nối tới hệ thống. Vui lòng thử lại sau.");
        }

        if (looksLikeHtmlDocument(rawText)) {
          throw new Error("Hệ thống đang trả về dữ liệu không hợp lệ. Vui lòng thử lại sau.");
        }

        throw new Error("Phản hồi từ hệ thống không hợp lệ. Vui lòng thử lại sau.");
      }
    }

    if (!response.ok) {
      throw new Error(
        extractApiMessage(data) ?? "Không thể kết nối tới hệ thống. Vui lòng thử lại sau.",
      );
    }

    if (!data) {
      throw new Error("Phản hồi từ hệ thống không hợp lệ. Vui lòng thử lại sau.");
    }

    return data as T;
  } finally {
    pendingApiRequestCount = Math.max(0, pendingApiRequestCount - 1);
    emitApiActivity();
  }
}

export function getStoredSession() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(SESSION_KEY);

  if (raw === cachedSessionRaw) {
    return cachedSessionValue;
  }

  cachedSessionRaw = raw;

  if (!raw) {
    cachedSessionValue = null;
    return null;
  }

  try {
    cachedSessionValue = JSON.parse(raw) as Session;
    return cachedSessionValue;
  } catch {
    cachedSessionValue = null;
    return null;
  }
}

export function saveSession(session: Session) {
  if (typeof window === "undefined") {
    return;
  }

  const raw = JSON.stringify(session);

  if (raw === cachedSessionRaw) {
    return;
  }

  cachedSessionRaw = raw;
  cachedSessionValue = session;
  window.localStorage.setItem(SESSION_KEY, raw);
  window.dispatchEvent(new Event("vncloud-session-change"));
}

export function clearSession() {
  if (typeof window === "undefined") {
    return;
  }

  cachedSessionRaw = null;
  cachedSessionValue = null;
  window.localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event("vncloud-session-change"));
}

export function subscribeSession(callback: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handler = () => callback();
  window.addEventListener("storage", handler);
  window.addEventListener("vncloud-session-change", handler);

  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener("vncloud-session-change", handler);
  };
}

export async function getStorefrontData() {
  try {
    const data = await apiRequest<StorefrontData>("/catalog");
    return normalizeStorefrontData(data);
  } catch {
    return storefrontFallback;
  }
}

export async function login(identifier: string, password: string) {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: { identifier, password },
  });
}

export async function register(body: {
  username: string;
  email: string;
  fullname: string;
  password: string;
  confirmPassword: string;
}) {
  return apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body,
  });
}

export async function getMe(token: string) {
  return apiRequest<{ user: User }>("/auth/me", {
    token,
  });
}

export async function createOrder(
  token: string,
  payload: {
    catalogItemId: number;
    quantity: number;
    acceptedPolicy: boolean;
    note?: string;
    customAddonCpu?: number;
    customAddonRam?: number;
    customAddonDisk?: number;
  },
) {
  return apiRequest<{ message: string; orderId: number }>("/orders", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function getMyOrders(token: string) {
  const data = await apiRequest<OrdersResponse>("/orders/my", {
    token,
  });

  return normalizeOrdersResponse(data);
}

export async function getPortalSnapshot(token: string) {
  const [meResponse, ordersResponse] = await Promise.all([
    getMe(token),
    getMyOrders(token),
  ]);

  return {
    user: meResponse.user,
    orders: ordersResponse,
  };
}

export async function runInstanceAction(
  token: string,
  instanceId: number,
  action: string,
  options: {
    osId?: number;
  } = {},
) {
  return apiRequest<{ message: string }>(
    `/orders/instances/${instanceId}/action`,
    {
      method: "POST",
      token,
      body: {
        action,
        ...(typeof options.osId === "number" ? { osId: options.osId } : {}),
      },
    },
  );
}

export async function getUserOperatingSystems(token: string) {
  return apiRequest<{ operatingSystems: RemoteOs[] }>("/orders/resources", {
    token,
  });
}

export async function getAdminDashboard(token: string) {
  return apiRequest<AdminDashboard>("/admin/dashboard", {
    token,
  });
}

export async function getAdminCatalogItems(token: string) {
  return apiRequest<{ items: CatalogItem[] }>("/admin/catalog/items", {
    token,
  });
}

export async function getAdminResources(token: string) {
  return apiRequest<AdminCatalogResources>("/admin/catalog/resources", {
    token,
  });
}

export async function syncAdminCatalog(token: string) {
  return apiRequest<{ message: string; synced: Record<string, number> }>(
    "/admin/catalog/sync",
    {
      method: "POST",
      token,
    },
  );
}

export async function saveAdminSettings(token: string, settings: StoreSettings) {
  return apiRequest<{ message: string }>("/admin/settings", {
    method: "PUT",
    token,
    body: settings,
  });
}

export async function getAdminOrders(token: string) {
  return apiRequest<{ orders: AdminOrder[] }>("/admin/orders", {
    token,
  });
}

export async function getAdminInstances(token: string) {
  return apiRequest<{ instances: AdminInstance[] }>("/admin/instances", {
    token,
  });
}

export async function createAdminCatalogItem(
  token: string,
  body: Record<string, unknown>,
) {
  return apiRequest<{ message: string }>("/admin/catalog/items", {
    method: "POST",
    token,
    body,
  });
}

export async function updateAdminCatalogItem(
  token: string,
  itemId: number,
  body: Record<string, unknown>,
) {
  return apiRequest<{ message: string }>(`/admin/catalog/items/${itemId}`, {
    method: "PUT",
    token,
    body,
  });
}

export async function runAdminInstanceAction(
  token: string,
  instanceId: number,
  action: string,
  options: {
    osId?: number;
  } = {},
) {
  return apiRequest<{ message: string }>(`/admin/instances/${instanceId}/action`, {
    method: "POST",
    token,
    body: {
      action,
      ...(typeof options.osId === "number" ? { osId: options.osId } : {}),
    },
  });
}

export async function requestRefund(token: string, orderId: number) {
  return apiRequest<{ message: string; refundAmount: number }>(
    `/orders/${orderId}/request-refund`,
    {
      method: "POST",
      token,
    },
  );
}

export async function adminRefundOrder(token: string, orderId: number) {
  return apiRequest<{ message: string; refundAmount: number }>(
    `/admin/orders/${orderId}/refund`,
    {
      method: "POST",
      token,
    },
  );
}
