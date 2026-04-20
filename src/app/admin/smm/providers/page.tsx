import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminSmmProvidersPage() {
  return <AdminDataPage title="SMM providers" description="CRUD provider SubMetaVip/Standard, API URL/key, exchange rate và health." sections={adminPageSections.smm.filter((section) => section.resource === 'providers')} />;
}
