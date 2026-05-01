import { buildPublicAssetUrl } from '@/lib/public-asset-url';

interface GameMarketImageSource {
  thumbnail?: unknown;
  images?: unknown;
}

function normalizeImageRef(value: unknown) {
  return String(value || '').trim();
}

export function parseGameMarketImageRefs(value: unknown) {
  if (!value) {
    return [];
  }

  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? (() => {
          const raw = value.trim();
          if (!raw) {
            return [];
          }

          if (raw.startsWith('[')) {
            try {
              const parsed = JSON.parse(raw);
              return Array.isArray(parsed) ? parsed : [raw];
            } catch {
              return raw.split('\n');
            }
          }

          return raw.split('\n');
        })()
      : [];

  return Array.from(new Set(values.map(normalizeImageRef).filter(Boolean)));
}

export function collectGameMarketImageRefs(source: GameMarketImageSource, limit = 3) {
  return Array.from(
    new Set([
      normalizeImageRef(source.thumbnail),
      ...parseGameMarketImageRefs(source.images),
    ].filter(Boolean))
  ).slice(0, limit);
}

export function getGameMarketGalleryUrls(source: GameMarketImageSource, limit = 3) {
  return collectGameMarketImageRefs(source, limit)
    .map((item) => buildPublicAssetUrl(item))
    .filter((item): item is string => Boolean(item));
}
