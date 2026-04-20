import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminOrdersPage() {
  return (
    <AdminDataPage
      title="Tổng hợp đơn hàng"
      description="SMM, Auto MXH, card và các order queue chính."
      sections={adminPageSections.orders}
    />
  );
}
