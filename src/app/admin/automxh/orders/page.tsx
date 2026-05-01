import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminAutoMxhOrdersPage() {
  return <AdminDataPage title="Quản lý Đơn hàng Auto MXH" description="Card list, tab trạng thái, Telegram workflow và xuất đơn theo bố cục web cũ." sections={adminPageSections.automxh.filter((section) => section.resource === 'automxh-orders')} />;
}
