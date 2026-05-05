import { ResourceCollectionPage } from '@/components/resources/resource-collection-page';

export const dynamic = 'force-dynamic';

export default async function GameAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; category?: string }>;
}) {
  const params = await searchParams;

  return (
    <ResourceCollectionPage
      collection="game-accounts"
      search={params.search || ''}
      category={params.category || ''}
    />
  );
}
