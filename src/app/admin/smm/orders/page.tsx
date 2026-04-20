import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminSmmOrdersPage() {
  return <AdminDataPage title="SMM orders" description="Theo dõi order SMM, cập nhật status, refund, start_count và remains." sections={adminPageSections.smm.filter((section) => section.resource === 'smm-orders')} />;
}
