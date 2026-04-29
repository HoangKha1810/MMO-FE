import type { Metadata } from 'next';
import { AdminShell } from '@/components/admin/admin-shell';
import { requireAdminPage } from '@/lib/admin-auth';
import { buildLegacyAssetUrl, getLegacySetting, getLegacySettingsMap } from '@/lib/legacy-settings';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdminPage();
  const settings = await getLegacySettingsMap();
  const siteName = getLegacySetting(settings, 'site_name', 'TRUNGTAMMMO');
  const rawLogo = getLegacySetting(settings, 'site_logo', 'logo.gif');
  const siteLogo = buildLegacyAssetUrl(rawLogo) || '/logo.gif';

  return <AdminShell user={user} branding={{ siteName, siteLogo }}>{children}</AdminShell>;
}
