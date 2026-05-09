import 'server-only';
import { hideProviderBranding } from '@/lib/provider-branding';

type ProviderLike = {
  id?: unknown;
  name?: unknown;
  type?: unknown;
  api_url?: unknown;
  apiUrl?: unknown;
};

export type GameAccountProviderKind = 'random1k' | 'shopreg61' | null;

const randomKeywords = [
  'random',
  'randome',
  'ngau nhien',
  'ngẫu nhiên',
  'tui mu',
  'túi mù',
  'tui mù',
  'túi mu',
  'quay',
  'vong quay',
  'vòng quay',
  'gacha',
  'spin',
  'lucky',
  'mystery',
  'mystery box',
  'hop bi an',
  'hộp bí ẩn',
  'rut acc',
  'rút acc',
  'rut nick',
  'rút nick',
  'mo hop',
  'mở hộp',
];

const gameAccountKeywords = [
  'ban tai khoan',
  'bán tài khoản',
  'acc',
  'account',
  'nick',
  'file acc',
  'giao mail',
  'authen',
  'login',
  'log google',
  'log gg',
  'log fb',
  'checkpoint',
  'skin',
  'rank',
  'level',
  '2fa',
  'cp mail',
  'hotmail',
  'gmail',
  'facebook',
  'fb',
  'game',
  'roblox',
  'free fire',
  'pubg',
  'lien quan',
  'lol',
  'lien minh',
  'valorant',
  'genshin',
  'garena',
  'steam',
  'riot',
  'moonton',
  'minecraft',
  'fifa',
  'fo4',
];

function lowerText(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function normalizeVietnamese(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase();
}

function sqlColumn(alias: string | null | undefined, column: string) {
  return alias ? `${alias}.\`${column}\`` : `\`${column}\``;
}

function sqlLikeAny(expression: string, keywords: string[]) {
  const uniqueKeywords = Array.from(new Set(keywords.flatMap((keyword) => {
    const raw = lowerText(keyword);
    const normalized = normalizeVietnamese(raw);
    return [raw, normalized].filter(Boolean);
  })));

  return uniqueKeywords.map((keyword) => `${expression} LIKE '%${keyword.replace(/'/g, "''")}%'`).join(' OR ');
}

function hideProviderBrandingSql(expression: string) {
  return [
    'random1k.net',
    'random1k.com',
    'random1k.vn',
    'random1k',
    'random 1k.net',
    'random 1k.com',
    'random 1k.vn',
    'random 1k',
    'shopreg61.com',
    'shopreg61',
  ].reduce(
    (current, keyword) => `REPLACE(${current}, '${keyword}', 'api')`,
    expression
  );
}

export function isRandom1kProviderLike(provider: ProviderLike) {
  const name = lowerText(provider.name);
  const type = lowerText(provider.type);
  const apiUrl = lowerText(provider.api_url || provider.apiUrl);

  return (
    name.includes('random1k') ||
    name.includes('random 1k') ||
    name.includes('shopreg61') ||
    type.includes('gameaccount') ||
    type.includes('random1k') ||
    apiUrl.includes('random1k.com') ||
    apiUrl.includes('shopreg61.com')
  );
}

export function getGameAccountProviderKind(provider: ProviderLike): GameAccountProviderKind {
  const name = lowerText(provider.name);
  const type = lowerText(provider.type);
  const apiUrl = lowerText(provider.api_url || provider.apiUrl);

  if (name.includes('shopreg61') || apiUrl.includes('shopreg61.com')) {
    return 'shopreg61';
  }

  if (
    name.includes('random1k') ||
    name.includes('random 1k') ||
    type.includes('random1k') ||
    apiUrl.includes('random1k.com')
  ) {
    return 'random1k';
  }

  return null;
}

export function getProviderOrigin(provider: ProviderLike) {
  const rawUrl = String(provider.api_url || provider.apiUrl || '').trim();
  if (!rawUrl) return '';

  try {
    return new URL(rawUrl).origin;
  } catch {
    return '';
  }
}

export function normalizeProviderAssetUrl(provider: ProviderLike, value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const origin = getProviderOrigin(provider);
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      if (origin && ['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname)) {
        return `${origin}${url.pathname}${url.search}`;
      }
    } catch {
      return raw;
    }
    return raw;
  }

  if (origin && raw.startsWith('/')) {
    return `${origin}${raw}`;
  }

  return raw;
}

