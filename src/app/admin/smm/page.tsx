import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminSmmPage() {
  return (
    <AdminDataPage
      title="Quản trị SMM"
      description="Services, provider, price/margin/status, sync provider và order queue."
      sections={adminPageSections.smm}
    />
  );
}
