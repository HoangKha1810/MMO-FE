'use client';

import { type ComponentType, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  Copy,
  Loader2,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  X,
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

function BrandLogoIcon({
  className,
  src,
  alt,
}: BrandIconProps & {
  src: string;
  alt: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center overflow-hidden rounded-[1.05rem] border border-slate-200/80 bg-white shadow-[0_18px_42px_-26px_rgba(15,23,42,0.28)] ring-1 ring-brand-blue/10 dark:border-white/10 dark:bg-slate-950/70 dark:shadow-[0_18px_42px_-22px_rgba(15,23,42,0.9)] dark:ring-cyan-200/10',
        className
      )}
    >
      <img src={src} alt={alt} className="h-full w-full object-cover" loading="lazy" />
    </span>
  );
}

function CursorBrandIcon({ className }: BrandIconProps) {
  return <BrandLogoIcon className={className} src="/brand/cursor-ai-logo.png" alt="Cursor AI" />;
}

function CodexBrandIcon({ className }: BrandIconProps) {
  return <BrandLogoIcon className={className} src="/brand/codex-ai-logo.svg" alt="Codex AI" />;
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
  if (normalized === 'completed') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/25 dark:text-emerald-300';
  if (normalized === 'processing') return 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:border-sky-400/25 dark:text-sky-300';
  if (normalized === 'canceled' || normalized === 'cancelled' || normalized === 'refunded') {
    return 'border-rose-500/25 bg-rose-500/10 text-rose-700 dark:border-rose-400/25 dark:text-rose-300';
  }
  return 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:border-amber-400/25 dark:text-amber-300';
}

function formatAmount(pack: VibeCodePackage) {
  const amount = toNumber(pack.unit_amount, 0);
  if (pack.provider === 'codex') return `${new Intl.NumberFormat('vi-VN').format(amount)}$`;
  if (pack.unit_label?.toLowerCase().includes('ngày')) {
    return `${new Intl.NumberFormat('vi-VN').format(amount)} ngày`;
  }
  return `${new Intl.NumberFormat('vi-VN').format(amount)} request`;
}

