import Link from 'next/link';
import { Users } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { buildLegacyAssetUrl } from '@/lib/legacy-settings';
import { listForumMembers } from '@/lib/legacy-modules';
import { formatNumber } from '@/lib/utils';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

export default async function ForumMembersPage() {
  const { shell } = await getCurrentUserForShell();
  const members = await listForumMembers(120);

  return (
    <AppShell user={shell}>
      <div className="space-y-6">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-900">
          <Users className="h-7 w-7 text-brand-blue" />
          <h1 className="mt-3 text-3xl font-black uppercase tracking-[-0.04em] text-slate-950 dark:text-white">Thành viên forum</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {members.map((member) => {
            const avatar = buildLegacyAssetUrl(String(member.avatar || ''));
            return (
              <Link key={String(member.id)} href={`/user/forum/profile/${String(member.id)}`} className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 dark:border-white/10 dark:bg-slate-900">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 overflow-hidden rounded-2xl bg-brand-blue text-white">
                    {avatar ? <img src={avatar} alt={String(member.username)} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center font-black">{String(member.username || '?').slice(0, 1).toUpperCase()}</div>}
                  </div>
                  <div>
                    <div className="font-black text-slate-950 dark:text-white">{String(member.username)}</div>
                    <div className="text-[10px] font-bold uppercase text-slate-400">{String(member.rank || member.role || 'member')}</div>
                  </div>
                </div>
                <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs font-bold text-slate-500 dark:bg-white/5">
                  {formatNumber(Number(member.post_count || 0))} bài viết
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
