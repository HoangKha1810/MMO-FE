import { AdminDataPage } from '@/components/admin/admin-data-page';
import { requireAdminPage } from '@/lib/admin-auth';
import { adminPageSections } from '@/lib/admin-page-config';

export default async function AdminGameMarketPage() {
  await requireAdminPage();

  return (
    <AdminDataPage
      title="Quản trị Trao đổi Game"
      description="Quản lý bài đăng trao đổi game, ghim/xóa/chỉnh sửa bài và theo dõi đơn trao đổi."
      sections={adminPageSections['game-market']}
    />
  );
}
