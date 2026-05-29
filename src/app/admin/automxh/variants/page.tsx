import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminAutoMxhVariantsPage() {
  return <AdminDataPage title="Máy chủ dịch vụ Auto MXH" description="Thêm/sửa các gói con trong phần Chọn máy chủ dịch vụ." sections={adminPageSections.automxh.filter((section) => section.resource === 'automxh-variants')} />;
}
