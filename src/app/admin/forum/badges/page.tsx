import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminForumBadgesPage() {
  return <AdminDataPage title="Forum badges & prefixes" description="Badge thành viên và prefix thread." sections={adminPageSections.forum.filter((section) => ['forum-badges', 'forum-prefixes'].includes(section.resource))} />;
}
