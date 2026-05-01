import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminGameMarketPage() {
  return (
    <AdminDataPage
      title="Quản trị Game Market"
      description="Quản lý bài đăng mua bán game, duyệt bài theo danh mục và theo dõi đơn hàng game-market."
      sections={adminPageSections['game-market']}
    />
  );
}
