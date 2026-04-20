import { BellRing } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { formatDatabaseDateTime } from '@/lib/date-time';
import { listForumNotifications, markForumNotificationsRead } from '@/lib/forum-actions';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

export default async function ForumNotificationsPage() {
  const { raw, shell } = await getCurrentUserForShell();
  const notifications = (await listForumNotifications(raw.id)) as Array<Record<string, unknown>>;
  await markForumNotificationsRead(raw.id);

  return (
    <AppShell user={shell}>
      <div className="space-y-6">
        <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
          <BellRing className="h-7 w-7 text-brand-blue" />
          <h1 className="mt-3 text-3xl font-black uppercase tracking-[-0.04em] text-slate-950 dark:text-white">Thông báo forum</h1>
          <p className="mt-2 text-sm font-semibold leading-7 text-slate-500 dark:text-slate-400">
            Reply, tin nhắn riêng và các hoạt động quan trọng đều nằm ở trung tâm thông báo của bạn.
          </p>
        </section>

        <div className="space-y-3">
          {notifications.length === 0 ? (
            <div className="rounded-[1.6rem] border border-dashed border-slate-300 p-10 text-center text-sm font-bold text-slate-400 dark:border-white/10">
              Bạn chưa có thông báo nào.
            </div>
          ) : notifications.map((notification) => (
            <a key={String(notification.id)} href={String(notification.link || '/user/forum')} className="block rounded-[1.6rem] border border-slate-200 bg-white/90 p-5 shadow-[0_22px_60px_-46px_rgba(15,23,42,0.35)] transition hover:border-brand-blue/30 dark:border-white/10 dark:bg-white/[0.04]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-black uppercase tracking-[-0.03em] text-slate-950 dark:text-white">
                    {String(notification.message || 'Thông báo hệ thống')}
                  </div>
                  <div className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    {String(notification.type || 'notification')} · từ {String(notification.from_username || `user #${notification.from_user_id}`)}
                  </div>
                </div>
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  {formatDatabaseDateTime(notification.created_at)}
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
