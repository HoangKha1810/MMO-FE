import { AdminDataPage } from '@/components/admin/admin-data-page';

const sections = [
  {
    resource: 'mmo-api',
    title: 'MMO API legacy',
    description: 'Bảng API chuyên sâu nếu database cũ đã migrate.',
    columns: ['id', 'name', 'category', 'price', 'margin_percent', 'status', 'updated_at'],
    editableFields: ['name', 'category', 'price', 'margin_percent', 'status'],
    statusOptions: ['active', 'inactive'],
  },
  {
    resource: 'mmo-resources-sales',
    title: 'MMO resources sales legacy',
    description: 'Sales table legacy nếu còn tồn tại trong DB cũ.',
    columns: ['id', 'user_id', 'resource_id', 'status', 'buyer_email', 'note', 'created_at'],
    editableFields: ['status', 'note'],
  },
];

export default function AdminResourceMmoApiPage() {
  return <AdminDataPage title="MMO API chuyên sâu" description="Provider CloneTut/MMO, API price, sales legacy và sync/margin theo DB thật." sections={sections} />;
}
