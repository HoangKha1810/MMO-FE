import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminDepositsPage() {
  return (
    <AdminDataPage
      title="Quản trị nạp tiền"
      description="Duyệt/reject nạp tiền, quản lý bank và xem bank API logs."
      sections={adminPageSections.deposits}
    />
  );
}
