import { AdminDataPage } from '@/components/admin/admin-data-page';
import { AdminServiceStatusPanel } from '@/components/admin/admin-service-status-panel';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <AdminServiceStatusPanel />
      <AdminDataPage
        title="Cài đặt hệ thống"
        description="Settings key-value, bank CRUD, providers và các config giao diện/API."
        sections={adminPageSections.settings}
      />
    </div>
  );
}
