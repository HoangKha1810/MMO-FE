import { db } from '@/lib/db';
import { toNumber } from '@/lib/utils';

export interface LegacyServiceItem {
  key: string;
  title: string;
  desc: string;
  href: string;
  iconKey: string;
  color: string;
  textColor: string;
  maintenance: boolean;
  external: boolean;
}

interface ServiceDefinition {
  key: string;
  nameKey: string;
  descKey: string;
  statusKey: string;
  href: string;
  iconKey: string;
  color: string;
  textColor: string;
  defaultTitle: string;
  defaultDesc: string;
  external?: boolean;
}

const SETTINGS_CACHE_TTL_MS = 60 * 1000;
const LEGACY_SITE_ORIGIN =
  process.env.LEGACY_SITE_ORIGIN?.replace(/\/+$/, '') || 'https://trungtammmo.vn';

let settingsCache:
  | {
      expiresAt: number;
      data: Record<string, string>;
    }
  | null = null;

const homeServiceDefinitions: ServiceDefinition[] = [
  {
    key: '1',
    nameKey: 'service_1_name',
    descKey: 'service_1_desc',
    statusKey: 'service_1_status',
    href: '/user/smm',
    iconKey: 'thumbs-up',
    color: 'from-blue-600 to-indigo-600',
    textColor: 'text-blue-500',
    defaultTitle: 'Tăng Tương Tác',
    defaultDesc: 'Dịch vụ mạng xã hội chuyên nghiệp',
  },
  {
    key: '2',
    nameKey: 'service_2_name',
    descKey: 'service_2_desc',
    statusKey: 'service_2_status',
    href: '/user/automxh',
    iconKey: 'zap',
    color: 'from-orange-500 to-rose-600',
    textColor: 'text-orange-500',
    defaultTitle: 'Auto MXH',
    defaultDesc: 'Tự động hoá - Tối ưu thu nhập',
  },
  {
    key: '3',
    nameKey: 'service_3_name',
    descKey: 'service_3_desc',
    statusKey: 'service_3_status',
    href: '/user/resources',
    iconKey: 'package',
    color: 'from-purple-600 to-fuchsia-600',
    textColor: 'text-purple-500',
    defaultTitle: 'Tài Nguyên',
    defaultDesc: 'Nguồn tài nguyên MMO chất lượng',
  },
  {
    key: '10',
    nameKey: 'service_10_name',
    descKey: 'service_10_desc',
    statusKey: 'service_10_status',
    href: 'https://ai.trungtammmo.vn/',
    iconKey: 'bot',
    color: 'from-blue-500 to-cyan-500',
    textColor: 'text-blue-500',
    defaultTitle: 'AI Manager',
    defaultDesc: 'Quản lý AI - Tối ưu hiệu quả',
    external: true,
  },
  {
    key: '12',
    nameKey: 'service_12_name',
    descKey: 'service_12_desc',
    statusKey: 'service_12_status',
    href: 'https://vps.trungtammmo.vn/',
    iconKey: 'cloud',
    color: 'from-cyan-500 to-blue-600',
    textColor: 'text-cyan-500',
    defaultTitle: 'VPS',
    defaultDesc: 'Hosting & VPS tốc độ cao',
    external: true,
  },
  {
    key: 'chat_support_tiktok',
    nameKey: 'service_chat_support_tiktok_name',
    descKey: 'service_chat_support_tiktok_desc',
    statusKey: 'service_chat_support_tiktok_status',
    href: '/user/support-tiktok',
    iconKey: 'headset',
    color: 'from-pink-500 to-rose-600',
    textColor: 'text-pink-500',
    defaultTitle: 'Chat Support Tiktok',
    defaultDesc: 'Hỗ trợ chat TikTok chuyên nghiệp',
  },
  {
    key: '5',
    nameKey: 'service_5_name',
    descKey: 'service_5_desc',
    statusKey: 'service_5_status',
    href: '/user/forum',
    iconKey: 'message-square',
    color: 'from-indigo-600 to-blue-700',
    textColor: 'text-indigo-500',
    defaultTitle: 'Forum MMO',
    defaultDesc: 'Kết nối cộng đồng kiếm tiền',
  },
  {
    key: '9',
    nameKey: 'service_9_name',
    descKey: 'service_9_desc',
    statusKey: 'service_9_status',
    href: '/user/find-job',
    iconKey: 'briefcase',
    color: 'from-emerald-600 to-green-600',
    textColor: 'text-emerald-500',
    defaultTitle: 'Find Job MMO',
    defaultDesc: 'Kết nối việc làm MMO chất lượng',
  },
  {
    key: '8',
    nameKey: 'service_8_name',
    descKey: 'service_8_desc',
    statusKey: 'service_8_status',
    href: '/user/forum?search=chia-se',
    iconKey: 'book-open',
    color: 'from-amber-500 to-orange-600',
    textColor: 'text-amber-500',
    defaultTitle: 'Chia Sẻ',
    defaultDesc: 'Kiến thức MMO thực chiến',
  },
  {
    key: '6',
    nameKey: 'service_6_name',
    descKey: 'service_6_desc',
    statusKey: 'service_6_status',
    href: '/user/game-market',
    iconKey: 'gamepad-2',
    color: 'from-cyan-500 to-blue-500',
    textColor: 'text-cyan-500',
    defaultTitle: 'Mua Bán Game',
    defaultDesc: 'Giao dịch game uy tín',
  },
  {
    key: '7',
    nameKey: 'service_7_name',
    descKey: 'service_7_desc',
    statusKey: 'service_7_status',
    href: '/user/card',
    iconKey: 'credit-card',
    color: 'from-rose-500 to-red-600',
    textColor: 'text-rose-500',
    defaultTitle: 'Đổi Thẻ',
    defaultDesc: 'Thanh toán nhanh - Phí thấp',
  },
  {
    key: '4',
    nameKey: 'service_4_name',
    descKey: 'service_4_desc',
    statusKey: 'service_4_status',
    href: '/user/home',
    iconKey: 'shopping-cart',
    color: 'from-emerald-500 to-teal-600',
    textColor: 'text-emerald-500',
    defaultTitle: 'TRUNGTAMMMO',
    defaultDesc: 'Giao dịch nhanh - An toàn tuyệt đối',
  },
];

