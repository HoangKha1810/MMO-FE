import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminWebServicePage() {
  return (
    <AdminDataPage
      title="Web con MMO và Build Website"
      description="Quản lý gói dịch vụ, giá dự kiến và đơn yêu cầu làm web của người dùng."
      sections={adminPageSections['web-service']}
    />
  );
}
