import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminPressPage() {
  return (
    <AdminDataPage
      title="Dịch vụ lên báo"
      description="Quản lý bảng giá đầu báo, file DOCX khách upload và trạng thái xử lý đơn."
      sections={adminPageSections.press}
    />
  );
}
