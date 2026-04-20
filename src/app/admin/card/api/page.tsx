import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminCardApiPage() {
  return <AdminDataPage title="Card API config" description="Cấu hình provider/API thẻ qua settings và test bằng key-value." sections={adminPageSections.settings.filter((section) => ['settings', 'providers'].includes(section.resource))} />;
}
