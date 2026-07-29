import { AdminDataPage } from '@/components/admin/admin-data-page';
import { vpsCloudAdminSections } from '@/lib/admin-page-config';

export default function AdminVpsPricingPage() {
  return (
    <AdminDataPage
      title="Chỉnh giá VPS"
      description="Quản lý giá bán VPS Cloud, giá so sánh, addon CPU/RAM/Disk và trạng thái hiển thị trên web."
      sections={vpsCloudAdminSections}
    />
  );
}
