import { AppShell } from '@/components/layout/app-shell';
import { VpsGpuImageBuilderPage } from '@/components/vps-gpu/vps-gpu-image-builder-page';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function UserVpsGpuImagesPage() {
  const { shell } = await getCurrentUserForShell();

  return (
    <AppShell user={shell}>
      <VpsGpuImageBuilderPage />
    </AppShell>
  );
}
