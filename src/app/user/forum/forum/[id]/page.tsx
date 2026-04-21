import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, FolderOpen, MessageCircle } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { ForumThreadList } from '@/components/forum/forum-thread-list';
import { getForumFolderDetails } from '@/lib/forum';
import { formatNumber } from '@/lib/utils';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

export default async function ForumFolderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const forumId = Number(id);
  if (!Number.isFinite(forumId) || forumId <= 0) {
    notFound();
  }

  const [{ shell }, data] = await Promise.all([
    getCurrentUserForShell(),
    getForumFolderDetails(forumId),
  ]);

  if (!data) {
    notFound();
  }

  return (
    <AppShell user={shell}>
      <div className="space-y-6">
        <div className="flex flex-wrap gap-3">
          <Link href={`/user/forum/category/${data.forum.category_id}`} className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-brand-blue">
            <ChevronLeft className="h-4 w-4" />
            {data.categoryName || 'Danh mục'}
          </Link>
          <Link href="/user/forum" className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-brand-blue">
            Forum chính
          </Link>
        </div>

        <section className="relative overflow-hidden rounded-[1.7rem] border border-slate-200 bg-[#f7f1e6] p-4 shadow-sm dark:border-white/10 dark:bg-[#0c1422] sm:rounded-[2.25rem] sm:p-7">
          <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-brand-blue/15 blur-3xl" />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex rounded-full border border-slate-900/10 bg-white/55 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-slate-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300">
                Forum folder
              </div>
              <h1 className="mt-4 break-words text-3xl font-black uppercase leading-none tracking-[-0.06em] text-slate-950 dark:text-white sm:text-4xl">
                {data.forum.name}
              </h1>
              <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-slate-600 dark:text-slate-300">
                {data.forum.description || 'Danh sách chủ đề trong folder này.'}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2 md:w-72">
              <div className="rounded-2xl border border-white/70 bg-white/60 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                <FolderOpen className="h-4 w-4 text-brand-blue" />
                <div className="mt-3 text-2xl font-black text-slate-950 dark:text-white">{data.forum.id}</div>
                <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Folder ID</div>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/60 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                <MessageCircle className="h-4 w-4 text-brand-blue" />
                <div className="mt-3 text-2xl font-black text-slate-950 dark:text-white">{formatNumber(data.threads.length)}</div>
                <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Chủ đề</div>
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0f1726]">
          <div className="border-b border-slate-100 bg-[#faf7f1] p-5 dark:border-white/5 dark:bg-white/[0.03]">
            <h2 className="text-xl font-black uppercase tracking-[-0.03em] text-slate-950 dark:text-white">Chủ đề</h2>
            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">Bấm vào từng bài để đọc chi tiết.</p>
          </div>
          <ForumThreadList threads={data.threads} emptyText="Folder này chưa có bài active." />
        </section>
      </div>
    </AppShell>
  );
}
