import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminSupportTikTokOrdersPage() {
  return <AdminDataPage title="Support TikTok orders" description="Order management toàn hệ thống cho support TikTok." sections={adminPageSections['support-tiktok'].filter((section) => section.resource === 'tiktok-orders')} />;
}
