import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminCardPage() {
  return (
    <AdminDataPage
      title="Quản trị thẻ cào"
      description="History, refund, trạng thái và API order id."
      sections={adminPageSections.card}
    />
  );
}
