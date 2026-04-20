import Link from 'next/link';
import { ArrowLeft, BriefcaseBusiness } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { LegacyActionForm } from '@/components/legacy/action-form';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

export default async function CreateFindJobPage() {
  const { shell } = await getCurrentUserForShell();

  return (
    <AppShell user={shell}>
      <div className="mx-auto max-w-3xl space-y-6">
        <Link href="/user/find-job" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-orange-500">
          <ArrowLeft className="h-4 w-4" />
          Find Job MMO
        </Link>
        <section className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <BriefcaseBusiness className="h-8 w-8 text-orange-500" />
          <h1 className="mt-4 text-3xl font-black uppercase tracking-[-0.04em] text-slate-950 dark:text-white">Đăng tin tìm người làm MMO</h1>
          <p className="mt-2 text-sm font-semibold leading-7 text-slate-500 dark:text-slate-300">
            Tin mới sẽ vào trạng thái chờ duyệt. Admin duyệt xong mới hiển thị công khai trên Find Job MMO.
          </p>
          <div className="mt-6">
            <LegacyActionForm
              endpoint="/api/find-job/jobs"
              submitLabel="Gửi duyệt tin"
              redirectTo="/user/find-job/my-jobs"
              fields={[
                { name: 'title', label: 'Tiêu đề', required: true, placeholder: 'VD: Cần người chạy TikTok Ads...' },
                { name: 'category', label: 'Danh mục', required: true, placeholder: 'ads / content / dev / design' },
                { name: 'description', label: 'Mô tả chi tiết', type: 'textarea', required: true },
                { name: 'price_min', label: 'Giá tối thiểu', type: 'number' },
                { name: 'price_max', label: 'Giá tối đa', type: 'number' },
                { name: 'deadline_days', label: 'Deadline ngày', type: 'number' },
              ]}
            />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
