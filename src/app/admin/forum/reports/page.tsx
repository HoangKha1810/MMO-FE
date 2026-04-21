import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminForumReportsPage() {
  return <AdminDataPage title="Forum reports" description="Tiếp nhận và xử lý báo cáo bài viết hoặc thành viên từ cộng đồng forum." sections={adminPageSections.forum.filter((section) => section.resource === 'forum-reports')} />;
}
