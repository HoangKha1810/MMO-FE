import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminForumApprovalsPage() {
  return <AdminDataPage title="Forum approvals" description="Duyệt thread, post và report đang chờ xử lý." sections={adminPageSections.forum.filter((section) => ['forum-threads', 'forum-posts', 'forum-reports'].includes(section.resource))} />;
}
