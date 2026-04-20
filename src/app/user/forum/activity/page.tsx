import Link from 'next/link';
import { Activity } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { listForumActivity } from '@/lib/legacy-modules';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

export default async function ForumActivityPage() {
  const { shell } = await getCurrentUserForShell();
  const activity = await listForumActivity(80);

  return (
    <AppShell user={shell}>
      <div className="space-y-6">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-900">
          <Activity className="h-7 w-7 text-brand-blue" />
          <h1 className="mt-3 text-3xl font-black uppercase tracking-[-0.04em] text-slate-950 dark:text-white">Hoạt động forum</h1>
        </div>
        <div className="rounded-[2rem] border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
          {activity.length === 0 ? <p className="p-8 text-center text-sm text-slate-400">Chưa có hoạt động.</p> : activity.map((item) => (
            <Link key={`${String(item.type)}-${String(item.id)}`} href={item.thread_id ? `/user/forum/thread/${String(item.thread_id)}` : item.type === 'thread' ? `/user/forum/thread/${String(item.id)}` : '/user/forum/ads'} className="block rounded-xl p-4 transition hover:bg-slate-50 dark:hover:bg-white/5">
              <div className="text-[10px] font-black uppercase tracking-widest text-brand-blue">{String(item.type)}</div>
              <div className="mt-1 font-black text-slate-950 dark:text-white">{String(item.title || `#${item.id}`)}</div>
              <div className="mt-1 text-xs text-slate-400">{String(item.username || item.status || '')} · {new Date(String(item.created_at)).toLocaleString('vi-VN')}</div>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
