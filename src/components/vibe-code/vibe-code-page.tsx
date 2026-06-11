'use client';

import { type ComponentType, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clipboard,
  Copy,
  Loader2,
  PackageCheck,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { useWalletBalance } from '@/components/layout/wallet-balance-context';
import { Button } from '@/components/ui/button';
import { EmptyState, PageHero, SectionHeader } from '@/components/ui/page-layout';
import { useSessionUser } from '@/hooks/use-session-user';
import { readJsonResponse } from '@/lib/client-api';
import { cn, formatCurrency, toNumber } from '@/lib/utils';

type VibeCodeProvider = 'cursor' | 'codex';

type VibeCodePackage = {
  id: number;
  provider: VibeCodeProvider;
  package_key: string;
  title: string;
  description?: string | null;
  unit_label?: string | null;
  unit_amount: number;
  sale_price_vnd: number;
  display_order: number;
  status: string;
};

type VibeCodeOrder = {
  id?: number;
  order_code: string;
  package_id?: number;
  provider: VibeCodeProvider;
  package_key?: string;
  package_title: string;
  unit_amount?: number;
  sale_price_vnd: number;
  status: string;
  admin_note?: string | null;
  created_at?: string;
};

type BrandIconProps = {
  className?: string;
};

function CursorBrandIcon({ className }: BrandIconProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-[1.05rem] bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-500 text-white shadow-[0_18px_42px_-22px_rgba(59,130,246,0.95)]',
        className
      )}
    >
      <svg viewBox="0 0 32 32" className="h-[58%] w-[58%]" fill="none" aria-hidden="true">
        <path
          d="M7.4 5.8 25.9 14.4l-8.2 3.3-3.3 8.1L7.4 5.8Z"
          stroke="currentColor"
          strokeWidth="2.45"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="m17.5 17.5 7 7"
          stroke="currentColor"
          strokeWidth="2.45"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function CodexBrandIcon({ className }: BrandIconProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-[1.05rem] bg-gradient-to-br from-teal-400 via-cyan-500 to-sky-500 text-white shadow-[0_18px_42px_-22px_rgba(6,182,212,0.95)]',
        className
      )}
    >
      <svg viewBox="0 0 32 32" className="h-[56%] w-[56%]" fill="none" aria-hidden="true">
        <rect
          x="6"
          y="6"
          width="20"
          height="20"
          rx="2.8"
          stroke="currentColor"
          strokeWidth="2.35"
        />
        <path
          d="m12 13 4.1 3L12 19"
          stroke="currentColor"
          strokeWidth="2.35"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M18.5 20H22"
          stroke="currentColor"
          strokeWidth="2.35"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

const providerMeta: Record<VibeCodeProvider, {
  title: string;
  eyebrow: string;
  description: string;
  icon: ComponentType<BrandIconProps>;
  accent: string;
}> = {
  cursor: {
    title: 'Cursor AI',
    eyebrow: 'Request và Pro',
    description: 'Gói request hoặc Pro theo ngày, nhận mã đơn để admin hướng dẫn kích hoạt đúng gói.',
    icon: CursorBrandIcon,
    accent: 'from-sky-500 via-blue-500 to-indigo-500',
  },
  codex: {
    title: 'Codex API',
    eyebrow: 'API credit',
    description: 'Gói Codex API theo mốc USD: 10$, 50$, 100$, 200$ và 400$.',
    icon: CodexBrandIcon,
    accent: 'from-emerald-400 via-cyan-500 to-blue-500',
  },
};

function normalizePackage(input: Record<string, unknown>): VibeCodePackage {
  return {
    id: Math.trunc(toNumber(input.id, 0)),
    provider: String(input.provider || 'cursor') === 'codex' ? 'codex' : 'cursor',
    package_key: String(input.package_key || ''),
    title: String(input.title || ''),
    description: input.description == null ? null : String(input.description),
    unit_label: input.unit_label == null ? null : String(input.unit_label),
    unit_amount: toNumber(input.unit_amount, 0),
    sale_price_vnd: toNumber(input.sale_price_vnd, 0),
    display_order: Math.trunc(toNumber(input.display_order, 0)),
    status: String(input.status || 'active'),
  };
}

function normalizeOrder(input: Record<string, unknown>): VibeCodeOrder {
  return {
    id: input.id == null ? undefined : Math.trunc(toNumber(input.id, 0)),
    order_code: String(input.order_code || ''),
    package_id: input.package_id == null ? undefined : Math.trunc(toNumber(input.package_id, 0)),
    provider: String(input.provider || 'cursor') === 'codex' ? 'codex' : 'cursor',
    package_key: input.package_key == null ? undefined : String(input.package_key),
    package_title: String(input.package_title || input.title || ''),
    unit_amount: input.unit_amount == null ? undefined : toNumber(input.unit_amount, 0),
    sale_price_vnd: toNumber(input.sale_price_vnd, 0),
    status: String(input.status || 'pending'),
    admin_note: input.admin_note == null ? null : String(input.admin_note),
    created_at: input.created_at == null ? undefined : String(input.created_at),
  };
}

