'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { Copy, Globe2, Search, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHero, SectionHeader, SectionPanel } from '@/components/ui/page-layout';

interface LookupResult {
  id?: string;
  uid?: string;
  platform?: string;
  message?: string;
}

export default function GetUidFbPage() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const resolvedId = result?.uid || result?.id || '';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setResult(null);
    const response = await fetch('/api/social/get-id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const payload = await response.json().catch(() => ({}));
    setLoading(false);
    setResult(payload);
  }

  async function copyResult() {
    if (!resolvedId) return;
    await navigator.clipboard.writeText(resolvedId);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.14),transparent_34%),linear-gradient(180deg,#f8fbff,#eef4ff_48%,#ffffff)] px-5 py-8 dark:bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.18),transparent_34%),linear-gradient(180deg,#050913,#0b1222_52%,#050913)]">
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHero
          eyebrow="Social Utility"
          title="GET UID FB / Social ID"
          description="Tách UID Facebook hoặc username TikTok, Instagram, X từ link. Route này gọi API thật `/api/social/get-id`, không dùng dữ liệu mẫu."
          stats={[
            { label: 'Facebook', value: 'UID', hint: 'profile, post, story, group', tone: 'blue' },
            { label: 'TikTok', value: '@user', hint: 'Link profile', tone: 'emerald' },
            { label: 'Instagram', value: 'user', hint: 'Profile URL', tone: 'violet' },
            { label: 'X/Twitter', value: 'user', hint: 'Profile URL', tone: 'amber' },
          ]}
          actions={<Link href="/user/home" className="surface-chip rounded-full px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-600 dark:text-slate-200">Về workspace</Link>}
        />

        <SectionPanel className="space-y-5">
          <SectionHeader eyebrow="Lookup" title="Nhập link cần lấy ID" description="Dán link đầy đủ để hệ thống bóc ID theo đúng rule API đang chạy." />
          <form onSubmit={submit} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
            <Input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://www.facebook.com/profile.php?id=..."
              className="h-14"
              required
            />
            <Button type="submit" className="h-14" loading={loading} loadingText="Đang dò...">
              <Search className="mr-2 h-4 w-4" />
              Lấy ID
            </Button>
          </form>
        </SectionPanel>

        <SectionPanel className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="surface-card rounded-[1.7rem] p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
                <Globe2 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400">Kết quả</div>
                <div className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-400">{result?.platform || 'Chưa kiểm tra'}</div>
              </div>
            </div>
            <div className="mt-6 rounded-[1.4rem] border border-slate-200 bg-slate-50 px-5 py-5 font-mono text-3xl font-black tracking-[0.08em] text-slate-950 dark:border-white/10 dark:bg-white/[0.04] dark:text-white">
              {resolvedId || '---'}
            </div>
            {result?.message && !resolvedId ? <p className="mt-3 text-sm font-bold text-rose-500">{result.message}</p> : null}
            <Button type="button" className="mt-5" onClick={copyResult} disabled={!resolvedId}>
              <Copy className="mr-2 h-4 w-4" />
              Copy ID
            </Button>
          </div>

          <div className="surface-card rounded-[1.7rem] p-6">
            <Sparkles className="h-5 w-5 text-brand-blue" />
            <h2 className="mt-4 text-lg font-black uppercase text-slate-950 dark:text-white">Gợi ý</h2>
            <p className="mt-3 text-sm font-medium leading-8 text-slate-500 dark:text-slate-400">
              Nếu link rút gọn không ra UID, hãy mở link bằng trình duyệt rồi dán URL cuối cùng sau redirect. Một số link private/ẩn có thể không chứa ID trong URL.
            </p>
          </div>
        </SectionPanel>
      </div>
    </main>
  );
}
