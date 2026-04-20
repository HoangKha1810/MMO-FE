import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminAutoMxhOrdersPage() {
  return <AdminDataPage title="Auto MXH orders" description="Order status, avatar/files, perfection content và xuất đơn." sections={adminPageSections.automxh.filter((section) => section.resource === 'automxh-orders')} />;
}