const sidebarServiceDefinitions: ServiceDefinition[] = [
  homeServiceDefinitions[0],
  homeServiceDefinitions[1],
  homeServiceDefinitions[2],
  homeServiceDefinitions[3],
  homeServiceDefinitions[5],
  homeServiceDefinitions[6],
  homeServiceDefinitions[7],
  homeServiceDefinitions[8],
  homeServiceDefinitions[9],
  homeServiceDefinitions[10],
  homeServiceDefinitions[11],
  {
    key: '11',
    nameKey: 'service_11_name',
    descKey: 'service_11_desc',
    statusKey: 'service_11_status',
    href: '/user/resources?search=cloud',
    iconKey: 'monitor',
    color: 'from-indigo-500 to-blue-500',
    textColor: 'text-indigo-500',
    defaultTitle: 'Cloud PC + Phone',
    defaultDesc: 'Thuê máy ảo chất lượng cao',
  },
  {
    key: '12',
    nameKey: 'service_12_name',
    descKey: 'service_12_desc',
    statusKey: 'service_12_status',
    href: 'https://vps.trungtammmo.vn/',
    iconKey: 'server',
    color: 'from-slate-500 to-slate-700',
    textColor: 'text-slate-500',
    defaultTitle: 'Hosting VPS',
    defaultDesc: 'Hosting & VPS tốc độ cao',
    external: true,
  },
  {
    key: '13',
    nameKey: 'service_13_name',
    descKey: 'service_13_desc',
    statusKey: 'service_13_status',
    href: '/user/resources?search=security',
    iconKey: 'shield-check',
    color: 'from-red-600 to-rose-700',
    textColor: 'text-rose-500',
    defaultTitle: 'SecureScan',
    defaultDesc: 'Bảo mật & Quét mã độc chuyên sâu',
  },
  {
    key: '14',
    nameKey: 'service_14_name',
    descKey: 'service_14_desc',
    statusKey: 'service_14_status',
    href: '/user/resources?search=toolkit',
    iconKey: 'wrench',
    color: 'from-gray-500 to-gray-700',
    textColor: 'text-gray-500',
    defaultTitle: 'MMO Toolkit',
    defaultDesc: 'Công cụ hỗ trợ MMO đa năng',
  },
  {
    key: '15',
    nameKey: 'service_15_name',
    descKey: 'service_15_desc',
    statusKey: 'service_15_status',
    href: '/user/forum?search=khoa-hoc',
    iconKey: 'graduation-cap',
    color: 'from-amber-600 to-yellow-700',
    textColor: 'text-amber-600',
    defaultTitle: 'Khoá Học MMO',
    defaultDesc: 'Đào tạo MMO từ cơ bản đến nâng cao',
  },
  {
    key: '16',
    nameKey: 'service_16_name',
    descKey: 'service_16_desc',
    statusKey: 'service_16_status',
    href: '/user/automxh?platform=video',
    iconKey: 'video',
    color: 'from-pink-500 to-purple-600',
    textColor: 'text-pink-500',
    defaultTitle: 'Video Edit',
    defaultDesc: 'Dịch vụ chỉnh sửa video chuyên nghiệp',
  },
  {
    key: '17',
    nameKey: 'service_17_name',
    descKey: 'service_17_desc',
    statusKey: 'service_17_status',
    href: '/user/smm?platform=Facebook',
    iconKey: 'facebook',
    color: 'from-blue-700 to-blue-900',
    textColor: 'text-blue-700',
    defaultTitle: 'Facebook Marketing',
    defaultDesc: 'Giải pháp Marketing trên Facebook',
  },
  {
    key: '18',
    nameKey: 'service_18_name',
    descKey: 'service_18_desc',
    statusKey: 'service_18_status',
    href: '/user/smm?search=Zalo',
    iconKey: 'message-circle',
    color: 'from-sky-500 to-blue-600',
    textColor: 'text-sky-500',
    defaultTitle: 'Zalo Marketing',
    defaultDesc: 'Giải pháp Marketing trên Zalo',
  },
  {
    key: '19',
    nameKey: 'service_19_name',
    descKey: 'service_19_desc',
    statusKey: 'service_19_status',
    href: '/user/smm?platform=TikTok',
    iconKey: 'music',
    color: 'from-black to-slate-800',
    textColor: 'text-slate-800',
    defaultTitle: 'Tiktok Marketing',
    defaultDesc: 'Giải pháp Marketing trên Tiktok',
  },
  {
    key: '20',
    nameKey: 'service_20_name',
    descKey: 'service_20_desc',
    statusKey: 'service_20_status',
    href: '/user/smm?platform=Telegram',
    iconKey: 'send',
    color: 'from-cyan-400 to-blue-500',
    textColor: 'text-cyan-500',
    defaultTitle: 'Telegram Marketing',
    defaultDesc: 'Giải pháp Marketing trên Telegram',
  },
];

