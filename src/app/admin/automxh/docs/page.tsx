import { AdminAutoMxhApiDocsPage } from '@/components/admin/admin-automxh-api-docs-page';
import { getAutoMxhProductsForCategory, listAutoMxhCatalog } from '@/lib/automxh';
import type { AutoMxhDocsCatalogSection } from '@/lib/automxh-api-docs';
import { getLegacySettingsMap, getVatPercent } from '@/lib/legacy-settings';
import { siteUrl } from '@/lib/seo';

export const dynamic = 'force-dynamic';

function normalizeOrigin(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return siteUrl;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/+$/, '');
}

function getAutoMxhApiPublicBaseUrl() {
  return normalizeOrigin(
    process.env.AUTOMXH_API_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_AUTOMXH_API_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.SITE_URL ||
    siteUrl
  );
}

function formatLoadedAt() {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date());
}

export default async function AdminAutoMxhApiDocumentationPage() {
  let sections: AutoMxhDocsCatalogSection[] = [];
  let vatPercent = 0;
  let loadError = '';

  try {
    const [catalog, settings] = await Promise.all([
      listAutoMxhCatalog(),
      getLegacySettingsMap(),
    ]);

    vatPercent = getVatPercent(settings);
    sections = await Promise.all(
      catalog.map(async (section) => ({
        category: section.category,
        products: await getAutoMxhProductsForCategory(section.category.id),
      }))
    );
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'Không thể tải dữ liệu AutoMXH từ DB';
  }

  return (
    <AdminAutoMxhApiDocsPage
      baseUrl={getAutoMxhApiPublicBaseUrl()}
      sections={sections}
      runtimeMeta={{
        vatPercent,
      }}
      loadedAt={formatLoadedAt()}
      loadError={loadError || undefined}
    />
  );
}
