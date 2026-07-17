import { AppShell } from '@/components/layout/app-shell';
import { UserApiHubPage } from '@/components/user/user-api-hub-page';
import { getAutoMxhProductsForCategory, listAutoMxhCatalog } from '@/lib/automxh';
import type { AutoMxhDocsCatalogSection } from '@/lib/automxh-api-docs';
import { getGameApiPublicBaseUrl } from '@/lib/game-api-public-url';
import { getLegacySettingsMap, getVatPercent } from '@/lib/legacy-settings';
import { siteUrl } from '@/lib/seo';
import { getSmmProviderMeta, listSmmServices, type SmmProviderMeta, type SmmServiceRecord } from '@/lib/smm-provider';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

export default async function UserAutoMxhApiPage() {
  const { shell } = await getCurrentUserForShell();
  let automxhSections: AutoMxhDocsCatalogSection[] = [];
  let smmServices: SmmServiceRecord[] = [];
  let smmProviderMeta: SmmProviderMeta | null = null;
  let vatPercent = 0;
  const loadErrors: { automxh?: string; smm?: string } = {};

  try {
    const settings = await getLegacySettingsMap();
    vatPercent = getVatPercent(settings);
  } catch {
    vatPercent = 0;
  }

  try {
    const catalog = await listAutoMxhCatalog();
    automxhSections = await Promise.all(
      catalog.map(async (section) => ({
        category: section.category,
        products: await getAutoMxhProductsForCategory(section.category.id),
      }))
    );
  } catch (error) {
    loadErrors.automxh = error instanceof Error ? error.message : 'Không thể tải dữ liệu AutoMXH từ DB';
  }

  try {
    const [loadedServices, loadedProviderMeta] = await Promise.all([
      listSmmServices(false),
      getSmmProviderMeta(),
    ]);

    smmServices = loadedServices;
    smmProviderMeta = loadedProviderMeta;
  } catch (error) {
    loadErrors.smm = error instanceof Error ? error.message : 'Không thể tải dữ liệu SMM từ DB';
  }

  return (
    <AppShell user={shell}>
      <UserApiHubPage
        baseUrls={{
          automxh: getAutoMxhApiPublicBaseUrl(),
          smm: getSmmApiPublicBaseUrl(),
          game: getGameApiPublicBaseUrl(),
        }}
        automxhSections={automxhSections}
        smmServices={smmServices}
        automxhRuntimeMeta={{ vatPercent }}
        smmRuntimeMeta={{
          providerName: smmProviderMeta?.providerName,
          exchangeRate: smmProviderMeta?.exchangeRate,
          marginPercent: smmProviderMeta?.marginPercent,
          vatPercent,
        }}
        loadedAt={formatLoadedAt()}
        loadErrors={loadErrors}
      />
    </AppShell>
  );
}