function mapServices(
  settings: Record<string, string>,
  definitions: ServiceDefinition[]
): LegacyServiceItem[] {
  return definitions.map((definition) => ({
    key: definition.key,
    title: getLegacySetting(settings, definition.nameKey, definition.defaultTitle),
    desc: getLegacySetting(settings, definition.descKey, definition.defaultDesc),
    href: definition.href,
    iconKey: definition.iconKey,
    color: definition.color,
    textColor: definition.textColor,
    maintenance: getLegacySetting(settings, definition.statusKey, 'active') === 'maintenance',
    external: Boolean(definition.external),
  }));
}

export async function getLegacySettingsMap(forceRefresh = false): Promise<Record<string, string>> {
  const now = Date.now();

  if (!forceRefresh && settingsCache && settingsCache.expiresAt > now) {
    return settingsCache.data;
  }

  try {
    const rows = await db.settings.findMany({
      orderBy: { id: 'asc' },
      select: {
        setting_key: true,
        setting_value: true,
      },
    });

    const settings = rows.reduce<Record<string, string>>((acc, row) => {
      acc[row.setting_key] = row.setting_value || '';
      return acc;
    }, {});

    settingsCache = {
      expiresAt: now + SETTINGS_CACHE_TTL_MS,
      data: settings,
    };

    return settings;
  } catch (error) {
    if (settingsCache) {
      return settingsCache.data;
    }

    if (process.env.NODE_ENV === 'development') {
      console.warn('[legacy-settings] Falling back to default settings because database is unavailable.', error);
    }

    return {};
  }
}

export function getLegacySetting(
  settings: Record<string, string>,
  key: string,
  fallback = ''
): string {
  const value = settings[key];
  return typeof value === 'string' && value !== '' ? value : fallback;
}

export function getSmmDefaultProviderId(settings: Record<string, string>): number {
  return Math.max(0, Math.trunc(toNumber(settings.smm_default_provider_id, 0)));
}

export function getSmmPriceMultiplier(settings: Record<string, string>): number {
  const multiplier = toNumber(settings.smm_price_multiplier, 1);
  return multiplier > 0 ? multiplier : 1;
}

export function getVatPercent(settings: Record<string, string>): number {
  const vat = toNumber(settings.vat_percent, 0);
  return vat > 0 ? vat : 0;
}

export function getHomeServiceGrid(settings: Record<string, string>): LegacyServiceItem[] {
  return mapServices(settings, homeServiceDefinitions);
}

export function getSidebarServiceCatalog(settings: Record<string, string>): LegacyServiceItem[] {
  return mapServices(settings, sidebarServiceDefinitions);
}

export function buildLegacyAssetUrl(path: string | null | undefined): string | null {
  if (!path) {
    return null;
  }

  const rawPath = String(path).trim();

  if (!rawPath) {
    return null;
  }

  if (/^https?:\/\//i.test(rawPath)) {
    return rawPath;
  }

  const normalizedPath = rawPath.replace(/^\/+/, '');

  if (normalizedPath.startsWith('public/')) {
    return `/${normalizedPath.slice('public/'.length)}`;
  }

  if (
    normalizedPath.startsWith('uploads/') ||
    normalizedPath.startsWith('assets/') ||
    normalizedPath.startsWith('automxh/')
  ) {
    return `/${normalizedPath}`;
  }

  return `${LEGACY_SITE_ORIGIN}/${normalizedPath}`;
}
