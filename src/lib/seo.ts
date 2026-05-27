import { serviceSeoEntries, serviceSeoRoutes } from '@/lib/service-seo';

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
  'TRUNGTAMMMO.VN là nền tảng MMO đa dịch vụ gồm SMM, Auto MXH, tài nguyên số, proxy cloud, tài khoản game, random game, VPS GPU AI, forum MMO và công cụ vận hành online.';

function isPreviewHost(value: string) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host.endsWith('.vercel.app') || host.includes('ngrok-free.dev');
  } catch {
    return false;
  }
}

function resolveSiteUrl() {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.SITE_URL,
    process.env.CANONICAL_SITE_URL,
    process.env.API_DOMAIN,
    process.env.LEGACY_SITE_ORIGIN,
    process.env.NEXT_PUBLIC_BASE_URL,
  ]
    .map((value) => normalizeOrigin(value))
    .filter(Boolean);

  const primary = candidates.find((value) => !isPreviewHost(value));
  return primary || DEFAULT_SITE_URL;
}

export const siteUrl = resolveSiteUrl();

export const defaultKeywords = [
  'TRUNGTAMMMO',
  'TRUNGTAMMMO.VN',
  'MMO',
  'SMM',
  'Auto MXH',
  'Social Media Marketing',
  'Tài nguyên MMO',
  'Proxy Cloud',
  'Tài khoản game',
  'Random tài khoản game',
  'VPS GPU AI',
  'TikTok Shop',
  'Shopee',
  'Forum MMO',
  'Nạp tiền MMO',
  'Dịch vụ MMO',
  ...serviceSeoEntries.flatMap((service) => service.keywords),
];

export const publicSeoRoutes = [
  '/',
  '/about',
  '/api',
  '/privacy',
  '/terms',
  '/vps',
  '/vps/gioi-thieu',
  '/vps/services',
  ...serviceSeoRoutes,
];

export function buildAbsoluteUrl(path = '/') {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return new URL(normalizedPath, siteUrl).toString();
}
