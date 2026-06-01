import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminMetaSupportPage() {
  return (
    <AdminDataPage
      title="Auto kích nút Meta"
      description="Quản lý đơn Auto kích nút + Chat Support Meta."
      sections={adminPageSections['meta-support']}
    />
  );
}
