import { AdminDataPage } from '@/components/admin/admin-data-page';

const sections = [
  {
    resource: 'mmo-api',
    title: 'MMO API nâng cao',
    description: 'Quản lý bảng API chuyên sâu dành cho nhóm tài nguyên MMO và đồng bộ dữ liệu dịch vụ.',
    columns: ['id', 'name', 'category', 'price', 'margin_percent', 'status', 'updated_at'],
    editableFields: ['name', 'category', 'price', 'margin_percent', 'status'],
    statusOptions: ['active', 'inactive'],
  },
  {
    resource: 'mmo-resources-sales',
    title: 'Doanh số tài nguyên chuyên sâu',
    description: 'Theo dõi dữ liệu doanh số và tình trạng bán hàng ở nhóm tài nguyên chuyên sâu.',
    columns: ['id', 'user_id', 'resource_id', 'status', 'buyer_email', 'note', 'created_at'],
    editableFields: ['status', 'note'],
  },
];

export default function AdminResourceMmoApiPage() {
  return <AdminDataPage title="MMO API chuyên sâu" description="Quản lý provider API tài khoản game/MMO, bảng giá API, doanh số tài nguyên và đồng bộ biên độ ở tầng chuyên sâu." sections={sections} />;
}
