import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminSupportTikTokPage() {
  return <AdminDataPage title="Support TikTok" description="Quản lý order, menu dịch vụ, region, tin nhắn admin và report của module Support TikTok." sections={adminPageSections['support-tiktok']} />;
}
