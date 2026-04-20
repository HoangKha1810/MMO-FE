import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminSecurityPage() {
  return (
    <AdminDataPage
      title="Bảo mật & audit"
      description="IP blacklist/ban, audit log và các vùng điều tra sự cố."
      sections={adminPageSections.security}
    />
  );
}
