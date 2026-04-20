import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminForumReportsPage() {
  return <AdminDataPage title="Forum reports" description="Xử lý report bài viết/thành viên từ forum legacy." sections={adminPageSections.forum.filter((section) => section.resource === 'forum-reports')} />;
}
