import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminAccountingPage() {
  return (
    <AdminDataPage
      title="Kế toán hệ thống"
      description="Transactions, doanh số tài nguyên và lịch sử card để đối soát/export."
      sections={adminPageSections.accounting}
    />
  );
}
