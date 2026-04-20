import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminGameMarketPage() {
  return (
    <AdminDataPage
      title="Quản trị Game Market"
      description="Listing/order game market theo DB hiện có."
      sections={adminPageSections['game-market']}
    />
  );
}
