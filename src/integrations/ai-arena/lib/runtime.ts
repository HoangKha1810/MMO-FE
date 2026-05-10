export const AI_ROUTE_BASE = "/ai";
export const AI_SHARED_BASE = `${AI_ROUTE_BASE}/shared`;
export const AI_ADMIN_BASE = `${AI_ROUTE_BASE}/admin`;
export const AI_UPGRADE_BASE = `${AI_ROUTE_BASE}/upgrade`;
export const AI_ASSET_BASE = "/ai-assets";

export function normalizeAiPath(value: string) {
  const normalized = (value || "/").replace(/\/+$/, "") || "/";
  if (normalized === AI_ROUTE_BASE || normalized.startsWith(`${AI_ROUTE_BASE}/`)) {
    return normalized;
  }
  return normalized === "/" ? AI_ROUTE_BASE : `${AI_ROUTE_BASE}${normalized}`;
}

export function toAiAssetUrl(path: string) {
  const normalized = String(path || "").replace(/^\/+/, "");
  return `${AI_ASSET_BASE}/${normalized}`;
}

export function shouldReduceAiMotion() {
  if (typeof window === "undefined") {
    return false;
  }

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return true;
  }

  if (
    window.matchMedia("(max-width: 960px)").matches ||
    window.matchMedia("(pointer: coarse)").matches
  ) {
    return true;
  }

  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (typeof memory === "number" && Number.isFinite(memory) && memory <= 4) {
    return true;
  }

  if (
    typeof navigator.hardwareConcurrency === "number" &&
    navigator.hardwareConcurrency <= 4
  ) {
    return true;
  }

  return false;
}
