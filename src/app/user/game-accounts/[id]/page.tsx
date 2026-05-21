import { ResourceDetailPage } from '@/components/resources/resource-detail-page';

export const dynamic = 'force-dynamic';

export default async function UserGameAccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ResourceDetailPage id={id} collection="game-accounts" />;
}
