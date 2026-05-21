import { ResourceContactAdminMode } from '@/components/resources/resource-contact-admin-mode';
import { ResourcesPageClient } from '@/components/resources/resources-page-client';
import { getLegacySettingsMap, isResourcesContactAdminMode } from '@/lib/legacy-settings';

export const dynamic = 'force-dynamic';

export default async function ResourcesPage() {
  const settings = await getLegacySettingsMap();

  if (isResourcesContactAdminMode(settings)) {
    return <ResourceContactAdminMode />;
  }

  return <ResourcesPageClient />;
}
