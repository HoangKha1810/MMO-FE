import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminSupportTikTokMenusPage() {
  return <AdminDataPage title="Support TikTok menus" description="CRUD menu dịch vụ support TikTok." sections={adminPageSections['support-tiktok'].filter((section) => section.resource === 'tiktok-service-menus')} />;
}
