import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminFindJobPage() {
  return (
    <AdminDataPage
      title="Quản trị Find Job MMO"
      description="Tin việc làm, trạng thái duyệt và ghim bài nổi bật lên đầu trang."
      sections={adminPageSections['find-job']}
    />
  );
}
