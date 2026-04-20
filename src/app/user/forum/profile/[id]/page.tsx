import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MessageCircle, UserRound } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { buildLegacyAssetUrl } from '@/lib/legacy-settings';
import { getForumProfile } from '@/lib/legacy-modules';
import { formatNumber } from '@/lib/utils';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

export default async function ForumProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = Number(id);
  if (!Number.isFinite(userId) || userId <= 0) notFound();

  const { shell } = await getCurrentUserForShell();
  const data = await getForumProfile(userId);
  if (!data) notFound();

  const avatar = buildLegacyAssetUrl(String(data.profile.avatar || ''));

  return (
    <AppShell user={shell}>
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
          <div className="h-40 bg-gradient-to-br from-brand-blue/25 via-sky-500/15 to-emerald-400/15" />
          <div className="-mt-12 p-6">
            <div className="h-24 w-24 overflow-hidden rounded-[1.5rem] border-4 border-white bg-brand-blue text-white dark:border-slate-900">
              {avatar ? <img src={avatar} alt={String(data.profile.username)} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-3xl font-black">{String(data.profile.username).slice(0, 1).toUpperCase()}</div>}
            </div>
            <h1 className="mt-4 text-3xl font-black uppercase tracking-[-0.04em] text-slate-950 dark:text-white">{String(data.profile.username)}</h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-slate-500">{String(data.profile.bio || 'Chưa có tiểu sử forum.')}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-black uppercase">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-500 dark:bg-white/10">{String(data.profile.rank || data.profile.role || 'member')}</span>
              <span className="rounded-full bg-brand-blue/10 px-3 py-1 text-brand-blue">{formatNumber(Number(data.profile.post_count || 0))} bài viết</span>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
            <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-950 dark:text-white"><MessageCircle className="h-4 w-4" /> Threads</h2>
            <div className="mt-4 space-y-3">
              {data.threads.length === 0 ? <p className="text-sm text-slate-400">Chưa có thread.</p> : data.threads.map((thread) => (
                <Link key={String(thread.id)} href={`/user/forum/thread/${String(thread.id)}`} className="block rounded-xl bg-slate-50 p-4 dark:bg-white/5">
                  <div className="font-black text-slate-950 dark:text-white">{String(thread.title)}</div>
                </Link>
              ))}
            </div>
          </section>
          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
            <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-950 dark:text-white"><UserRound className="h-4 w-4" /> Post gần đây</h2>
            <div className="mt-4 space-y-3">
              {data.posts.length === 0 ? <p className="text-sm text-slate-400">Chưa có post.</p> : data.posts.map((post) => (
                <Link key={String(post.id)} href={`/user/forum/thread/${String(post.thread_id)}#post-${String(post.id)}`} className="block rounded-xl bg-slate-50 p-4 dark:bg-white/5">
                  <div className="font-black text-slate-950 dark:text-white">{String(post.title || 'Thread')}</div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
