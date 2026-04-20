import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminForumSettingsPage() {
  return <AdminDataPage title="Forum settings" description="Prefix, badge, ads và key-value settings liên quan forum." sections={[...adminPageSections.forum.filter((section) => ['forum-prefixes', 'forum-badges', 'forum-ads'].includes(section.resource)), adminPageSections.settings[0]]} />;
}
