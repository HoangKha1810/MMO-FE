import { AppShell } from '@/components/layout/app-shell';
import { ProxyMarketplacePage } from '@/components/proxy/proxy-marketplace-page';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function UserProxyPage() {
  const { shell } = await getCurrentUserForShell();

  return (
    <AppShell user={shell}>
      <ProxyMarketplacePage initialUser={shell} />
    </AppShell>
  );
}
