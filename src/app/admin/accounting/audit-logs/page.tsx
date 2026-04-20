import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminAccountingAuditLogsPage() {
  return <AdminDataPage title="Audit logs" description="Nhật ký hành động admin để hậu kiểm." sections={adminPageSections.accounting.filter((section) => section.resource === 'admin-audit-logs')} />;
}
