import { AdminDataPage } from '@/components/admin/admin-data-page';
import { requireAdminPage } from '@/lib/admin-auth';
import { adminPageSections } from '@/lib/admin-page-config';
import { isOperatorAdminRole } from '@/lib/admin-permissions';

export default async function AdminPressPage() {
  const user = await requireAdminPage();
  const sections = isOperatorAdminRole(user.role)
    ? adminPageSections.press.filter((section) => section.resource === 'press-orders')
    : adminPageSections.press;

  return (
    <AdminDataPage
      title="Dịch vụ lên báo"
      description="Quản lý bảng giá đầu báo, file DOCX khách upload và trạng thái xử lý đơn."
      sections={sections}
    />
  );
}
