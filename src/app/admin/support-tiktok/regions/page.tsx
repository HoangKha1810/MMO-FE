import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminSupportTikTokRegionsPage() {
  return <AdminDataPage title="Support TikTok region services" description="CRUD dịch vụ theo region, giá, service key, mô tả và trạng thái." sections={adminPageSections['support-tiktok'].filter((section) => section.resource === 'tiktok-region-services')} />;
}
