import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, FilePenLine } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { LegacyActionForm } from '@/components/legacy/action-form';
import { getFindJobDetail } from '@/lib/legacy-modules';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

export default async function EditFindJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const jobId = Number(id);
  if (!Number.isFinite(jobId) || jobId <= 0) notFound();

  const { raw, shell } = await getCurrentUserForShell();
  const data = await getFindJobDetail(jobId, raw.id, String(raw.role || 'member'));
  if (!data) notFound();

  const job = data.job as Record<string, unknown>;
  const ownerId = Number(job.user_id || job.posted_by || 0);
  if (ownerId !== raw.id) notFound();

  return (
    <AppShell user={shell}>
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href={`/user/find-job/${jobId}`} className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-orange-500">
          <ArrowLeft className="h-4 w-4" />
          Quay lại job
        </Link>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <FilePenLine className="h-8 w-8 text-orange-500" />
          <h1 className="mt-4 text-3xl font-black uppercase tracking-[-0.04em] text-slate-950 dark:text-white">Sửa tin tuyển dụng</h1>
          <div className="mt-6">
            <LegacyActionForm
              endpoint="/api/find-job/jobs"
              submitLabel="Lưu thay đổi"
              defaults={{
                action: 'update',
                job_id: jobId,
                title: String(job.title || ''),
                description: String(job.description || ''),
                category: String(job.category || 'general'),
                price_min: Number(job.price_min || job.budget_min || 0) || '',
                price_max: Number(job.price_max || job.budget_max || 0) || '',
                deadline_days: Number(job.deadline_days || 0) || '',
              }}
              redirectTo={() => `/user/find-job/${jobId}`}
              fields={[
                { name: 'action', label: 'Action', hidden: true, required: true },
                { name: 'job_id', label: 'Job ID', type: 'number', hidden: true, required: true },
                { name: 'title', label: 'Tiêu đề', required: true },
                { name: 'category', label: 'Danh mục', required: true },
                { name: 'description', label: 'Mô tả', type: 'textarea', required: true },
                { name: 'price_min', label: 'Ngân sách thấp nhất', type: 'number' },
                { name: 'price_max', label: 'Ngân sách cao nhất', type: 'number' },
                { name: 'deadline_days', label: 'Deadline (ngày)', type: 'number' },
              ]}
            />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
