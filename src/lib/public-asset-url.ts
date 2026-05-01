const DEFAULT_LEGACY_SITE_ORIGIN =
  process.env.NEXT_PUBLIC_LEGACY_SITE_ORIGIN?.replace(/\/+$/, '') ||
  process.env.LEGACY_SITE_ORIGIN?.replace(/\/+$/, '') ||
  'https://trungtammmo.vn';

export function buildPublicAssetUrl(path: string | null | undefined): string | null {
  if (!path) {
    return null;
  }

  const rawPath = String(path).trim();

  if (!rawPath) {
    return null;
  }

  if (/^data:/i.test(rawPath) || /^blob:/i.test(rawPath)) {
    return rawPath;
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

  return `${DEFAULT_LEGACY_SITE_ORIGIN}/${normalizedPath}`;
}
