import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminResourcesPage() {
  return (
    <AdminDataPage
      title="Quản trị tài nguyên MMO"
      description="Resources, sales và provider MMO/CloneTut."
      sections={adminPageSections.resources}
    />
  );
}
