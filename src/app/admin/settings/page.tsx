import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminSettingsPage() {
  return (
    <AdminDataPage
      title="Cài đặt hệ thống"
      description="Settings key-value, bank CRUD, providers và các config giao diện/API."
      sections={adminPageSections.settings}
    />
  );
}
