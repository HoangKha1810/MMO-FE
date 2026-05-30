'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Megaphone, PencilLine, Sparkles, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { readJsonResponse } from '@/lib/client-api';
import { formatCurrency, toNumber } from '@/lib/utils';

type ForumAd = Record<string, unknown>;

interface ForumAdsBoardProps {
  feed: ForumAd[];
  myAds: ForumAd[];
  stats: {
    myAds: number;
    approvedAds: number;
    pendingAds: number;
  };
}

export function ForumAdsBoard({ feed, myAds, stats }: ForumAdsBoardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [durationDays, setDurationDays] = useState('30');
  const [linkUrl, setLinkUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);

  function resetForm() {
    setEditingId(null);
    setDurationDays('30');
    setLinkUrl('');
    setImageFile(null);
  }

  function fillForm(ad: ForumAd) {
    setEditingId(Number(ad.id));
    setDurationDays(String(ad.duration_days || 30));
    setLinkUrl(String(ad.link_url || ''));
  }

  function submit() {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append('action', editingId ? 'update' : 'create');
        if (editingId) {
          formData.append('ad_id', String(editingId));
        }
        formData.append('duration_days', durationDays);
        formData.append('link_url', linkUrl);
        if (imageFile) {
          formData.append('image', imageFile);
        }

        const response = await fetch('/api/forum/ad', {
          method: 'POST',
          body: formData,
        });
        const payload = await readJsonResponse(response, 'Không xử lý được quảng cáo');
        if (!payload.success) {
          throw new Error(payload.message || 'Không xử lý được quảng cáo');
        }
        toast.success(payload.message || 'Đã lưu quảng cáo');
        resetForm();
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Không xử lý được quảng cáo');
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2 md:grid-cols-3">
        {[
          { label: 'Ads của tôi', value: stats.myAds },
          { label: 'Đang duyệt / chờ upload', value: stats.pendingAds },
          { label: 'Đã duyệt', value: stats.approvedAds },
        ].map((item) => (
          <div key={item.label} className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-5 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-white/[0.04]">
            <Sparkles className="h-5 w-5 text-orange-500" />
            <div className="mt-3 text-3xl font-black tracking-[-0.05em] text-slate-950 dark:text-white">{item.value}</div>
            <div className="mt-1 text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">{item.label}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,420px)_1fr]">
        <div className="rounded-[2rem] border border-slate-200 bg-white/90 p-5 shadow-[0_30px_80px_-55px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500 text-white">
              {editingId ? <PencilLine className="h-5 w-5" /> : <Megaphone className="h-5 w-5" />}
            </div>
            <div>
              <div className="text-sm font-black uppercase tracking-[0.16em] text-slate-950 dark:text-white">
                {editingId ? `Sửa quảng cáo #${editingId}` : 'Tạo quảng cáo forum'}
              </div>
              <div className="mt-1 text-xs font-semibold leading-6 text-slate-500 dark:text-slate-400">
                Upload banner, nhập link đích và gửi lại cho admin duyệt.
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Link đích</label>
              <input
                value={linkUrl}
                onChange={(event) => setLinkUrl(event.target.value)}
                placeholder="https://..."
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-brand-blue/40 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Số ngày chạy</label>
              <input
                value={durationDays}
                onChange={(event) => setDurationDays(event.target.value)}
                type="number"
                min={1}
                max={365}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none transition focus:border-brand-blue/40 dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
              />
              <div className="mt-2 text-xs font-semibold leading-6 text-slate-500 dark:text-slate-400">
                Báo giá tự tính theo {formatCurrency(130000)} / ngày.
              </div>
            </div>
            <div>
              <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Banner quảng cáo</label>
              <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm font-bold text-slate-500 transition hover:border-brand-blue/35 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-300">
                <Upload className="h-4 w-4" />
                {imageFile ? imageFile.name : 'Chọn ảnh banner'}
                <input type="file" accept="image/*" className="hidden" onChange={(event) => setImageFile(event.target.files?.[0] || null)} />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={resetForm}>
                Reset
              </Button>
              <Button type="button" loading={isPending} onClick={submit}>
                {editingId ? 'Cập nhật quảng cáo' : 'Tạo quảng cáo'}
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <div className="mb-3 text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Ads của tôi</div>
            <div className="grid gap-4 md:grid-cols-2">
              {myAds.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-slate-300 p-6 text-sm font-bold text-slate-400 dark:border-white/10 md:col-span-2">
                  Bạn chưa gửi quảng cáo nào.
                </div>
              ) : myAds.map((ad) => (
                <div key={`my-ad-${String(ad.id)}`} className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white/90 shadow-[0_22px_60px_-45px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-white/[0.04]">
                  <div className="flex h-40 items-center justify-center bg-slate-100 dark:bg-slate-950/40">
                    {String(ad.image_path || '') ? <img src={String(ad.image_path)} alt={`Ad ${String(ad.id)}`} className="h-full w-full object-cover" /> : <Megaphone className="h-10 w-10 text-slate-300" />}
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-black uppercase tracking-[-0.03em] text-slate-950 dark:text-white">Ad #{String(ad.id)}</div>
                      <div className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:bg-white/10 dark:text-slate-300">
                        {String(ad.status || 'pending')}
                      </div>
                    </div>
                    <div className="mt-2 text-sm font-semibold leading-7 text-slate-500 dark:text-slate-400">
                      {formatCurrency(toNumber(ad.price_vnd))} · {String(ad.duration_days || 0)} ngày
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => fillForm(ad)}>
                        Sửa / gửi lại
                      </Button>
                      {String(ad.link_url || '') ? (
                        <Button type="button" size="sm" asChild>
                          <a href={String(ad.link_url)} target="_blank" rel="noreferrer">Mở link</a>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-3 text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Feed quảng cáo</div>
            <div className="grid gap-4 md:grid-cols-2">
              {feed.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-slate-300 p-6 text-sm font-bold text-slate-400 dark:border-white/10 md:col-span-2">
                  Chưa có quảng cáo nào hiển thị.
                </div>
              ) : feed.map((ad) => (
                <a key={`feed-ad-${String(ad.id)}`} href={String(ad.link_url || '#')} target="_blank" rel="noreferrer" className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white/90 shadow-[0_22px_60px_-45px_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5 hover:border-brand-blue/30 dark:border-white/10 dark:bg-white/[0.04]">
                  <div className="flex h-40 items-center justify-center bg-slate-100 dark:bg-slate-950/40">
                    {String(ad.image_path || '') ? <img src={String(ad.image_path)} alt={`Ad ${String(ad.id)}`} className="h-full w-full object-cover" /> : <Megaphone className="h-10 w-10 text-slate-300" />}
                  </div>
                  <div className="p-4">
                    <div className="text-sm font-black uppercase tracking-[-0.03em] text-slate-950 dark:text-white">
                      {String(ad.username || `Advertiser #${ad.user_id}`)}
                    </div>
                    <div className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{String(ad.status || 'pending')}</div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
