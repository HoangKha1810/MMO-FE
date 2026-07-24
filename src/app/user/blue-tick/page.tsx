import { AppShell } from '@/components/layout/app-shell';
import { BlueTickPage } from '@/components/blue-tick/blue-tick-page';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

export default async function UserBlueTickPage() {
  const { shell } = await getCurrentUserForShell();

  return (
    <AppShell user={shell}>
      <BlueTickPage initialUser={shell} />
    </AppShell>
  );
}
