import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminForumAdsPage() {
  return <AdminDataPage title="Forum ads" description="Duyệt quảng cáo, thời hạn hiển thị và reject reason." sections={adminPageSections.forum.filter((section) => section.resource === 'forum-ads')} />;
}
