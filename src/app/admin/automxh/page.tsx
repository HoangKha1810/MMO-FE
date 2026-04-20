import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminAutomxhPage() {
  return (
    <AdminDataPage
      title="Quản trị Auto MXH"
      description="CRUD category/product, sync và quản lý order Auto MXH."
      sections={adminPageSections.automxh}
    />
  );
}
