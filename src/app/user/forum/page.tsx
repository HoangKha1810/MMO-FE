import Link from 'next/link';
import { FolderOpen, PenLine, Zap } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { ForumThreadList } from '@/components/forum/forum-thread-list';
import { getForumOverview } from '@/lib/forum';
import { formatNumber } from '@/lib/utils';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

export default async function UserForumPage() {
  const { shell } = await getCurrentUserForShell();
  const { categories, threads } = await getForumOverview();

  return (
    <AppShell user={shell}>
      <div className="space-y-7">
        <section className="relative overflow-hidden rounded-[1.25rem] border border-slate-200 bg-[#f7f1e6] p-4 shadow-sm dark:border-white/10 dark:bg-[#0c1422] sm:rounded-[1.5rem] sm:p-6">
          <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-brand-blue/15 blur-3xl" />
          <div className="absolute -bottom-24 left-20 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="relative">
            <div>
              <div className="inline-flex rounded-full border border-slate-900/10 bg-white/55 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-slate-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300">
                Forum MMO
              </div>
              <h1 className="mt-4 max-w-3xl break-words text-3xl font-black uppercase leading-[1.18] tracking-[-0.03em] text-slate-950 dark:text-white sm:text-4xl">
                Cộng đồng MMO
              </h1>
              <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-slate-600 dark:text-slate-300">
                Không gian trao đổi kinh nghiệm, hỏi đáp, tuyển cộng tác và cập nhật các chủ đề MMO đang được quan tâm.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                {[
                  ['/user/forum/create-thread', 'Tạo thread'],
                  ['/user/forum/search', 'Tìm kiếm'],
                  ['/user/forum/members', 'Thành viên'],
                  ['/user/forum/my-threads', 'Bài của tôi'],
                  ['/user/forum/posts', 'Bài viết của tôi'],
                  ['/user/forum/notifications', 'Thông báo'],
                  ['/user/forum/activity', 'Hoạt động'],
                  ['/user/forum/ads', 'Quảng cáo'],
                  ['/user/forum/rules', 'Nội quy'],
                ].map(([href, label]) => (
                  <Link key={href} href={href} className="rounded-xl border border-slate-200 bg-white/70 px-4 py-2 text-xs font-black uppercase text-slate-600 transition hover:border-brand-blue/40 hover:text-brand-blue dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-black uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Danh mục forum</h2>
            <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
            <Link
              href="/user/forum/create-thread"
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl bg-gradient-to-r from-brand-blue to-cyan-400 px-5 text-xs font-black uppercase tracking-[0.16em] text-white shadow-[0_16px_38px_rgba(37,99,235,0.28)] transition hover:-translate-y-0.5"
            >
              <PenLine className="h-4 w-4" />
              Đăng bài
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/user/forum/category/${category.id}`}
                className="group rounded-[1.5rem] border border-slate-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-brand-blue/30 hover:shadow-xl hover:shadow-slate-200/60 dark:border-white/10 dark:bg-[#0f1726] dark:hover:shadow-none"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 transition-all group-hover:bg-brand-blue group-hover:text-white dark:bg-white/5">
                    <FolderOpen className="h-5 w-5" />
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase text-slate-500 dark:bg-white/10 dark:text-slate-300">
                    {formatNumber(category.threads_count)} chủ đề
                  </span>
                </div>
                <div className="mt-5 text-sm font-black uppercase tracking-[-0.02em] text-slate-950 dark:text-white">
                  {category.name}
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  {category.description || 'Khu vực thảo luận và cập nhật nội dung cộng đồng.'}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#0f1726]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-[#faf7f1] p-5 dark:border-white/5 dark:bg-white/[0.03]">
            <div>
              <h2 className="text-xl font-black uppercase tracking-[-0.03em] text-slate-950 dark:text-white">Luồng chủ đề</h2>
              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">Bài mới và chủ đề nổi bật được cập nhật liên tục.</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
              <Zap className="h-3.5 w-3.5 text-emerald-500" />
              Đang cập nhật
            </div>
          </div>
          <ForumThreadList threads={threads} emptyText="Chưa có bài viết active." />
        </section>
      </div>
    </AppShell>
  );
}
