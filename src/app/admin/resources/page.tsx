import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminResourcesPage() {
  return (
    <AdminDataPage
      title="Quản trị tài nguyên MMO"
      description="Quản lý tài nguyên MMO, danh mục và provider MMO/API tài khoản game."
      sections={adminPageSections.resources}
    />
  );
}
