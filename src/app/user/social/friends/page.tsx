import Link from 'next/link';
import { UserPlus, UsersRound } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { LegacyActionForm } from '@/components/legacy/action-form';
import { listSocialFriends } from '@/lib/legacy-modules';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

export default async function SocialFriendsPage() {
  const { raw, shell } = await getCurrentUserForShell();
  const friends = await listSocialFriends(raw.id);

  return (
    <AppShell user={shell}>
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-900">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-blue">Social graph</div>
              <h1 className="mt-2 text-3xl font-black uppercase tracking-[-0.05em] text-slate-950 dark:text-white">Bạn bè / lời mời</h1>
            </div>
            <UsersRound className="h-8 w-8 text-brand-blue" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {friends.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm font-bold text-slate-400 dark:border-white/10 md:col-span-2">Chưa có kết nối.</div>
            ) : friends.map((friend) => (
              <Link key={String(friend.id)} href={`/user/social/conversation/${friend.friend_id}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-brand-blue/40 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="text-sm font-black uppercase text-slate-950 dark:text-white">{String(friend.username || `User #${friend.friend_id}`)}</div>
                <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">{String(friend.status || 'pending')}</div>
                <div className="mt-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Rank: {String(friend.rank || 'Member')}</div>
              </Link>
            ))}
          </div>
        </section>

        <aside className="rounded-[2rem] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-2 text-sm font-black uppercase text-slate-950 dark:text-white">
            <UserPlus className="h-4 w-4 text-brand-blue" />
            Thêm bạn
          </div>
          <LegacyActionForm
            endpoint="/api/social/friend"
            submitLabel="Gửi lời mời"
            fields={[
              { name: 'target_user_id', label: 'ID user', type: 'number', required: true },
            ]}
          />
        </aside>
      </div>
    </AppShell>
  );
}
