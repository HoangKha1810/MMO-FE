import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminForumPage() {
  return (
    <AdminDataPage
      title="Quản trị forum"
      description="Danh mục, thread, bài viết, duyệt/ẩn/pin/lock nội dung."
      sections={adminPageSections.forum}
    />
  );
}
