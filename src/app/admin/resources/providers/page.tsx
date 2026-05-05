import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminResourceProvidersPage() {
  return <AdminDataPage title="MMO API providers" description="Provider API tài khoản game/MMO, exchange rate và health." sections={adminPageSections.resources.filter((section) => section.resource === 'providers')} />;
}
