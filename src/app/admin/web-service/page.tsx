import { AdminDataPage } from '@/components/admin/admin-data-page';
import { requireAdminPage } from '@/lib/admin-auth';
import { adminPageSections } from '@/lib/admin-page-config';
import { isOperatorAdminRole } from '@/lib/admin-permissions';

export default async function AdminWebServicePage() {
  const user = await requireAdminPage();
  const sections = isOperatorAdminRole(user.role)
    ? adminPageSections['web-service'].filter((section) => section.resource === 'web-service-orders')
    : adminPageSections['web-service'];

  return (
    <AdminDataPage
      title="Web con MMO và Build Website"
      description="Quản lý gói dịch vụ, giá dự kiến và đơn yêu cầu làm web của người dùng."
      sections={sections}
    />
  );
}
