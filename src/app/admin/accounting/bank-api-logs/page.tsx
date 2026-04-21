import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminAccountingBankLogsPage() {
  return <AdminDataPage title="Bank API logs" description="Theo dõi nhật ký cron và kết nối ngân hàng để đối soát giao dịch nạp tiền." sections={adminPageSections['activity-logs'].filter((section) => section.resource === 'bank-logs')} />;
}
