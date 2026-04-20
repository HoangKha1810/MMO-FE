import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminResourceOrdersPage() {
  return <AdminDataPage title="Resource orders" description="Đơn bán tài nguyên, delivery/export và trạng thái." sections={adminPageSections.resources.filter((section) => section.resource === 'resource-orders')} />;
}
