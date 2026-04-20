import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminForumMembersPage() {
  return <AdminDataPage title="Forum members" description="Quản lý thành viên forum qua bảng users thật: rank, role, status, khóa/mở và blue tick." sections={adminPageSections.users} />;
}
