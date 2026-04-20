import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminAutoMxhVariantsPage() {
  return <AdminDataPage title="Auto MXH variants" description="Biến thể dịch vụ, giá vốn, API service và upload options." sections={adminPageSections.automxh.filter((section) => section.resource === 'automxh-variants')} />;
}
