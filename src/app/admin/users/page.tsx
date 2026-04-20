import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminUsersPage() {
  return (
    <AdminDataPage
      title="Quản trị người dùng"
      description="List/search/filter user, chỉnh số dư/rank/status, khóa/mở và xử lý hàng loạt."
      sections={adminPageSections.users}
    />
  );
}
