const DEFAULT_GAME_API_PUBLIC_URL = 'https://api.trungtammmo.vn';

function normalizeOrigin(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) {
    return DEFAULT_GAME_API_PUBLIC_URL;
  }

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/+$/, '');
}

export function getGameApiPublicBaseUrl() {
  return normalizeOrigin(
    process.env.GAME_API_PUBLIC_BASE_URL
    || process.env.NEXT_PUBLIC_GAME_API_PUBLIC_BASE_URL
    || DEFAULT_GAME_API_PUBLIC_URL
  );
}
