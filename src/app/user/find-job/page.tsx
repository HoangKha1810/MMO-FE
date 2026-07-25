import { AppShell } from '@/components/layout/app-shell';
import { BlueTickBadge } from '@/components/ui/blue-tick-badge';
import Link from 'next/link';
import { BriefcaseBusiness, ChevronLeft, ChevronRight, Pin, UserRound, WalletCards } from 'lucide-react';
import { countOpenFindJobs, listOpenFindJobs, listUserFindJobs } from '@/lib/find-job';
import { formatCurrency } from '@/lib/utils';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

const FIND_JOB_PAGE_SIZE = 20;

function parsePage(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = Math.trunc(Number(raw || 1));
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function pageHref(page: number) {
  return page <= 1 ? '/user/find-job' : `/user/find-job?page=${page}`;
}

function getPaginationPages(currentPage: number, totalPages: number) {
  const pages = new Set<number>([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  return Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((left, right) => left - right);
}

export default async function UserFindJobPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { raw, shell } = await getCurrentUserForShell();
  const resolvedSearchParams = await searchParams;
  const requestedPage = parsePage(resolvedSearchParams?.page);
  const [totalJobs, myJobs] = await Promise.all([
    countOpenFindJobs(),
    listUserFindJobs(raw.id, 20),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalJobs / FIND_JOB_PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const jobs = await listOpenFindJobs(FIND_JOB_PAGE_SIZE, (currentPage - 1) * FIND_JOB_PAGE_SIZE);
  const pinnedCount = jobs.filter((job) => job.is_pinned).length;
  const paginationPages = getPaginationPages(currentPage, totalPages);

  return (
    <AppShell user={shell}>
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-[1.7rem] border border-slate-200 bg-[#f7f3ea] p-4 shadow-sm dark:border-white/10 dark:bg-[#101520] sm:rounded-[2.25rem] sm:p-7">
          <div className="absolute -right-16 top-8 hidden h-40 w-40 rounded-full border border-slate-900/10 dark:border-white/10 md:block" />
          <div className="absolute -bottom-20 left-12 h-44 w-44 rounded-full bg-orange-400/10 blur-3xl" />
          <div className="relative grid gap-6 lg:grid-cols-[1fr_420px] lg:items-end">
            <div>
              <div className="inline-flex rounded-full border border-orange-500/20 bg-white/60 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-orange-600 dark:bg-white/[0.05] dark:text-orange-300">Find Job MMO</div>
              <h1 className="mt-4 max-w-2xl break-words text-3xl font-black uppercase leading-[1.22] tracking-[-0.04em] text-slate-950 dark:text-white sm:text-4xl sm:leading-[1.18] md:text-5xl md:leading-[1.16]">
                Việc ngon, người thật, ưu tiên bài ghim
              </h1>
              <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-slate-600 dark:text-slate-300">
                Tin được admin ghim sẽ nổi lên đầu danh sách, giúp job quan trọng không bị chìm trong luồng mới.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/user/find-job/create" className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-black uppercase text-white">Đăng tin</Link>
                <Link href="/user/find-job/my-jobs" className="rounded-xl border border-slate-200 bg-white/70 px-4 py-2 text-xs font-black uppercase text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">Tin của tôi</Link>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-3">
              {[
                { label: 'Đã duyệt', value: totalJobs, icon: BriefcaseBusiness },
                { label: 'Đang ghim', value: pinnedCount, icon: Pin },
                { label: 'Tin của bạn', value: myJobs.length, icon: UserRound },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/70 bg-white/60 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
                  <stat.icon className="h-4 w-4 text-orange-500" />
                  <div className="mt-3 text-2xl font-black text-slate-950 dark:text-white">{stat.value}</div>
                  <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <section className="space-y-4">
            {jobs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm font-bold text-slate-400 dark:border-white/10">
                Chưa có việc đã duyệt.
              </div>
            ) : jobs.map((job) => (
              <Link
                key={job.id}
                href={`/user/find-job/${job.id}`}
                className={`surface-card block overflow-hidden rounded-[1.55rem] p-4 transition-all sm:rounded-[1.75rem] sm:p-5 ${
                  job.is_pinned
                    ? 'border-orange-300 shadow-[0_18px_50px_rgba(251,146,60,0.16)] dark:border-orange-400/40'
                    : ''
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {job.is_pinned ? (
                      <span className="rounded-full bg-orange-500 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                        Ghim
                      </span>
                    ) : null}
                    {job.category ? (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase text-slate-500 dark:bg-white/10 dark:text-slate-300">{job.category}</span>
                    ) : null}
                    <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase text-emerald-500">{job.status}</span>
                  </div>
                </div>
                <h2 className="mt-4 text-lg font-black uppercase tracking-[-0.03em] text-slate-900 dark:text-white sm:text-xl">
                  {job.title}
                </h2>
                <p className="mt-3 line-clamp-3 text-sm leading-7 text-slate-500 dark:text-slate-400">{job.description}</p>
                <div className="mt-5 grid gap-2 border-t border-slate-100 pt-4 text-xs font-bold text-slate-400 dark:border-white/5 sm:grid-cols-2">
                  <span className="inline-flex min-w-0 items-center gap-2 rounded-xl bg-slate-50/80 px-3 py-2 dark:bg-white/[0.04]">
                    <UserRound className="h-4 w-4 shrink-0" />
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <span className="truncate">Đăng bởi {job.user_username || `User #${job.user_id}`}</span>
                      <BlueTickBadge active={job.user_is_blue_tick} expiry={job.user_blue_tick_expiry} className="h-4 w-4" />
                    </span>
                  </span>
                  <span className="inline-flex min-w-0 items-center gap-2 rounded-xl bg-slate-50/80 px-3 py-2 dark:bg-white/[0.04]">
                    <WalletCards className="h-4 w-4" />
                    <span className="truncate">
                      Budget {job.budget_min ? formatCurrency(job.budget_min) : '—'} - {job.budget_max ? formatCurrency(job.budget_max) : '—'}
                    </span>
                  </span>
                  {typeof job.application_count === 'number' ? (
                    <span className="inline-flex items-center rounded-xl bg-slate-50/80 px-3 py-2 dark:bg-white/[0.04]">
                      {job.application_count} ứng tuyển
                    </span>
                  ) : null}
                </div>
              </Link>
            ))}

            {totalPages > 1 ? (
              <nav className="flex flex-col gap-3 rounded-[1.25rem] border border-slate-200 bg-white/70 p-3 shadow-sm dark:border-white/10 dark:bg-white/[0.04] sm:flex-row sm:items-center sm:justify-between" aria-label="Phân trang Find Job">
                <Link
                  href={pageHref(Math.max(1, currentPage - 1))}
                  aria-disabled={currentPage <= 1}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest transition ${
                    currentPage <= 1
                      ? 'pointer-events-none border border-slate-200 bg-slate-100 text-slate-400 dark:border-white/10 dark:bg-white/[0.04]'
                      : 'border border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100 dark:border-orange-400/20 dark:bg-orange-500/10 dark:text-orange-200'
                  }`}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Trang trước
                </Link>

                <div className="flex flex-wrap items-center justify-center gap-2">
                  {paginationPages.map((page, index) => {
                    const previous = paginationPages[index - 1];
                    const showGap = previous && page - previous > 1;
                    return (
                      <span key={page} className="inline-flex items-center gap-2">
                        {showGap ? <span className="px-1 text-xs font-black text-slate-400">...</span> : null}
                        <Link
                          href={pageHref(page)}
                          aria-current={page === currentPage ? 'page' : undefined}
                          className={`grid h-11 min-w-11 place-items-center rounded-xl px-3 text-sm font-black transition ${
                            page === currentPage
                              ? 'bg-orange-500 text-white shadow-[0_12px_30px_-18px_rgba(249,115,22,0.9)]'
                              : 'border border-slate-200 bg-white/80 text-slate-600 hover:border-orange-300 hover:text-orange-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:text-orange-200'
                          }`}
                        >
                          {page}
                        </Link>
                      </span>
                    );
                  })}
                </div>

                <Link
                  href={pageHref(Math.min(totalPages, currentPage + 1))}
                  aria-disabled={currentPage >= totalPages}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-widest transition ${
                    currentPage >= totalPages
                      ? 'pointer-events-none border border-slate-200 bg-slate-100 text-slate-400 dark:border-white/10 dark:bg-white/[0.04]'
                      : 'border border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100 dark:border-orange-400/20 dark:bg-orange-500/10 dark:text-orange-200'
                  }`}
                >
                  Trang sau
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </nav>
            ) : null}
          </section>

          <aside className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">Tin của bạn</h2>
            <div className="mt-4 space-y-3">
              {myJobs.length === 0 ? (
                <p className="text-sm text-slate-400">Bạn chưa đăng tin nào.</p>
              ) : myJobs.map((job) => (
                <div key={job.id} className="rounded-xl bg-slate-50 p-3 dark:bg-white/5">
                  <div className="text-xs font-black text-slate-900 dark:text-white">{job.title}</div>
                  <div className="mt-1 text-[10px] font-bold uppercase text-slate-400">
                    {job.status}{job.is_pinned ? ' · Đang ghim' : ''}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
