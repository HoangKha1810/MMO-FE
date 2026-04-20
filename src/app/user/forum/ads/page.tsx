import { Megaphone } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { buildLegacyAssetUrl } from '@/lib/legacy-settings';
import { listForumAds } from '@/lib/legacy-modules';
import { formatCurrency, toNumber } from '@/lib/utils';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

export default async function ForumAdsPage() {
  const { shell } = await getCurrentUserForShell();
  const ads = await listForumAds();

  return (
    <AppShell user={shell}>
      <div className="space-y-6">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-900">
          <Megaphone className="h-7 w-7 text-orange-500" />
          <h1 className="mt-3 text-3xl font-black uppercase tracking-[-0.04em] text-slate-950 dark:text-white">Quảng cáo forum</h1>
          <p className="mt-2 text-sm text-slate-500">Danh sách ads đọc từ bảng `forum_ads` legacy.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {ads.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm font-bold text-slate-400 dark:border-white/10 md:col-span-2">Chưa có ads.</div> : ads.map((ad) => {
            const image = buildLegacyAssetUrl(String(ad.image_path || ''));
            return (
              <a key={String(ad.id)} href={String(ad.link_url || '#')} target="_blank" rel="noreferrer" className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-900">
                <div className="flex h-44 items-center justify-center bg-slate-100 dark:bg-white/5">
                  {image ? <img src={image} alt="Forum ad" className="h-full w-full object-cover" /> : <Megaphone className="h-12 w-12 text-slate-300" />}
                </div>
                <div className="p-5">
                  <div className="text-xs font-black uppercase text-slate-950 dark:text-white">Ad #{String(ad.id)} · {String(ad.status)}</div>
                  <div className="mt-1 text-sm text-slate-500">{formatCurrency(toNumber(ad.price_vnd))} / {String(ad.duration_days || 0)} ngày</div>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
