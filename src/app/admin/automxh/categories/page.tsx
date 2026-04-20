import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminAutoMxhCategoriesPage() {
  return <AdminDataPage title="Auto MXH categories" description="CRUD category Auto MXH." sections={adminPageSections.automxh.filter((section) => section.resource === 'automxh-categories')} />;
}
