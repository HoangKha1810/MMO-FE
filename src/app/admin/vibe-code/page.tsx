import { AdminDataPage } from '@/components/admin/admin-data-page';
import { requireAdminPage } from '@/lib/admin-auth';
import { adminPageSections } from '@/lib/admin-page-config';
import { isOperatorAdminRole } from '@/lib/admin-permissions';

export default async function AdminVibeCodePage() {
  const user = await requireAdminPage();
  const sections = isOperatorAdminRole(user.role)
    ? adminPageSections['vibe-code'].filter((section) => section.resource === 'vibe-code-orders')
    : adminPageSections['vibe-code'];

  return (
    <AdminDataPage
      title="Vibe Code"
      description="Chỉnh giá Cursor AI, Codex API và theo dõi mã đơn khách gửi admin."
      sections={sections}
    />
  );
}