function statusLabel(status: string) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'completed') return 'Hoàn tất';
  if (normalized === 'processing') return 'Đang xử lý';
  if (normalized === 'canceled' || normalized === 'cancelled') return 'Đã hủy';
  if (normalized === 'refunded') return 'Đã hoàn tiền';
  return 'Chờ admin';
}

function statusClass(status: string) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'completed') return 'border-emerald-400/25 bg-emerald-500/10 text-emerald-300';
  if (normalized === 'processing') return 'border-sky-400/25 bg-sky-500/10 text-sky-300';
  if (normalized === 'canceled' || normalized === 'cancelled' || normalized === 'refunded') {
    return 'border-rose-400/25 bg-rose-500/10 text-rose-300';
  }
  return 'border-amber-400/25 bg-amber-500/10 text-amber-300';
}

function formatAmount(pack: VibeCodePackage) {
  const amount = toNumber(pack.unit_amount, 0);
  if (pack.provider === 'codex') return `${new Intl.NumberFormat('vi-VN').format(amount)}$`;
  if (pack.unit_label?.toLowerCase().includes('ngày')) {
    return `${new Intl.NumberFormat('vi-VN').format(amount)} ngày`;
  }
  return `${new Intl.NumberFormat('vi-VN').format(amount)} request`;
}

function formatDateTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  }).format(date);
}

