import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminResourceCategoriesPage() {
  return <AdminDataPage title="Resource categories" description="Danh mục tài nguyên MMO và mapping API category." sections={adminPageSections.resources.filter((section) => section.resource === 'resource-categories')} />;
}
