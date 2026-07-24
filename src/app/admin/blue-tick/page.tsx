import { AdminDataPage } from '@/components/admin/admin-data-page';
import { requireAdminPage } from '@/lib/admin-auth';
import { adminPageSections } from '@/lib/admin-page-config';

export default async function AdminBlueTickPage() {
  await requireAdminPage();

  return (
    <AdminDataPage
      title="Tick xanh"
      description="Quản lý đơn mua/gia hạn tick xanh của user và chỉnh trạng thái khi cần."
      sections={adminPageSections['blue-tick']}
    />
  );
}
