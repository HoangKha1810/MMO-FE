import { AdminGameApiDocsPage } from '@/components/admin/admin-game-api-docs-page';
import { buildAbsoluteUrl } from '@/lib/seo';

export default function AdminGameApiDocumentationPage() {
  return <AdminGameApiDocsPage baseUrl={buildAbsoluteUrl('/api/external/game')} />;
}
