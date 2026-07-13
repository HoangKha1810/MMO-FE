import { AdminDataPage } from '@/components/admin/admin-data-page';
import { requireAdminPage } from '@/lib/admin-auth';
import { adminPageSections } from '@/lib/admin-page-config';
import { isOperatorAdminRole } from '@/lib/admin-permissions';

export default async function AdminKenhTikTokPage() {
  const user = await requireAdminPage();
  const sections = isOperatorAdminRole(user.role)
    ? adminPageSections['kenh-tiktok']
      .filter((section) => section.resource !== 'kenh-tiktok-settings')
    : adminPageSections['kenh-tiktok'];

  return (
    <AdminDataPage
      title="Kênh TikTok"
      description="Đấu API Kênh Giá Rẻ, đồng bộ giá API, chỉnh giá bán web và quản lý đơn mua kênh TikTok."
      sections={sections}
    />
  );
}
