import Link from 'next/link';
import { Search } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
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
      <div className="space-y-6">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-900">
          <Search className="h-7 w-7 text-brand-blue" />
          <h1 className="mt-3 text-3xl font-black uppercase tracking-[-0.04em] text-slate-950 dark:text-white">Tìm kiếm forum</h1>
          <form className="mt-5 flex gap-3" action="/user/forum/search">
            <input name="q" defaultValue={keyword} placeholder="Nhập từ khóa..." className="h-12 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none dark:border-white/10 dark:bg-white/5 dark:text-white" />
            <button className="rounded-xl bg-brand-blue px-5 text-xs font-black uppercase text-white">Tìm</button>
          </form>
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-950 dark:text-white">Threads</h2>
            <div className="mt-4 space-y-3">
              {threads.length === 0 ? <p className="text-sm text-slate-400">Không có thread phù hợp.</p> : threads.map((thread) => (
                <Link key={String(thread.id)} href={`/user/forum/thread/${String(thread.id)}`} className="block rounded-xl bg-slate-50 p-4 dark:bg-white/5">
                  <div className="font-black text-slate-950 dark:text-white">{String(thread.title)}</div>
                  <div className="mt-1 text-[10px] font-bold uppercase text-slate-400">{String(thread.forum_name || 'Forum')} · {String(thread.username || '')}</div>
                </Link>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-950 dark:text-white">Posts</h2>
            <div className="mt-4 space-y-3">
              {posts.length === 0 ? <p className="text-sm text-slate-400">Không có post phù hợp.</p> : posts.map((post) => (
                <Link key={String(post.id)} href={`/user/forum/thread/${String(post.thread_id)}#post-${String(post.id)}`} className="block rounded-xl bg-slate-50 p-4 dark:bg-white/5">
                  <div className="font-black text-slate-950 dark:text-white">{String(post.title)}</div>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-500">{String(post.content)}</p>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