function packageDiscount(pack: VibeCodePackage, index: number) {
  if (pack.provider === 'codex') return [10, 18, 24, 32, 40][index % 5];
  if (pack.unit_label?.toLowerCase().includes('ngày')) return [9, 14, 25, 29][index % 4];
  return [9, 25, 18, 16, 27][index % 5];
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
  const [confirmPackage, setConfirmPackage] = useState<VibeCodePackage | null>(null);

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
        body: JSON.stringify({ package_id: pack.id, confirm: true }),
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
      setConfirmPackage(null);
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
                onBuy={setConfirmPackage}
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
                    <div className="mt-2 break-all font-mono text-xl font-black text-slate-950 dark:text-white">{lastOrder.order_code}</div>
                    <div className="mt-2 text-xs font-semibold text-slate-500 dark:text-slate-400">{lastOrder.package_title}</div>
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
                    <div key={order.order_code} className="rounded-[0.9rem] border border-slate-200/80 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-black text-slate-950 dark:text-white">{order.package_title}</div>
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
                      <div className="mt-3 flex items-center justify-between gap-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
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

        {confirmPackage ? (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm dark:bg-slate-950/75">
            <div className="w-full max-w-xl overflow-hidden rounded-[1.2rem] border border-brand-blue/15 bg-white shadow-[0_30px_90px_-48px_rgba(37,99,235,0.45)] dark:border-white/15 dark:bg-slate-950 dark:shadow-[0_30px_90px_-35px_rgba(37,99,235,0.7)]">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 p-5 dark:border-white/10">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-amber-200">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Xác nhận thanh toán
                  </div>
                  <h3 className="mt-4 text-2xl font-black uppercase leading-tight text-slate-950 dark:text-white">
                    Đồng ý mua gói này?
                  </h3>
                </div>
                <button
                  type="button"
                  className="grid h-10 w-10 place-items-center rounded-full border border-slate-200/80 bg-slate-50 text-slate-500 transition hover:bg-white hover:text-slate-950 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300 dark:hover:bg-white/[0.1] dark:hover:text-white"
                  onClick={() => setConfirmPackage(null)}
                  disabled={purchasingId === confirmPackage.id}
                  aria-label="Đóng xác nhận"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-5 p-5">
                <div className="rounded-[1rem] border border-brand-blue/25 bg-brand-blue/10 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Gói đang chọn</div>
                      <div className="mt-2 break-words text-xl font-black text-slate-950 dark:text-white">{confirmPackage.title}</div>
                      <div className="mt-1 text-sm font-bold text-cyan-700 dark:text-cyan-200">{formatAmount(confirmPackage)}</div>
                    </div>
                    <div className="rounded-[0.9rem] border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-right">
                      <div className="text-[9px] font-black uppercase tracking-[0.22em] text-emerald-300">Số tiền trừ</div>
                      <div className="mt-1 whitespace-nowrap font-mono text-lg font-black text-emerald-300">
                        {formatCurrency(confirmPackage.sale_price_vnd)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[1rem] border border-amber-300/35 bg-amber-400/10 p-4 text-sm font-semibold leading-7 text-amber-800 dark:border-amber-300/25 dark:text-amber-50">
                  Sau khi bấm đồng ý, hệ thống mới trừ tiền từ ví chính và tạo mã đơn. Vui lòng kiểm tra đúng gói, đúng giá trước khi thanh toán.
                </div>

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <Button
                    variant="secondary"
                    onClick={() => setConfirmPackage(null)}
                    disabled={purchasingId === confirmPackage.id}
                  >
                    Hủy
                  </Button>
                  <Button
                    loading={purchasingId === confirmPackage.id}
                    loadingText="Đang thanh toán"
                    onClick={() => buyPackage(confirmPackage)}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Đồng ý thanh toán
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
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
  onBuy: (pack: VibeCodePackage) => void;
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
        <div className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-4">
          {Array.from({ length: provider === 'cursor' ? 6 : 5 }).map((_, index) => (
            <div
              key={index}
              className="h-80 animate-pulse rounded-[1.35rem] border border-brand-blue/15 bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.84)] dark:bg-slate-950/50 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
            />
          ))}
        </div>
      ) : packages.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-4">
          {packages.map((pack, index) => (
            <article
              key={pack.id}
              className="group relative min-w-0 overflow-hidden rounded-[1.35rem] border border-brand-blue/16 bg-[linear-gradient(145deg,rgba(255,255,255,0.98)_0%,rgba(239,246,255,0.96)_50%,rgba(224,242,254,0.88)_100%)] p-5 text-slate-950 shadow-[0_28px_78px_-50px_rgba(37,99,235,0.42)] transition-all hover:-translate-y-1 hover:border-cyan-500/30 hover:shadow-[0_34px_90px_-54px_rgba(14,165,233,0.5)] dark:border-brand-blue/20 dark:bg-[linear-gradient(145deg,rgba(8,22,46,0.98)_0%,rgba(9,34,63,0.94)_48%,rgba(6,53,63,0.86)_100%)] dark:text-white dark:shadow-[0_28px_78px_-42px_rgba(14,165,233,0.55)] dark:hover:border-cyan-300/35 dark:hover:shadow-[0_34px_90px_-44px_rgba(20,184,166,0.58)]"
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(37,99,235,0.16),transparent_34%),radial-gradient(circle_at_88%_10%,rgba(20,184,166,0.14),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.5),transparent_42%)] dark:bg-[radial-gradient(circle_at_18%_14%,rgba(37,99,235,0.28),transparent_34%),radial-gradient(circle_at_88%_10%,rgba(20,184,166,0.22),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.06),transparent_40%)]" />
              <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500/35 to-transparent dark:via-cyan-300/45" />
              <div className="absolute left-0 top-0 z-10 overflow-hidden rounded-br-[1rem] border-b border-r border-white/10 text-[11px] font-black">
                <div className="bg-amber-100 px-3 py-1 text-amber-700 dark:bg-amber-400/20 dark:text-amber-100">Hot!</div>
                <div className="bg-emerald-100 px-3 py-1 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-100">-{packageDiscount(pack, index)}%</div>
              </div>
              <div className="absolute right-4 top-4 z-10 rounded-full border border-brand-blue/15 bg-white/82 px-3 py-1 text-[11px] font-bold text-slate-700 shadow-[0_14px_32px_-28px_rgba(37,99,235,0.38)] backdrop-blur dark:border-cyan-300/20 dark:bg-slate-950/70 dark:text-cyan-100 dark:shadow-[0_14px_32px_-24px_rgba(34,211,238,0.85)]">
                {meta.title}
              </div>

              <div className="relative pt-8 text-center">
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[1.4rem] border border-slate-200/80 bg-white/90 p-2 shadow-[0_22px_54px_-36px_rgba(37,99,235,0.55)] ring-1 ring-brand-blue/10 dark:border-white/10 dark:bg-slate-950/65 dark:shadow-[0_22px_54px_-28px_rgba(14,165,233,0.8)] dark:ring-cyan-200/10">
                  <Icon className="h-20 w-20 rounded-[1.15rem]" />
                </div>

                <h3 className="mt-5 min-h-[3.1rem] text-balance text-lg font-black leading-tight text-slate-950 dark:text-white">
                  {pack.title}
                </h3>
                <div className="mt-1 text-sm font-black text-slate-600 dark:text-cyan-100">{formatAmount(pack)}</div>
                <div className="mt-4 font-mono text-2xl font-black text-emerald-600 dark:text-emerald-300">
                  {formatCurrency(pack.sale_price_vnd)}
                </div>

                <div className="mt-5 space-y-2 rounded-[1rem] border border-slate-200/80 bg-white/72 p-4 text-left text-xs font-semibold text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] dark:border-white/10 dark:bg-slate-950/45 dark:text-slate-200 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  {[
                    'Tốc độ cao',
                    provider === 'codex' ? 'Nhận mã Codex API' : 'Sử dụng AI model và Max',
                    'Có giới hạn theo gói',
                    'Admin hướng dẫn sau khi nhận mã đơn',
                  ].map((feature) => (
                    <div key={feature} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-600 dark:text-cyan-300" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                className="relative mt-5 w-full rounded-[0.9rem] bg-[linear-gradient(135deg,#2563eb_0%,#0ea5e9_52%,#14b8a6_100%)] text-white shadow-[0_18px_42px_-24px_rgba(14,165,233,0.9)] hover:shadow-[0_24px_52px_-26px_rgba(20,184,166,0.95)]"
                loading={purchasingId === pack.id}
                loadingText="Đang mua"
                onClick={() => onBuy(pack)}
              >
                <Sparkles className="h-4 w-4" />
                Xem sản phẩm
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
