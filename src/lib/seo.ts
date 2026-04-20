const DEFAULT_SITE_URL = 'https://trungtammmo.vn';

function normalizeOrigin(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) {
    return DEFAULT_SITE_URL;
  }

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/+$/, '');
}

export const siteName = 'TRUNGTAMMMO.VN';
export const siteShortName = 'TRUNGTAMMMO';
export const siteDescription =
  'TRUNGTAMMMO.VN là nền tảng MMO đa dịch vụ gồm SMM, Auto MXH, tài nguyên số, forum MMO, nạp tiền và cụm công cụ vận hành trên dữ liệu MySQL kế thừa.';
export const siteUrl = normalizeOrigin(
  process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.API_DOMAIN ||
    process.env.LEGACY_SITE_ORIGIN ||
    DEFAULT_SITE_URL
);

export const defaultKeywords = [
  'TRUNGTAMMMO',
  'TRUNGTAMMMO.VN',
  'MMO',
  'SMM',
  'Auto MXH',
  'Social Media Marketing',
  'Tài nguyên MMO',
  'Forum MMO',
  'Nạp tiền MMO',
  'Dịch vụ MMO',
];

export const publicSeoRoutes = [
  '/',
  '/about',
  '/privacy',
  '/terms',
];

export function buildAbsoluteUrl(path = '/') {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return new URL(normalizedPath, siteUrl).toString();
}

