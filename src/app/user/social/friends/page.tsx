import Link from 'next/link';
import { UsersRound } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { SocialFriendsBoard } from '@/components/social/social-friends-board';
import { getSocialCounters, listBlockedUsers, listPendingFriendRequests, listSocialFriendsAdvanced } from '@/lib/social';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

export default async function SocialFriendsPage() {
  const { raw, shell } = await getCurrentUserForShell();
  const [friends, pending, blocked, counters] = await Promise.all([
    listSocialFriendsAdvanced(raw.id),
    listPendingFriendRequests(raw.id),
    listBlockedUsers(raw.id),
    getSocialCounters(raw.id),
  ]);

  return (
    <AppShell user={shell}>
      <div className="space-y-6">
        <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-blue">Social graph</div>
              <h1 className="mt-2 text-3xl font-black uppercase tracking-[-0.05em] text-slate-950 dark:text-white">Bạn bè / lời mời / block list</h1>
              <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-slate-500 dark:text-slate-400">
                Kết nối, duyệt lời mời, chặn/mở chặn và tìm người dùng trực tiếp trên bảng friendships, msg_blocks, private_messages thật.
              </p>
            </div>
            <div className="flex gap-2">
              <UsersRound className="h-8 w-8 text-brand-blue" />
              <Link href="/user/social/inbox" className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200">
                Inbox
              </Link>
            </div>
          </div>
        </section>
        <SocialFriendsBoard initialFriends={friends} initialPending={pending} initialBlocked={blocked} initialCounters={counters} />
      </div>
    </AppShell>
  );
}
