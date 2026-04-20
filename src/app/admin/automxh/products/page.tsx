import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminAutoMxhProductsPage() {
  return <AdminDataPage title="Auto MXH products" description="Product, API mapping và custom input." sections={adminPageSections.automxh.filter((section) => section.resource === 'automxh-products')} />;
}
