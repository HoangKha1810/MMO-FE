import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

const sections = [
  {
    resource: 'interface-settings',
    title: 'Interface settings',
    description: 'Logo, favicon, notification, theme và cấu hình giao diện nếu bảng legacy tồn tại.',
    columns: ['id', 'setting_key', 'setting_value', 'updated_at'],
    editableFields: ['setting_value'],
    createFields: ['setting_key', 'setting_value'],
  },
  adminPageSections.settings[0],
];

export default function AdminInterfaceSettingsPage() {
  return <AdminDataPage title="Interface settings" description="Cài đặt giao diện, upload key/path logo/favicon và notification." sections={sections} />;
}
