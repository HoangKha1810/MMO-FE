import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminSmmServicesPage() {
  return <AdminDataPage title="SMM services" description="Quản lý service, giá, trạng thái và sync toàn bộ dịch vụ SubMetaVip." sections={adminPageSections.smm.filter((section) => section.resource === 'smm-services')} />;
}
