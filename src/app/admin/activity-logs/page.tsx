import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminActivityLogsPage() {
  return (
    <AdminDataPage
      title="Nhật ký hoạt động"
      description="Activity logs, audit trail và bank API logs."
      sections={adminPageSections['activity-logs']}
    />
  );
}
