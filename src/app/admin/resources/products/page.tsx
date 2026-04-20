import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminResourceProductsPage() {
  return <AdminDataPage title="Resource products" description="Sản phẩm tài nguyên, stock, delivery data và API CloneTut/MMO." sections={adminPageSections.resources.filter((section) => section.resource === 'resources')} />;
}
