import { AppShell } from '@/components/layout/app-shell';
import { ForumSearchBoard } from '@/components/forum/forum-search-board';
import { searchForum } from '@/lib/legacy-modules';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

export default async function ForumSearchPage({ searchParams }: { searchParams: Promise<{ q?: string; search?: string }> }) {
  const params = await searchParams;
  const keyword = String(params.q || params.search || '').trim();
  const { shell } = await getCurrentUserForShell();
  const result = await searchForum(keyword);
  const threads = result.threads as Array<Record<string, unknown>>;
  const posts = result.posts as Array<Record<string, unknown>>;

  return (
    <AppShell user={shell}>
      <ForumSearchBoard initialKeyword={keyword} initialThreads={threads} initialPosts={posts} />
    </AppShell>
  );
}