export function VibeCodePage() {
  const { data: user } = useSessionUser();
  const { setBalances } = useWalletBalance();
  const [packages, setPackages] = useState<VibeCodePackage[]>([]);
  const [orders, setOrders] = useState<VibeCodeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [purchasingId, setPurchasingId] = useState<number | null>(null);
  const [lastOrder, setLastOrder] = useState<VibeCodeOrder | null>(null);

  const grouped = useMemo(() => ({
    cursor: packages.filter((item) => item.provider === 'cursor'),
    codex: packages.filter((item) => item.provider === 'codex'),
  }), [packages]);

  async function loadPackages() {
    setLoading(true);
    try {
      const response = await fetch('/api/vibe-code/packages', {
        cache: 'no-store',
        credentials: 'include',
        headers: { 'Cache-Control': 'no-store' },
      });
      const payload = await readJsonResponse<{ success: boolean; data?: Array<Record<string, unknown>> }>(
        response,
        'Không tải được bảng giá Vibe Code'
      );
      setPackages((payload.data || []).map(normalizePackage));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không tải được bảng giá Vibe Code');
    } finally {
      setLoading(false);
    }
  }

  async function loadOrders() {
    setLoadingOrders(true);
    try {
      const response = await fetch('/api/vibe-code/order', {
        cache: 'no-store',
        credentials: 'include',
        headers: { 'Cache-Control': 'no-store' },
      });
      const payload = await readJsonResponse<{ success: boolean; data?: Array<Record<string, unknown>> }>(
        response,
        'Không tải được lịch sử Vibe Code'
      );
      setOrders((payload.data || []).map(normalizeOrder));
    } catch {
      setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  }

  useEffect(() => {
    void loadPackages();
    void loadOrders();
  }, []);

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast.success('Đã copy mã đơn');
    } catch {
      toast.error('Không copy được mã, hãy bôi đen mã để sao chép');
    }
  }

  async function buyPackage(pack: VibeCodePackage) {
    setPurchasingId(pack.id);
    try {
      const response = await fetch('/api/vibe-code/order', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package_id: pack.id }),
      });
      const payload = await readJsonResponse<{
        success: boolean;
        message?: string;
        data?: { order?: Record<string, unknown>; balance_after?: number };
      }>(response, 'Không mua được gói Vibe Code');

      if (typeof payload.data?.balance_after === 'number') {
        setBalances({ balance: payload.data.balance_after });
      }

      const order = payload.data?.order ? normalizeOrder(payload.data.order) : null;
      if (order) {
        setLastOrder(order);
        setOrders((current) => [order, ...current.filter((item) => item.order_code !== order.order_code)]);
      } else {
        await loadOrders();
      }
      toast.success(payload.message || 'Đã tạo đơn Vibe Code');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không mua được gói Vibe Code');
    } finally {
      setPurchasingId(null);
    }
  }

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <PageHero
          eyebrow="Vibe Code"
          title="Vibe Code"
          description="Bảng giá Cursor AI và Codex API. Mua xong hệ thống sinh mã đơn riêng để gửi admin hướng dẫn kích hoạt."
          stats={[
            { label: 'Cursor AI', value: `${grouped.cursor.length} gói`, hint: 'Request và Pro', tone: 'blue' },
            { label: 'Codex API', value: `${grouped.codex.length} gói`, hint: 'Credit theo USD', tone: 'emerald' },
          ]}
        />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            {(['cursor', 'codex'] as VibeCodeProvider[]).map((provider) => (
              <ProviderPricing
                key={provider}
                provider={provider}
                packages={grouped[provider]}
                loading={loading}
                purchasingId={purchasingId}
                onBuy={buyPackage}
              />
            ))}
          </div>

          <aside className="space-y-4">
            <section className="surface-panel rounded-[1rem] p-5">
              <SectionHeader
                eyebrow="Mã vừa mua"
                title="Gửi admin"
                description="Mã đơn dùng để admin đối chiếu và hướng dẫn cấp gói."
              />
              {lastOrder ? (
                <div className="mt-5 space-y-4">
                  <div className="rounded-[1rem] border border-brand-blue/25 bg-brand-blue/10 p-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Mã đơn</div>
                    <div className="mt-2 break-all font-mono text-xl font-black text-white">{lastOrder.order_code}</div>
                    <div className="mt-2 text-xs font-semibold text-slate-400">{lastOrder.package_title}</div>
                  </div>
                  <Button className="w-full" onClick={() => copyCode(lastOrder.order_code)}>
                    <Copy className="h-4 w-4" />
                    Copy mã
                  </Button>
                </div>
              ) : (
                <EmptyState
                  className="mt-5 py-8"
                  title="Chưa có mã mới"
                  description="Sau khi mua gói, mã đơn sẽ hiện ngay tại đây."
                  icon={<Clipboard className="h-5 w-5" />}
                />
              )}
            </section>

            <section className="surface-panel rounded-[1rem] p-5">
              <SectionHeader eyebrow="Lịch sử" title="Đơn Vibe Code" />
              <div className="mt-5 space-y-3">
                {loadingOrders ? (
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang tải đơn
                  </div>
                ) : orders.length > 0 ? (
                  orders.slice(0, 8).map((order) => (
                    <div key={order.order_code} className="rounded-[0.9rem] border border-white/10 bg-white/[0.03] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-black text-white">{order.package_title}</div>
                          <button
                            type="button"
                            className="mt-1 break-all font-mono text-xs font-black text-brand-blue hover:text-blue-300"
                            onClick={() => copyCode(order.order_code)}
                          >
                            {order.order_code}
                          </button>
                        </div>
                        <span className={cn('shrink-0 rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.18em]', statusClass(order.status))}>
                          {statusLabel(order.status)}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3 text-xs font-semibold text-slate-400">
                        <span>{formatCurrency(toNumber(order.sale_price_vnd, 0))}</span>
                        <span>{formatDateTime(order.created_at)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    className="py-8"
                    title="Chưa có đơn"
                    description="Các mã đã mua sẽ được lưu ở đây."
                    icon={<PackageCheck className="h-5 w-5" />}
                  />
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function ProviderPricing({
  provider,
  packages,
  loading,
  purchasingId,
  onBuy,
}: {
  provider: VibeCodeProvider;
  packages: VibeCodePackage[];
  loading: boolean;
  purchasingId: number | null;
  onBuy: (pack: VibeCodePackage) => Promise<void>;
}) {
  const meta = providerMeta[provider];
  const Icon = meta.icon;

  return (
    <section className="space-y-4">
      <SectionHeader
        eyebrow={meta.eyebrow}
        title={meta.title}
        description={meta.description}
        actions={
          <Icon className="h-11 w-11" />
        }
      />

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: provider === 'cursor' ? 6 : 5 }).map((_, index) => (
            <div key={index} className="h-44 animate-pulse rounded-[1rem] border border-white/10 bg-white/[0.04]" />
          ))}
        </div>
      ) : packages.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {packages.map((pack) => (
            <article
              key={pack.id}
              className="group relative min-w-0 overflow-hidden rounded-[1rem] border border-slate-200/70 bg-white/80 p-5 shadow-[0_20px_55px_-38px_rgba(15,23,42,0.24)] transition-all hover:-translate-y-0.5 hover:border-brand-blue/35 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[0_24px_70px_-45px_rgba(37,99,235,0.45)]"
            >
              <div className={cn('absolute inset-x-0 top-0 h-1 bg-gradient-to-r', meta.accent)} />
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">
                    <Sparkles className="h-3 w-3" />
                    {provider === 'codex' ? 'API' : 'Cursor'}
                  </div>
                  <h3 className="break-words text-lg font-black uppercase leading-[1.18] text-slate-950 dark:text-white">
                    {pack.title}
                  </h3>
                </div>
                <Icon className="h-11 w-11 shrink-0" />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-[0.85rem] border border-slate-200/70 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-slate-950/35">
                  <div className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">Gói</div>
                  <div className="mt-2 whitespace-nowrap font-mono text-lg font-black text-slate-950 dark:text-white">{formatAmount(pack)}</div>
                </div>
                <div className="rounded-[0.85rem] border border-emerald-500/20 bg-emerald-500/10 p-3">
                  <div className="text-[9px] font-black uppercase tracking-[0.22em] text-emerald-500/90">Giá bán</div>
                  <div className="mt-2 whitespace-nowrap font-mono text-lg font-black text-emerald-400">{formatCurrency(pack.sale_price_vnd)}</div>
                </div>
              </div>

              <Button
                className="mt-5 w-full"
                loading={purchasingId === pack.id}
                loadingText="Đang mua"
                onClick={() => onBuy(pack)}
              >
                <CheckCircle2 className="h-4 w-4" />
                Mua gói
              </Button>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="Chưa có gói" description="Admin chưa bật gói cho mục này." icon={<Icon className="h-10 w-10" />} />
      )}
    </section>
  );
}
