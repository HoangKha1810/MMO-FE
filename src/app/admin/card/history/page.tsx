import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminCardHistoryPage() {
  return <AdminDataPage title="Card history" description="Lịch sử, trạng thái, refund và API order id." sections={adminPageSections.card.filter((section) => section.resource === 'card-orders')} />;
}
