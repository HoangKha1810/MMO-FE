import { buildLegacyAssetUrl } from '@/lib/legacy-settings';

const blockedProviderMediaPattern = /(random\s*1k(?:\.(?:com|net|vn))?|shopreg61(?:\.com)?|randomm1k\.vn)/i;

function normalizeRawMediaPath(value: unknown) {
  return String(value || '').trim();
}

export function isBlockedProviderMedia(value: unknown) {
  const raw = normalizeRawMediaPath(value);
  if (!raw) return false;
  return blockedProviderMediaPattern.test(raw);
}

export function buildProviderMediaProxyUrl(value: unknown) {
  const raw = normalizeRawMediaPath(value);
  if (!raw || !isBlockedProviderMedia(raw)) return null;

  try {
    const url = new URL(raw);
    if (!/^https?:$/i.test(url.protocol)) return null;
    return `/api/provider-media?url=${encodeURIComponent(url.toString())}`;
  } catch {
    return null;
  }
}

export function resolveProviderMediaUrl(primary: unknown, fallback?: unknown) {
  const primaryRaw = normalizeRawMediaPath(primary);
  const fallbackRaw = normalizeRawMediaPath(fallback);
  const primaryDirect = isBlockedProviderMedia(primaryRaw) ? null : buildLegacyAssetUrl(primaryRaw);
  const fallbackDirect = isBlockedProviderMedia(fallbackRaw) ? null : buildLegacyAssetUrl(fallbackRaw);

  return (
    primaryDirect ||
    fallbackDirect ||
    buildProviderMediaProxyUrl(primaryRaw) ||
    buildProviderMediaProxyUrl(fallbackRaw) ||
    null
  );
}

export function sanitizeProviderMedia(primary: unknown, fallback?: unknown) {
  return resolveProviderMediaUrl(primary, fallback);
}
