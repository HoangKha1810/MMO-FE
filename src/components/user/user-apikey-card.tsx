'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, Copy, KeyRound, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface UserApikeyCardProps {
  className?: string;
  docsHref?: string;
  showDocsButton?: boolean;
  title?: string;
  description?: string;
}

interface UserApikeyPayload {
  success: boolean;
  apikey?: string;
  status?: string;
  last_used_at?: string | null;
  message?: string;
}

export function UserApikeyCard({
  className,
  docsHref = '/user/automxh-api',
  showDocsButton = true,
  title = 'apikey',
  description = 'Key riêng của tài khoản này, dùng để gọi Game API, SMM API và AutoMXH API.',
}: UserApikeyCardProps) {
  const [payload, setPayload] = useState<UserApikeyPayload | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadApikey() {
    setLoading(true);

    try {
      const response = await fetch('/api/user/apikey', {
        cache: 'no-store',
        credentials: 'include',
        headers: { 'Cache-Control': 'no-store' },
      });
      const nextPayload = await response.json() as UserApikeyPayload;

      if (!response.ok || !nextPayload.success) {
        throw new Error(nextPayload.message || 'Không thể tải apikey');
      }

      setPayload(nextPayload);
    } catch (error) {
      setPayload({
        success: false,
        message: error instanceof Error ? error.message : 'Không thể tải apikey',
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadApikey();
  }, []);

  async function copyApikey() {
    const apikey = String(payload?.apikey || '').trim();
    if (!apikey) {
      toast.error('Chưa có apikey để copy');
      return;
    }

    try {
      await navigator.clipboard.writeText(apikey);
      toast.success('Đã copy apikey');
    } catch {
      toast.error('Không thể copy apikey');
    }
  }

  const apikey = String(payload?.apikey || '').trim();
  const status = String(payload?.status || 'active').trim().toLowerCase();

  return (
    <section className={cn('dashboard-quick-strip min-w-0 p-4 md:p-5', className)}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-blue/20 bg-brand-blue/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.24em] text-brand-blue">
            <KeyRound className="h-3.5 w-3.5" />
            {title}
          </div>
          <h2 className="mt-3 text-xl font-black uppercase tracking-[-0.025em] text-slate-950 dark:text-white sm:text-2xl">
            API public cho đại lý
          </h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-slate-600 dark:text-white/58">
            {description}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void loadApikey()} disabled={loading}>
            <RefreshCcw className={cn('h-4 w-4', loading ? 'animate-spin' : '')} />
            Refresh
          </Button>
          {showDocsButton ? (
            <Button asChild variant="outline">
              <Link href={docsHref}>
                <BookOpen className="h-4 w-4" />
                Docs AutoMXH
              </Link>
            </Button>
          ) : null}
          <Button type="button" onClick={() => void copyApikey()} disabled={!apikey}>
            <Copy className="h-4 w-4" />
            Copy apikey
          </Button>
        </div>
      </div>

      <div className="mt-4 rounded-[1rem] border border-slate-200/80 bg-white/72 p-4 dark:border-white/8 dark:bg-white/[0.04]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 dark:text-white/35">
            <CheckCircle2 className={cn('h-3.5 w-3.5', status === 'active' ? 'text-emerald-500' : 'text-amber-500')} />
            Trạng thái: {status === 'active' ? 'đang bật' : status}
          </div>
          {payload?.last_used_at ? (
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-white/35">
              Dùng gần nhất: {String(payload.last_used_at)}
            </div>
          ) : null}
        </div>
        <div className="mt-3 min-h-12 rounded-[0.85rem] border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm font-black leading-6 text-slate-900 dark:border-white/10 dark:bg-slate-950/60 dark:text-white">
          {loading ? (
            <span className="text-slate-400 dark:text-white/35">Đang tải apikey...</span>
          ) : apikey ? (
            <span className="break-all">{apikey}</span>
          ) : (
            <span className="text-rose-500">{payload?.message || 'Không thể tải apikey'}</span>
          )}
        </div>
      </div>
    </section>
  );
}
