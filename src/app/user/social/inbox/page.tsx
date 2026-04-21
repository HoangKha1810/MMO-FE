import Link from 'next/link';
import { MessageCircle, ShieldAlert, UsersRound } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { SocialInboxBoard } from '@/components/social/social-inbox-board';
import { getAdminMessages, getMiniInbox, listBlockedUsers, listSocialFriendsAdvanced, markAdminMessagesShown } from '@/lib/social';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

export default async function SocialInboxPage() {
  const { raw, shell } = await getCurrentUserForShell();
  const [messages, friends, blocked, adminMessages] = await Promise.all([
    getMiniInbox(raw.id),
    listSocialFriendsAdvanced(raw.id),
    listBlockedUsers(raw.id),
    getAdminMessages(raw.id),
  ]);
  if (adminMessages.length > 0) {
    await markAdminMessagesShown(raw.id);
  }

  return (
    <AppShell user={shell}>
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-[1.7rem] border border-slate-200 bg-[#f7f3ea] p-4 dark:border-white/10 dark:bg-[#101520] sm:rounded-[2.25rem] sm:p-7">
          <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-brand-blue/10 blur-3xl" />
          <div className="relative grid gap-5 lg:grid-cols-[1fr_360px]">
            <div>
              <div className="inline-flex rounded-full bg-brand-blue/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-brand-blue">Social messenger</div>
              <h1 className="mt-4 break-words text-3xl font-black uppercase tracking-[-0.06em] text-slate-950 dark:text-white sm:text-4xl md:text-5xl">Hộp thư social, gọn và realtime</h1>
              <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-slate-600 dark:text-slate-300">
                Tin nhắn, bạn bè, số chưa đọc, thông báo admin và danh sách chặn được gom vào một màn hình dễ xử lý.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/user/social/friends" className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-black uppercase text-white dark:bg-white dark:text-slate-950">Bạn bè</Link>
                <Link href="/user/forum/members" className="rounded-xl border border-slate-200 bg-white/70 px-4 py-2 text-xs font-black uppercase text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">Tìm thành viên</Link>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-3">
              {[
                { label: 'Tin nhắn', value: messages.length, icon: MessageCircle },
                { label: 'Bạn bè', value: friends.length, icon: UsersRound },
                { label: 'Đã chặn', value: blocked.length, icon: ShieldAlert },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/70 bg-white/60 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                  <stat.icon className="h-4 w-4 text-brand-blue" />
                  <div className="mt-3 text-2xl font-black text-slate-950 dark:text-white">{stat.value}</div>
                  <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-500">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <SocialInboxBoard initialMessages={messages} initialFriends={friends} initialBlocked={blocked} initialAdminMessages={adminMessages} />
      </div>
    </AppShell>
  );
}
