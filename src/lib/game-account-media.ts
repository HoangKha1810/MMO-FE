import { sanitizeProviderMedia } from '@/lib/provider-media';

type GameKey = 'lien-quan-mobile' | 'free-fire' | 'pubg-mobile' | 'fc-mobile' | 'tft';

const gameThumbnailMap: Record<GameKey, string> = {
  'lien-quan-mobile': '/assets/game-thumbnails/lien-quan-mobile.png',
  'free-fire': '/assets/game-thumbnails/free-fire.png',
  'pubg-mobile': '/assets/game-thumbnails/pubg-mobile.png',
  'fc-mobile': '/assets/game-thumbnails/fc-mobile.png',
  'tft': '/assets/game-thumbnails/tft.png',
};

const gameKeywordGroups: Array<{ key: GameKey; keywords: string[] }> = [
  {
    key: 'lien-quan-mobile',
    keywords: [
      'lq',
      'lqm',
      'lien quan',
      'lien quan mobile',
      'arena of valor',
      'aov',
    ],
  },
  {
    key: 'free-fire',
    keywords: [
      'ff',
      'free fire',
      'freefire',
    ],
  },
  {
    key: 'pubg-mobile',
    keywords: [
      'pubg',
      'pubg mobile',
      'pubgm',
      'battlegrounds mobile',
    ],
  },
  {
    key: 'fc-mobile',
    keywords: [
      'fc mobile',
      'fcm',
      'fc online',
      'fconline',
      'fo4',
      'fifa mobile',
      'fifa online',
      'fifa',
      'tk fc online',
    ],
  },
  {
    key: 'tft',
    keywords: [
      'tft',
      'dtcl',
      'teamfight tactics',
      'dau truong chan ly',
    ],
  },
];

function normalizeVietnamese(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase();
}

function normalizeSearchText(value: unknown) {
  return normalizeVietnamese(value)
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function collapseSearchText(value: unknown) {
  return normalizeSearchText(value).replace(/\s+/g, '');
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeText(parts: unknown[]) {
  return parts
    .map((part) => normalizeSearchText(part))
    .filter(Boolean)
    .join(' ');
}

function matchesKeyword(text: string, collapsedText: string, keyword: string) {
  const normalizedKeyword = normalizeSearchText(keyword);
  if (!normalizedKeyword) return false;

  const collapsedKeyword = collapseSearchText(keyword);
  if (normalizedKeyword.includes(' ')) {
    return text.includes(normalizedKeyword) || collapsedText.includes(collapsedKeyword);
  }

  return new RegExp(`(^|\\s)${escapeRegExp(normalizedKeyword)}(?=\\s|$)`).test(text);
}

function detectGameAccountThumbnailKeyFromText(value: unknown): GameKey | null {
  const haystack = normalizeSearchText(value);
  if (!haystack) return null;

  const collapsedHaystack = collapseSearchText(value);

  for (const matcher of gameKeywordGroups) {
    if (matcher.keywords.some((keyword) => matchesKeyword(haystack, collapsedHaystack, keyword))) {
      return matcher.key;
    }
  }

  return null;
}

export function detectGameAccountThumbnailKey(...parts: unknown[]): GameKey | null {
  for (const part of parts) {
    const result = detectGameAccountThumbnailKeyFromText(part);
    if (result) return result;
  }

  const haystack = normalizeText(parts);
  return detectGameAccountThumbnailKeyFromText(haystack);
}

export function getGameAccountThumbnailUrl(input: {
  title?: unknown;
  category?: unknown;
  categoryName?: unknown;
  tags?: unknown;
  description?: unknown;
  customBadge?: unknown;
  primary?: unknown;
  fallback?: unknown;
}) {
  const gameKey = detectGameAccountThumbnailKey(
    input.title,
    input.categoryName,
    input.category,
    input.customBadge,
    input.description,
    input.tags
  );

  if (gameKey) {
    return gameThumbnailMap[gameKey];
  }

  return sanitizeProviderMedia(input.primary, input.fallback);
}