export function isRandomGameAccountName(...parts: unknown[]) {
  const haystack = normalizeVietnamese(hideProviderBranding(parts.map((part) => String(part || '')).join(' ')));
  return randomKeywords.some((keyword) => haystack.includes(normalizeVietnamese(keyword)));
}

export function isGameAccountName(...parts: unknown[]) {
  const haystack = normalizeVietnamese(hideProviderBranding(parts.map((part) => String(part || '')).join(' ')));
  return gameAccountKeywords.some((keyword) => haystack.includes(normalizeVietnamese(keyword)));
}

export function getRandom1kResourceType(categoryName: string, productName: string) {
  if (isRandomGameAccountName(categoryName, productName) || isGameAccountName(categoryName, productName)) {
    return 'account';
  }

  return 'other';
}

export function buildRandom1kTags(input: {
  providerName: string;
  categoryName: string;
  productName: string;
  resourceType: string;
}) {
  const isRandomAccount = isRandomGameAccountName(input.categoryName, input.productName);
  const tags = [
    input.categoryName,
    'api-account',
    input.resourceType,
  ];

  if (isRandomAccount) {
    tags.push('random-account');
  }

  if (!isRandomAccount && isGameAccountName(input.categoryName, input.productName)) {
    tags.push('game-account');
  }

  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean))).join(', ');
}

export function buildRandom1kResourceWhereSql(resourceAlias: string | null = 'r', providerAlias: string | null = 'ap') {
  const apiProviderId = sqlColumn(resourceAlias, 'api_provider_id');
  const tags = sqlColumn(resourceAlias, 'tags');
  const customBadge = sqlColumn(resourceAlias, 'custom_badge');
  const directProviderSql = [
    `LOWER(COALESCE(CAST(${apiProviderId} AS CHAR), '')) LIKE '%random1k%'`,
    `LOWER(COALESCE(${tags}, '')) LIKE '%random1k%'`,
    `LOWER(COALESCE(${customBadge}, '')) LIKE '%random1k%'`,
  ];

  if (providerAlias) {
    directProviderSql.push(
      `LOWER(COALESCE(${providerAlias}.\`name\`, '')) LIKE '%random1k%'`,
      `LOWER(COALESCE(${providerAlias}.\`name\`, '')) LIKE '%random 1k%'`,
      `LOWER(COALESCE(${providerAlias}.\`type\`, '')) LIKE '%random1k%'`,
      `LOWER(COALESCE(${providerAlias}.\`api_url\`, '')) LIKE '%random1k.com%'`
    );
  } else {
    directProviderSql.push(`
      EXISTS (
        SELECT 1
        FROM api_providers random1k_provider
        WHERE random1k_provider.id = CAST(COALESCE(${apiProviderId}, 0) AS UNSIGNED)
          AND (
            LOWER(COALESCE(random1k_provider.name, '')) LIKE '%random1k%'
            OR LOWER(COALESCE(random1k_provider.name, '')) LIKE '%random 1k%'
            OR LOWER(COALESCE(random1k_provider.type, '')) LIKE '%random1k%'
            OR LOWER(COALESCE(random1k_provider.api_url, '')) LIKE '%random1k.com%'
          )
      )
    `);
  }

  return `(${directProviderSql.join(' OR ')})`;
}

