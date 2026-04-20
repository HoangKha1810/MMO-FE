function trimTrailingSlash(value: string | undefined | null) {
  return String(value || '').trim().replace(/\/+$/, '');
}

export function getBeApiBaseUrl() {
  if (typeof window === 'undefined') {
    return trimTrailingSlash(process.env.BE_API_URL || process.env.NEXT_PUBLIC_BE_API_URL);
  }

  return trimTrailingSlash(process.env.NEXT_PUBLIC_BE_API_URL || process.env.BE_API_URL);
}

export function buildBeApiUrl(input: string) {
  const baseUrl = getBeApiBaseUrl();
  const pathname = input.startsWith('/') ? input : `/${input}`;

  if (!baseUrl) {
    return pathname;
  }

  return `${baseUrl}${pathname}`;
}
