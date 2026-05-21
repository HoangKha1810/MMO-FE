import { AppShell } from '@/components/layout/app-shell';
import { VpsGpuPage } from '@/components/vps-gpu/vps-gpu-page';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function UserVpsGpuPage() {
  const { shell } = await getCurrentUserForShell();

  return (
    <AppShell user={shell}>
      <VpsGpuPage initialUser={shell} />
    </AppShell>
  );
}
