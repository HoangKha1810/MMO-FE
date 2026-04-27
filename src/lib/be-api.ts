function trimTrailingSlash(value: string | undefined | null) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function trimLeadingSlash(value: string) {
  return value.replace(/^\/+/, '');
}

export function getBeApiBaseUrl() {
  if (typeof window === 'undefined') {
    return trimTrailingSlash(process.env.BE_API_URL || process.env.NEXT_PUBLIC_BE_API_URL);
  }

  return trimTrailingSlash(process.env.NEXT_PUBLIC_BE_API_URL || process.env.BE_API_URL);
}

export function isNgrokBeUrl(value?: string | null) {
  return /(^https?:\/\/)?([a-z0-9-]+\.)*ngrok[-a-z0-9]*\./i.test(String(value || '').trim());
}

export function buildBeProxyPath(input: string) {
  const pathname = input.startsWith('/') ? input : `/${input}`;
  return `/api/be${pathname}`;
}

export function buildBeApiUrl(input: string) {
  const baseUrl = getBeApiBaseUrl();
  const pathname = input.startsWith('/') ? input : `/${input}`;

  if (!baseUrl) {
    return pathname;
  }

  if (typeof window !== 'undefined') {
    return buildBeProxyPath(pathname);
  }

  return `${baseUrl}${pathname}`;
}

export function withNgrokHeaders(headers?: HeadersInit, baseUrl?: string | null) {
  const merged = new Headers(headers || {});
  const target = String(baseUrl || getBeApiBaseUrl() || '').trim();

  if (isNgrokBeUrl(target) && !merged.has('ngrok-skip-browser-warning')) {
    merged.set('ngrok-skip-browser-warning', '1');
  }

  if (!merged.has('accept')) {
    merged.set('accept', 'application/json, text/plain, */*');
  }

  return merged;
}

export function buildDirectBeApiUrl(input: string) {
  const baseUrl = getBeApiBaseUrl();
  const pathname = input.startsWith('/') ? input : `/${input}`;

  if (!baseUrl) {
    return pathname;
  }

  return `${baseUrl}/${trimLeadingSlash(pathname)}`.replace(/([^:]\/)\/+/g, '$1');
}
