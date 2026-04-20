import Link from 'next/link';
import { ArrowLeft, FilePenLine, Plus } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { listUserFindJobs } from '@/lib/find-job';
import { formatCurrency } from '@/lib/utils';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

export default async function MyFindJobsPage() {
  const { raw, shell } = await getCurrentUserForShell();
  const jobs = await listUserFindJobs(raw.id, 100);

  return (
    <AppShell user={shell}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/user/find-job" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-orange-500">
            <ArrowLeft className="h-4 w-4" />
            Find Job
          </Link>
          <Link href="/user/find-job/create" className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-xs font-black uppercase text-white">
            <Plus className="h-4 w-4" />
            Đăng tin
          </Link>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <h1 className="text-3xl font-black uppercase tracking-[-0.04em] text-slate-950 dark:text-white">Tin tuyển dụng của bạn</h1>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {jobs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm font-bold text-slate-400 dark:border-white/10 md:col-span-2">
              Bạn chưa đăng tin nào.
            </div>
          ) : jobs.map((job) => (
            <div key={job.id} className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-orange-400 dark:border-white/10 dark:bg-slate-900">
              <Link href={`/user/find-job/${job.id}`} className="block">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase text-slate-500 dark:bg-white/10">{job.status}</span>
                  {job.is_pinned ? <span className="text-[10px] font-black uppercase text-orange-500">Đang ghim</span> : null}
                </div>
                <h2 className="mt-4 text-lg font-black uppercase text-slate-950 dark:text-white">{job.title}</h2>
                <div className="mt-3 text-xs font-bold text-slate-400">
                  {job.budget_min ? formatCurrency(job.budget_min) : '—'} - {job.budget_max ? formatCurrency(job.budget_max) : '—'}
                </div>
              </Link>
              <div className="mt-4 flex gap-2">
                <Link href={`/user/find-job/edit/${job.id}`} className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-black uppercase text-orange-600 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-200">
                  <FilePenLine className="h-4 w-4" />
                  Sửa bài
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
