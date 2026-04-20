import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminCardRatesPage() {
  return <AdminDataPage title="Card rates" description="Batch chỉnh tỉ lệ đổi/mua/topup thẻ." sections={adminPageSections.card.filter((section) => section.resource === 'card-rates')} />;
}
