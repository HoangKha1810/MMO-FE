import { AdminDataPage } from '@/components/admin/admin-data-page';

const sections = [
  {
    resource: 'accounting-extra',
    title: 'Accounting extra',
    description: 'Khoản thu/chi bổ sung nếu bảng accounting_extra đã migrate.',
    columns: ['id', 'type', 'amount', 'note', 'status', 'created_at'],
    editableFields: ['type', 'amount', 'note', 'status'],
    createFields: ['type', 'amount', 'note', 'status'],
    statusOptions: ['pending', 'success', 'failed'],
  },
];

export default function AdminAccountingExtraPage() {
  return <AdminDataPage title="Accounting extra" description="Quản lý khoản thu/chi bổ sung và dữ liệu kế toán phụ." sections={sections} />;
}
