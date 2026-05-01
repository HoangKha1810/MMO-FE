import { slugify } from '@/lib/utils';

export interface GameMarketCategoryDefinition {
  slug: string;
  label: string;
  description: string;
}

export const gameMarketCategories: GameMarketCategoryDefinition[] = [
  {
    slug: 'lien-quan-mobile',
    label: 'Liên Quân Mobile',
    description: 'Nick rank cao, skin hiếm, acc chiến và vật phẩm Liên Quân.',
  },
  {
    slug: 'pubg-mobile',
    label: 'PUBG Mobile',
    description: 'Account PUBG Mobile, UC, set đồ và tài khoản chiến đấu.',
  },
  {
    slug: 'valorant',
    label: 'Valorant',
    description: 'Tài khoản rank, skin bundle, acc smurf và account chính chủ.',
  },
  {
    slug: 'free-fire',
    label: 'Free Fire',
    description: 'Nick Free Fire, vật phẩm, skin súng và tài khoản rank.',
  },
  {
    slug: 'fc-online',
    label: 'FC Online',
    description: 'Acc FO4/FC Online, BP, team color và đội hình giá trị cao.',
  },
  {
    slug: 'league-of-legends',
    label: 'Liên Minh Huyền Thoại',
    description: 'Acc rank, nhiều tướng, nhiều skin và tài khoản server quốc tế.',
  },
  {
    slug: 'genshin-impact',
    label: 'Genshin Impact',
    description: 'Acc nhiều tướng 5 sao, roll đẹp và tài nguyên đã farm sẵn.',
  },
  {
    slug: 'roblox',
    label: 'Roblox',
    description: 'Acc Roblox, vật phẩm hiếm, Robux và account theo game mode.',
  },
  {
    slug: 'steam-khac',
    label: 'Steam / Game Khác',
    description: 'Các tài khoản game khác, launcher khác hoặc listing đa nền tảng.',
  },
];

const categoryMap = new Map<string, GameMarketCategoryDefinition>(
  gameMarketCategories.flatMap((item) => [
    [item.slug, item],
    [slugify(item.label), item],
    [item.label.toLowerCase(), item],
  ])
);

export function normalizeGameMarketCategory(value: string) {
  const raw = String(value || '').trim();
  if (!raw) {
    return gameMarketCategories[gameMarketCategories.length - 1].slug;
  }

  const normalized = slugify(raw);
  return categoryMap.get(raw.toLowerCase())?.slug || categoryMap.get(normalized)?.slug || normalized || gameMarketCategories[gameMarketCategories.length - 1].slug;
}

export function getGameMarketCategoryMeta(value: string) {
  const slug = normalizeGameMarketCategory(value);
  return categoryMap.get(slug) || gameMarketCategories.find((item) => item.slug === 'steam-khac')!;
}

export function getGameMarketCategoryOptions() {
  return gameMarketCategories.map((item) => ({
    label: item.label,
    value: item.slug,
  }));
}

export function getGameMarketCategoryLabel(value: string) {
  return getGameMarketCategoryMeta(value).label;
}
