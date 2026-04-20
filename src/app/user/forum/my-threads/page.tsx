import Link from 'next/link';
import { MessageSquareText, Plus } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { listMyForumThreads } from '@/lib/legacy-modules';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

export default async function MyForumThreadsPage() {
  const { raw, shell } = await getCurrentUserForShell();
  const threads = await listMyForumThreads(raw.id);

  return (
    <AppShell user={shell}>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <MessageSquareText className="h-7 w-7 text-brand-blue" />
            <h1 className="mt-3 text-3xl font-black uppercase tracking-[-0.04em] text-slate-950 dark:text-white">Thread của tôi</h1>
          </div>
          <Link href="/user/forum/create-thread" className="inline-flex items-center gap-2 rounded-xl bg-brand-blue px-4 py-2 text-xs font-black uppercase text-white">
            <Plus className="h-4 w-4" />
            Tạo thread
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {threads.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm font-bold text-slate-400 dark:border-white/10 md:col-span-2">Bạn chưa có thread.</div>
          ) : threads.map((thread) => (
            <Link key={String(thread.id)} href={`/user/forum/thread/${String(thread.id)}`} className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-brand-blue dark:border-white/10 dark:bg-slate-900">
              <div className="text-[10px] font-black uppercase text-slate-400">{String(thread.forum_name || 'Forum')} · {String(thread.status)}</div>
              <div className="mt-2 font-black text-slate-950 dark:text-white">{String(thread.title)}</div>
              <div className="mt-3 text-xs text-slate-400">{String(thread.views || 0)} views {thread.is_pinned ? '· ghim' : ''}</div>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
