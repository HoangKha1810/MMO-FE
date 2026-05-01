import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminSmmServicesPage() {
  return <AdminDataPage title="Cấu hình Dịch vụ SMM" description="Bộ lọc nguồn, danh mục, giá và đồng bộ dịch vụ SMM theo giao diện vận hành cũ." sections={adminPageSections.smm.filter((section) => section.resource === 'smm-services')} />;
}
