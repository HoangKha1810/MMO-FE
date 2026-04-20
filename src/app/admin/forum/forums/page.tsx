import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminForumFoldersPage() {
  return <AdminDataPage title="Forum folders" description="Danh mục và folder forum, role đăng bài và priority." sections={adminPageSections.forum.filter((section) => ['forum-categories', 'forum-forums'].includes(section.resource))} />;
}
