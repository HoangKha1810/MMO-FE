import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminCardApiPage() {
  return (
    <AdminDataPage
      title="Card API config"
      description="Cấu hình TheCaoSieuToc cho luồng đổi thẻ và đối chiếu provider/API."
      sections={[
        ...adminPageSections.card.filter((section) => section.resource === 'card-api-settings'),
        ...adminPageSections.settings.filter((section) => ['settings', 'providers'].includes(section.resource)),
      ]}
    />
  );
}
