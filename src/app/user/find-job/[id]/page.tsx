import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BriefcaseBusiness, Clock, UserRound, WalletCards } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { FindJobDetailActions } from '@/components/find-job/find-job-detail-actions';
import { getFindJobDetail } from '@/lib/legacy-modules';
import { formatCurrency, toNumber } from '@/lib/utils';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

export default async function FindJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const jobId = Number(id);
  if (!Number.isFinite(jobId) || jobId <= 0) notFound();

  const { raw, shell } = await getCurrentUserForShell();
  const data = await getFindJobDetail(jobId, raw.id, String(raw.role || 'member'));
  if (!data) notFound();

  const job = data.job;
  const ownerId = Number(job.user_id || job.posted_by || 0);

  return (
    <AppShell user={shell}>
      <div className="space-y-6">
        <Link href="/user/find-job" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-orange-500">
          <ArrowLeft className="h-4 w-4" />
          Find Job MMO
        </Link>

        <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <article className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm dark:border-white/10 dark:bg-slate-900">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-orange-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-orange-500">{String(job.category || 'job')}</span>
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-500">{String(job.status)}</span>
              {job.is_pinned ? <span className="rounded-full bg-orange-500 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">Ghim</span> : null}
            </div>
            <h1 className="mt-5 text-3xl font-black uppercase leading-tight tracking-[-0.05em] text-slate-950 dark:text-white md:text-5xl">{String(job.title)}</h1>
            <p className="mt-5 whitespace-pre-line text-sm font-semibold leading-8 text-slate-600 dark:text-slate-300">{String(job.description || '')}</p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
                <UserRound className="h-4 w-4 text-orange-500" />
                <div className="mt-2 text-sm font-black text-slate-950 dark:text-white">{String(job.username || `User #${ownerId}`)}</div>
                <div className="text-[10px] font-black uppercase text-slate-400">Người đăng</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
                <WalletCards className="h-4 w-4 text-brand-blue" />
                <div className="mt-2 text-sm font-black text-slate-950 dark:text-white">
                  {formatCurrency(toNumber(job.price_min || job.budget_min))} - {formatCurrency(toNumber(job.price_max || job.budget_max))}
                </div>
                <div className="text-[10px] font-black uppercase text-slate-400">Ngân sách</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
                <Clock className="h-4 w-4 text-emerald-500" />
                <div className="mt-2 text-sm font-black text-slate-950 dark:text-white">{String(job.deadline_days || '—')} ngày</div>
                <div className="text-[10px] font-black uppercase text-slate-400">Deadline</div>
              </div>
            </div>
          </article>

          <aside className="space-y-4">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
              <BriefcaseBusiness className="h-8 w-8 text-orange-500" />
              <h2 className="mt-4 text-lg font-black uppercase text-slate-950 dark:text-white">Ứng tuyển</h2>
              <div className="mt-4">
                <FindJobDetailActions jobId={jobId} isOwner={ownerId === raw.id} />
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-900">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-950 dark:text-white">Ứng tuyển gần đây</h2>
              <div className="mt-4 space-y-2">
                {data.applications.length === 0 ? (
                  <p className="text-sm text-slate-400">Chưa có ứng tuyển.</p>
                ) : data.applications.slice(0, 8).map((application) => (
                  <div key={String(application.id)} className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-white/5">
                    <div className="font-black">{String(application.username || `User #${application.applicant_id}`)}</div>
                    <div className="text-[10px] uppercase text-slate-400">{String(application.status)}</div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </AppShell>
  );
}
