import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminVibeCodePage() {
  return (
    <AdminDataPage
      title="Vibe Code"
      description="Chỉnh giá Cursor AI, Codex API và theo dõi mã đơn khách gửi admin."
      sections={adminPageSections['vibe-code']}
    />
  );
}
