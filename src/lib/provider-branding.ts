const hiddenProviderPattern = /\b(?:random\s*1k(?:\.(?:com|net|vn))?|shopreg61(?:\.com)?)\b/gi;

export function hideProviderBranding(value: unknown, fallback = '') {
  const text = String(value || '').trim();
  if (!text) return fallback;

  return text
    .replace(hiddenProviderPattern, 'API')
    .replace(/\s+/g, ' ')
    .trim();
}
