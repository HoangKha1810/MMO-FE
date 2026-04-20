import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminForumCategoriesPage() {
  return <AdminDataPage title="Forum categories" description="Quản lý danh mục và folder forum." sections={adminPageSections.forum.filter((section) => ['forum-categories', 'forum-forums'].includes(section.resource))} />;
}
