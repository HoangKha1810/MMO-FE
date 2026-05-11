import { AdminGameApiPage } from '@/components/admin/admin-game-api-page';
import { getGameApiPublicBaseUrl } from '@/lib/game-api-public-url';

export default function AdminGameApiManagerPage() {
  return <AdminGameApiPage baseUrl={getGameApiPublicBaseUrl()} />;
}
