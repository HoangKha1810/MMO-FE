import { Megaphone } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { ForumAdsBoard } from '@/components/forum/forum-ads-board';
import { getForumAdStats, listForumAdsFeed, listMyForumAds } from '@/lib/forum-actions';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

export default async function ForumAdsPage() {
  const { raw, shell } = await getCurrentUserForShell();
  const [feed, myAds, stats] = await Promise.all([
    listForumAdsFeed(raw.id),
    listMyForumAds(raw.id),
    getForumAdStats(raw.id),
  ]);

  return (
    <AppShell user={shell}>
      <div className="space-y-6">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-900">
          <Megaphone className="h-7 w-7 text-orange-500" />
          <h1 className="mt-3 text-3xl font-black uppercase tracking-[-0.04em] text-slate-950 dark:text-white">Quảng cáo forum</h1>
          <p className="mt-2 text-sm text-slate-500">Feed ads, upload banner, sửa quảng cáo của tôi và gửi lại duyệt đều đi qua bảng `forum_ads` thật.</p>
        </div>
        <ForumAdsBoard feed={feed} myAds={myAds} stats={stats} />
      </div>
    </AppShell>
  );
}
