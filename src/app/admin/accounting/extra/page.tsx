import { AdminDataPage } from '@/components/admin/admin-data-page';

const sections = [
  {
    resource: 'accounting-extra',
    title: 'Accounting extra',
    description: 'Quản lý các khoản thu chi bổ sung phục vụ đối soát và vận hành kế toán.',
    columns: ['id', 'type', 'amount', 'note', 'status', 'created_at'],
    editableFields: ['type', 'amount', 'note', 'status'],
    createFields: ['type', 'amount', 'note', 'status'],
    statusOptions: ['pending', 'success', 'failed'],
  },
];

export default function AdminAccountingExtraPage() {
  return <AdminDataPage title="Accounting extra" description="Quản lý khoản thu/chi bổ sung và dữ liệu kế toán phụ." sections={sections} />;
}
