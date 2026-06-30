import { AdminDataPage } from '@/components/admin/admin-data-page';
import { requireAdminPage } from '@/lib/admin-auth';
import { adminPageSections } from '@/lib/admin-page-config';
import { isOperatorAdminRole } from '@/lib/admin-permissions';

export default async function AdminGameMarketPage() {
  const user = await requireAdminPage();
  const sections = isOperatorAdminRole(user.role)
    ? adminPageSections['game-market'].filter((section) => section.resource === 'game-orders')
    : adminPageSections['game-market'];

  return (
    <AdminDataPage
      title="Quản trị Game Market"
      description="Quản lý bài đăng mua bán game, duyệt bài theo danh mục và theo dõi đơn hàng game-market."
      sections={sections}
    />
  );
}