function buildProviderSourceWhereSql(
  providerKind: Exclude<GameAccountProviderKind, null>,
  resourceAlias: string | null = 'r',
  providerAlias: string | null = 'ap'
) {
  const apiProviderId = sqlColumn(resourceAlias, 'api_provider_id');
  const providerNameLikes = providerKind === 'shopreg61'
    ? [`%shopreg61%`, `%shopreg61.com%`]
    : [`%random1k%`, `%random 1k%`, `%random1k.com%`];
  const providerTypeLikes = providerKind === 'shopreg61'
    ? [`%gameaccount%`]
    : [`%random1k%`, `%gameaccount%`];
  const providerUrlLikes = providerKind === 'shopreg61'
    ? [`%shopreg61.com%`]
    : [`%random1k.com%`];

  const directProviderSql: string[] = [];
  if (providerAlias) {
    directProviderSql.push(
      ...providerNameLikes.map((pattern) => `LOWER(COALESCE(${providerAlias}.\`name\`, '')) LIKE '${pattern}'`),
      ...providerTypeLikes.map((pattern) => `LOWER(COALESCE(${providerAlias}.\`type\`, '')) LIKE '${pattern}'`),
      ...providerUrlLikes.map((pattern) => `LOWER(COALESCE(${providerAlias}.\`api_url\`, '')) LIKE '${pattern}'`)
    );
  } else {
    const checks = [
      ...providerNameLikes.map((pattern) => `LOWER(COALESCE(game_provider.name, '')) LIKE '${pattern}'`),
      ...providerTypeLikes.map((pattern) => `LOWER(COALESCE(game_provider.type, '')) LIKE '${pattern}'`),
      ...providerUrlLikes.map((pattern) => `LOWER(COALESCE(game_provider.api_url, '')) LIKE '${pattern}'`),
    ].join(' OR ');

    directProviderSql.push(`
      EXISTS (
        SELECT 1
        FROM api_providers game_provider
        WHERE game_provider.id = CAST(COALESCE(${apiProviderId}, 0) AS UNSIGNED)
          AND (${checks})
      )
    `);
  }

  return `(${directProviderSql.join(' OR ')})`;
}

export function buildGameAccountProviderSourceWhereSql(
  providerKind: Exclude<GameAccountProviderKind, null> | 'all' = 'all',
  resourceAlias: string | null = 'r',
  providerAlias: string | null = 'ap'
) {
  if (providerKind === 'all') {
    return `(${buildProviderSourceWhereSql('random1k', resourceAlias, providerAlias)} OR ${buildProviderSourceWhereSql('shopreg61', resourceAlias, providerAlias)})`;
  }

  return buildProviderSourceWhereSql(providerKind, resourceAlias, providerAlias);
}

export function buildRandomGameAccountWhereSql(resourceAlias: string | null = 'r', categoryAlias: string | null = 'rc') {
  const parts = [
    sqlColumn(resourceAlias, 'title'),
    sqlColumn(resourceAlias, 'category'),
    sqlColumn(resourceAlias, 'description'),
  ];

  if (categoryAlias) {
    parts.push(`${categoryAlias}.\`name\``, `${categoryAlias}.\`slug\``);
  }

  const haystack = hideProviderBrandingSql(`LOWER(CONCAT_WS(' ', ${parts.map((part) => `COALESCE(${part}, '')`).join(', ')}))`);
  return `(${sqlLikeAny(haystack, randomKeywords)})`;
}

export function buildGameAccountWhereSql(resourceAlias: string | null = 'r', categoryAlias: string | null = 'rc') {
  const parts = [
    sqlColumn(resourceAlias, 'title'),
    sqlColumn(resourceAlias, 'category'),
    sqlColumn(resourceAlias, 'description'),
  ];

  if (categoryAlias) {
    parts.push(`${categoryAlias}.\`name\``, `${categoryAlias}.\`slug\``);
  }

  const haystack = hideProviderBrandingSql(`LOWER(CONCAT_WS(' ', ${parts.map((part) => `COALESCE(${part}, '')`).join(', ')}))`);
  return `(${sqlLikeAny(haystack, gameAccountKeywords)})`;
}

export function buildDirectGameAccountWhereSql(resourceAlias: string | null = 'r', categoryAlias: string | null = 'rc') {
  return `(NOT ${buildRandomGameAccountWhereSql(resourceAlias, categoryAlias)})`;
}
