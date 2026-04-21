import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, FolderOpen, MessageCircle, MessageSquare } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { ForumThreadList } from '@/components/forum/forum-thread-list';
import { getForumCategoryDetails } from '@/lib/forum';
import { formatNumber } from '@/lib/utils';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

export default async function ForumCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const categoryId = Number(id);
  if (!Number.isFinite(categoryId) || categoryId <= 0) {
    notFound();
  }

  const [{ shell }, data] = await Promise.all([
    getCurrentUserForShell(),
    getForumCategoryDetails(categoryId),
  ]);

  if (!data) {
    notFound();
  }

  const totalThreads = data.folders.reduce((sum, folder) => sum + folder.threads_count, 0);
  const totalPosts = data.folders.reduce((sum, folder) => sum + folder.posts_count, 0);

  return (
    <AppShell user={shell}>
      <div className="space-y-6">
        <Link href="/user/forum" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-brand-blue">
          <ChevronLeft className="h-4 w-4" />
          Quay lại forum
        </Link>

        <section className="relative overflow-hidden rounded-[1.7rem] border border-slate-200 bg-[#f7f1e6] p-4 shadow-sm dark:border-white/10 dark:bg-[#0c1422] sm:rounded-[2.25rem] sm:p-7">
          <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-brand-blue/15 blur-3xl" />
          <div className="relative grid gap-6 lg:grid-cols-[1fr_360px] lg:items-end">
            <div>
              <div className="inline-flex rounded-full border border-slate-900/10 bg-white/55 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-slate-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300">
                Folder forum
              </div>
              <h1 className="mt-4 break-words text-3xl font-black uppercase leading-none tracking-[-0.06em] text-slate-950 dark:text-white sm:text-4xl">
                {data.category.name}
              </h1>
              <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-slate-600 dark:text-slate-300">
                {data.category.description || 'Khu vực thảo luận và cập nhật nội dung cộng đồng.'}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2">
              <div className="rounded-2xl border border-white/70 bg-white/60 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                <MessageCircle className="h-4 w-4 text-brand-blue" />
                <div className="mt-3 text-2xl font-black text-slate-950 dark:text-white">{formatNumber(totalThreads)}</div>
                <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Chủ đề</div>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/60 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                <MessageSquare className="h-4 w-4 text-brand-blue" />
                <div className="mt-3 text-2xl font-black text-slate-950 dark:text-white">{formatNumber(totalPosts)}</div>
                <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Bài viết</div>
              </div>
            </div>
          </div>
        </section>

        {data.folders.length > 0 ? (
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-black uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Folder con</h2>
              <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.folders.map((folder) => (
                <Link
                  key={folder.id}
                  href={`/user/forum/forum/${folder.id}`}
                  className="group rounded-[1.5rem] border border-slate-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-brand-blue/30 hover:shadow-xl hover:shadow-slate-200/60 dark:border-white/10 dark:bg-[#0f1726] dark:hover:shadow-none"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 transition-all group-hover:bg-brand-blue group-hover:text-white dark:bg-white/5">
                      <FolderOpen className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase text-slate-500 dark:bg-white/10 dark:text-slate-300">
                      {formatNumber(folder.threads_count)} chủ đề
                    </span>
                  </div>
                  <div className="mt-5 text-sm font-black uppercase tracking-[-0.02em] text-slate-950 dark:text-white">
                    {folder.name}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    {folder.description || 'Khu vực thảo luận trong danh mục này.'}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0f1726]">
          <div className="border-b border-slate-100 bg-[#faf7f1] p-5 dark:border-white/5 dark:bg-white/[0.03]">
            <h2 className="text-xl font-black uppercase tracking-[-0.03em] text-slate-950 dark:text-white">Bài viết trong folder</h2>
            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">Bấm vào từng bài để đọc chi tiết.</p>
          </div>
          <ForumThreadList threads={data.threads} emptyText="Folder này chưa có bài active." />
        </section>
      </div>
    </AppShell>
  );
}
