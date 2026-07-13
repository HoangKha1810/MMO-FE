import { AdminDataPage } from '@/components/admin/admin-data-page';
import { requireOwnerPage } from '@/lib/admin-auth';
import { adminPageSections } from '@/lib/admin-page-config';

export default async function AdminKenhTikTokPage() {
  await requireOwnerPage();

  return (
    <AdminDataPage
      title="Kênh TikTok"
      description="Đấu API Kênh Giá Rẻ, đồng bộ giá API, chỉnh giá bán web và quản lý đơn mua kênh TikTok."
      sections={adminPageSections['kenh-tiktok']}
    />
  );
}
