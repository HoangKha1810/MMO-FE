import { AdminDataPage } from '@/components/admin/admin-data-page';
import { vpsGpuAdminSections } from '@/lib/admin-page-config';

export default function AdminVpsGpuCostsPage() {
  return (
        <AdminDataPage
          title="Giá vốn VPS GPU"
          description="Chỉnh hệ số nâng giá VPS GPU và xem bảng giá vốn nguồn GPU đã lưu để so sánh lời/lỗ."
          sections={vpsGpuAdminSections}
        />
  );
}
