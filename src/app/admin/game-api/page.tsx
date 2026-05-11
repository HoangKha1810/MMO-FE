import { AdminGameApiPage } from '@/components/admin/admin-game-api-page';
import { buildAbsoluteUrl } from '@/lib/seo';

export default function AdminGameApiManagerPage() {
  return <AdminGameApiPage baseUrl={buildAbsoluteUrl('/api/external/game')} />;
}
