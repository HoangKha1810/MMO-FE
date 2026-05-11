import { AdminGameApiDocsPage } from '@/components/admin/admin-game-api-docs-page';
import { getGameApiPublicBaseUrl } from '@/lib/game-api-public-url';

export default function AdminGameApiDocumentationPage() {
  return <AdminGameApiDocsPage baseUrl={getGameApiPublicBaseUrl()} />;
}
