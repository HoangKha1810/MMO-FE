'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  CalendarClock,
  CreditCard,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { BLUE_TICK_BADGE_SRC, BLUE_TICK_PRICE_VND } from '@/lib/blue-tick-constants';
import { readJsonResponse } from '@/lib/client-api';
import { cn, formatCurrency } from '@/lib/utils';
import { requestSessionUserRefresh, useSessionUser, type SessionUser } from '@/hooks/use-session-user';
import { useWalletBalance } from '@/components/layout/wallet-balance-context';

interface BlueTickSnapshot {
  user_id: number;
  username: string;
  email: string;
  price_vnd: number;
  duration_days: number;
  balance: number;
  is_blue_tick: boolean;
  blue_tick_expiry: string | null;
}

interface PurchaseResult {
  order_code: string;
  price_vnd: number;
  balance_after: number;
  expires_at: string;
  is_blue_tick: boolean;
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return 'Chưa kích hoạt';
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return 'Chưa xác định';
  }

  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function BlueTickPage({ initialUser }: { initialUser: SessionUser }) {
  const currentUser = useSessionUser(initialUser);
  const wallet = useWalletBalance();
  const [snapshot, setSnapshot] = useState<BlueTickSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const activeUser = currentUser.data || initialUser;
  const balance = wallet.balance ?? snapshot?.balance ?? activeUser.balance;
  const isActive = Boolean(snapshot?.is_blue_tick ?? activeUser.is_blue_tick);
  const expiry = snapshot?.blue_tick_expiry ?? activeUser.blue_tick_expiry ?? null;
  const price = snapshot?.price_vnd || BLUE_TICK_PRICE_VND;
  const canBuy = balance >= price;

  const remainingText = useMemo(() => {
    if (!expiry) {
      return 'Chưa có hạn sử dụng';
    }

    const expiryDate = new Date(expiry);
    const diff = expiryDate.getTime() - Date.now();
    if (!Number.isFinite(diff) || diff <= 0) {
      return 'Đã hết hạn';
    }

    const days = Math.max(1, Math.ceil(diff / (24 * 60 * 60 * 1000)));
    return `Còn khoảng ${days} ngày`;
  }, [expiry]);

  async function loadSnapshot() {
    setLoading(true);
    try {
      const response = await fetch('/api/blue-tick/order', {
        cache: 'no-store',
        credentials: 'include',
        headers: { 'Cache-Control': 'no-store' },
      });
      const payload = await readJsonResponse(response, 'Không tải được trạng thái tick xanh');
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không tải được trạng thái tick xanh');
      }
      setSnapshot(payload.data as BlueTickSnapshot);
      setMessage(null);
    } catch (error) {
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Không tải được trạng thái tick xanh',
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSnapshot();
  }, []);

  async function handlePurchase() {
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch('/api/blue-tick/order', {
        method: 'POST',
        cache: 'no-store',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const payload = await readJsonResponse(response, 'Không thể mua tick xanh');
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể mua tick xanh');
      }

      const data = payload.data as PurchaseResult;
      wallet.setBalances({ balance: Number(data.balance_after || 0) });
      setSnapshot((current) => ({
        user_id: current?.user_id || activeUser.id || 0,
        username: current?.username || activeUser.username,
        email: current?.email || activeUser.email,
        price_vnd: data.price_vnd || price,
        duration_days: 30,
        balance: Number(data.balance_after || 0),
        is_blue_tick: true,
        blue_tick_expiry: data.expires_at,
      }));
      requestSessionUserRefresh();
      toast.success(payload.message || 'Đã kích hoạt tick xanh.');
      setMessage({ tone: 'success', text: `Đơn ${data.order_code} đã hoàn tất. Tick xanh đã hiển thị trên tài khoản.` });
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Không thể mua tick xanh';
      toast.error(text);
      setMessage({ tone: 'error', text });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="mmo-edge-page-header relative overflow-hidden p-5 sm:p-7 md:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
          <div className="min-w-0 space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.28em] text-sky-400">
              <BadgeCheck className="h-3.5 w-3.5" />
              Tick xanh tài khoản
            </div>
            <div className="space-y-3">
              <h1 className="max-w-3xl break-words text-3xl font-black uppercase leading-[1.12] tracking-[-0.02em] text-white sm:text-4xl md:text-5xl">
                Kích hoạt tick xanh
              </h1>
              <p className="max-w-3xl text-sm font-semibold leading-7 text-white/62">
                Tick xanh hiển thị ngay cạnh avatar tài khoản trong hệ thống. Gói hiện tại có thời hạn 1 tháng và thanh toán bằng ví chính.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: 'Giá gói', value: formatCurrency(price), icon: CreditCard },
                { label: 'Thời hạn', value: '30 ngày', icon: CalendarClock },
                { label: 'Số dư ví chính', value: formatCurrency(balance), icon: Wallet },
              ].map((item) => (
                <div key={item.label} className="rounded-[1.15rem] border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.22em] text-white/45">
                    <item.icon className="h-3.5 w-3.5 text-sky-400" />
                    {item.label}
                  </div>
                  <div className="mt-3 font-mono text-xl font-black tracking-[-0.04em] text-white">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.4rem] border border-white/10 bg-[#061529]/88 p-5 shadow-[0_26px_70px_-40px_rgba(37,99,235,0.65)]">
            <div className="flex items-center gap-4">
              <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.35rem] border border-sky-400/20 bg-sky-400/10">
                <img src={BLUE_TICK_BADGE_SRC} alt="Tick xanh" className="h-14 w-14 object-contain" draggable={false} />
              </div>
              <div className="min-w-0">
                <div className="text-[9px] font-black uppercase tracking-[0.24em] text-white/45">Trạng thái</div>
                <div className={cn('mt-2 text-2xl font-black uppercase tracking-[-0.03em]', isActive ? 'text-sky-300' : 'text-white')}>
                  {isActive ? 'Đã kích hoạt' : 'Chưa kích hoạt'}
                </div>
                <div className="mt-1 text-xs font-bold text-white/50">{remainingText}</div>
              </div>
            </div>

            <div className="mt-5 rounded-[1rem] border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[9px] font-black uppercase tracking-[0.24em] text-white/45">Hết hạn</div>
              <div className="mt-2 text-sm font-black text-white">{formatDateTime(expiry)}</div>
            </div>

            <button
              type="button"
              onClick={handlePurchase}
              disabled={submitting || loading || !canBuy}
              className={cn(
                'mt-5 flex w-full items-center justify-center gap-2 rounded-[1rem] bg-gradient-to-r from-brand-blue to-cyan-400 px-5 py-4 text-[11px] font-black uppercase tracking-[0.24em] text-white shadow-[0_20px_46px_-26px_rgba(56,189,248,0.8)] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60',
                !canBuy && 'from-slate-600 to-slate-700'
              )}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {isActive ? 'Gia hạn thêm 1 tháng' : 'Mua tick xanh ngay'}
            </button>
            {!canBuy ? (
              <p className="mt-3 text-xs font-bold leading-6 text-amber-300">
                Số dư ví chính chưa đủ {formatCurrency(price)}.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-[1.35rem] border border-white/10 bg-[#061529]/80 p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.24em] text-white/40">Quyền lợi</div>
              <h2 className="mt-2 text-2xl font-black uppercase tracking-[-0.03em] text-white">Hiển thị nổi bật trên hệ thống</h2>
            </div>
            <button
              type="button"
              onClick={loadSnapshot}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/70 transition hover:bg-white/[0.08] disabled:opacity-60"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              Làm mới
            </button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              'Badge nằm cạnh avatar góc phải trên cùng.',
              'Hiển thị trong menu tài khoản và sidebar.',
              'Gia hạn cộng dồn nếu tài khoản đang còn hạn.',
            ].map((item) => (
              <div key={item} className="rounded-[1rem] border border-white/10 bg-white/[0.03] p-4 text-sm font-semibold leading-7 text-white/62">
                <ShieldCheck className="mb-3 h-4 w-4 text-sky-400" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className={cn(
          'rounded-[1.35rem] border p-5 sm:p-6',
          message?.tone === 'error'
            ? 'border-rose-500/25 bg-rose-500/10 text-rose-200'
            : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-100'
        )}>
          <div className="text-[9px] font-black uppercase tracking-[0.24em] opacity-70">Thông báo</div>
          <p className="mt-3 text-sm font-bold leading-7">
            {message?.text || 'Sẵn sàng kích hoạt tick xanh cho tài khoản của bạn.'}
          </p>
        </div>
      </section>
    </div>
  );
}
