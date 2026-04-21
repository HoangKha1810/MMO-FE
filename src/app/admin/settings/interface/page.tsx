import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

const sections = [
  {
    resource: 'interface-settings',
    title: 'Interface settings',
    description: 'Quản lý logo, favicon, thông báo, theme và các cấu hình nhận diện giao diện của hệ thống.',
    columns: ['id', 'setting_key', 'setting_value', 'updated_at'],
    editableFields: ['setting_value'],
    createFields: ['setting_key', 'setting_value'],
  },
  adminPageSections.settings[0],
];

export default function AdminInterfaceSettingsPage() {
  return <AdminDataPage title="Interface settings" description="Cài đặt giao diện, upload key/path logo/favicon và notification." sections={sections} />;
}
