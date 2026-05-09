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

export function sanitizeProviderMedia(primary: unknown, fallback?: unknown) {
  const fallbackUrl = buildLegacyAssetUrl(normalizeRawMediaPath(fallback));
  const primaryRaw = normalizeRawMediaPath(primary);

  if (!primaryRaw) {
    return fallbackUrl || null;
  }

  if (isBlockedProviderMedia(primaryRaw)) {
    return fallbackUrl || null;
  }

  return buildLegacyAssetUrl(primaryRaw) || fallbackUrl || null;
}
