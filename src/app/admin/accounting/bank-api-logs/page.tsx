import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminAccountingBankLogsPage() {
  return <AdminDataPage title="Bank API logs" description="Log cron/API ngân hàng. Nếu bảng legacy chưa migrate, trang sẽ báo rõ thay vì lỗi." sections={adminPageSections['activity-logs'].filter((section) => section.resource === 'bank-logs')} />;
}
