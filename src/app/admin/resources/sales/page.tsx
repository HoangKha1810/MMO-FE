import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminResourceSalesPage() {
  return <AdminDataPage title="Resource sales" description="Đơn mua tài nguyên, download count, delivery data và trạng thái giao hàng." sections={adminPageSections.resources.filter((section) => section.resource === 'resource-orders')} />;
}
