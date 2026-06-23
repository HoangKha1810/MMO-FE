import { AdminSmmApiDocsPage } from '@/components/admin/admin-smm-api-docs-page';
import { getLegacySettingsMap, getVatPercent } from '@/lib/legacy-settings';
import { getSmmProviderMeta, listSmmServices, type SmmProviderMeta, type SmmServiceRecord } from '@/lib/smm-provider';
import { siteUrl } from '@/lib/seo';

export const dynamic = 'force-dynamic';

function normalizeOrigin(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return siteUrl;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/+$/, '');
}

function getSmmApiPublicBaseUrl() {
  return normalizeOrigin(
    process.env.SMM_API_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SMM_API_PUBLIC_BASE_URL ||
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

export default async function AdminSmmApiDocumentationPage() {
  let services: SmmServiceRecord[] = [];
  let providerMeta: SmmProviderMeta | null = null;
  let vatPercent = 0;
  let loadError = '';

  try {
    const [loadedServices, loadedProviderMeta, settings] = await Promise.all([
      listSmmServices(false),
      getSmmProviderMeta(),
      getLegacySettingsMap(),
    ]);

    services = loadedServices;
    providerMeta = loadedProviderMeta;
    vatPercent = getVatPercent(settings);
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'Không thể tải dữ liệu SMM từ DB';
  }

  return (
    <AdminSmmApiDocsPage
      baseUrl={getSmmApiPublicBaseUrl()}
      services={services}
      runtimeMeta={{
        providerName: providerMeta?.providerName,
        exchangeRate: providerMeta?.exchangeRate,
        marginPercent: providerMeta?.marginPercent,
        vatPercent,
      }}
      loadedAt={formatLoadedAt()}
      loadError={loadError || undefined}
    />
  );
}
