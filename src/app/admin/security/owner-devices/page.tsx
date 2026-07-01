import { OwnerDeviceControlPage } from '@/components/admin/owner-device-control-page';
import { requireOwnerPage } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminOwnerDevicesPage() {
  await requireOwnerPage();
  return <OwnerDeviceControlPage />;
}
