import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminForumHiddenPage() {
  return <AdminDataPage title="Forum hidden" description="Kiểm tra và khôi phục thread/post bị hidden hoặc deleted." sections={adminPageSections.forum.filter((section) => ['forum-threads', 'forum-posts'].includes(section.resource))} />;
}
