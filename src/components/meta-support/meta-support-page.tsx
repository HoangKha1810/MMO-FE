'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Headset,
  Loader2,
  Mail,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { useWalletBalance } from '@/components/layout/wallet-balance-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, PageHero, SectionHeader, SectionPanel } from '@/components/ui/page-layout';
import { useSessionUser } from '@/hooks/use-session-user';
import { readJsonResponse } from '@/lib/client-api';
import { cn, formatCurrency, toNumber } from '@/lib/utils';

type MetaSupportPackage = {
  quantity: number;
  price: number;
  label: string;
};

type MetaSupportOrder = {
  id: number;
  contact: string;
  gmail: string;
  quantity: number;
  price: number;
  note?: string | null;
  admin_note?: string | null;
  status: string;
  created_at?: string;
  updated_at?: string;
};

const DEFAULT_PACKAGES: MetaSupportPackage[] = [
  { quantity: 1, price: 450_000, label: '1 tài khoản' },
];

const META_SUPPORT_QUANTITY = 1;

function normalizePackages(input?: MetaSupportPackage[]) {
  const source = input?.length ? input : DEFAULT_PACKAGES;
  const selected = source.find((item) => Math.trunc(toNumber(item.quantity, 0)) === META_SUPPORT_QUANTITY) || DEFAULT_PACKAGES[0];
  return [
    {
      quantity: META_SUPPORT_QUANTITY,
      price: toNumber(selected.price, DEFAULT_PACKAGES[0].price),
      label: '1 tài khoản',
    },
  ];
}

function statusLabel(status: string) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'processing') return 'Đang xử lý';
  if (normalized === 'completed') return 'Hoàn tất';
  if (normalized === 'canceled') return 'Đã hủy';
  return 'Chờ xử lý';
}

function statusClass(status: string) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'completed') return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400';
  if (normalized === 'processing') return 'border-sky-500/20 bg-sky-500/10 text-sky-400';
  if (normalized === 'canceled') return 'border-rose-500/20 bg-rose-500/10 text-rose-400';
  return 'border-amber-500/20 bg-amber-500/10 text-amber-400';
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
    year: 'numeric',
  }).format(date);
}

export function MetaSupportPage() {
  const { data: user } = useSessionUser();
  const { setBalances } = useWalletBalance();
  const [packages, setPackages] = useState<MetaSupportPackage[]>(() => normalizePackages());
  const [selectedQuantity, setSelectedQuantity] = useState(META_SUPPORT_QUANTITY);
  const [contact, setContact] = useState('');
  const [gmail, setGmail] = useState('');
  const [note, setNote] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [orders, setOrders] = useState<MetaSupportOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const selectedPackage = useMemo(
    () => packages.find((item) => item.quantity === selectedQuantity) || packages[0],
    [packages, selectedQuantity]
  );

  const totalOrders = orders.length;
  const processingOrders = orders.filter((order) => ['pending', 'processing'].includes(String(order.status).toLowerCase())).length;

  async function loadOrders() {
    setLoadingOrders(true);
    try {
      const response = await fetch('/api/meta-support/orders', {
        cache: 'no-store',
        credentials: 'include',
        headers: { 'Cache-Control': 'no-store' },
      });
      const payload = await readJsonResponse<{
        success: boolean;
        data?: { orders?: MetaSupportOrder[]; packages?: MetaSupportPackage[] };
      }>(response, 'Không tải được đơn Auto kích nút Meta');
      setPackages(normalizePackages(payload.data?.packages));
      setSelectedQuantity(META_SUPPORT_QUANTITY);
      setOrders(payload.data?.orders || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không tải được đơn Auto kích nút Meta');
    } finally {
      setLoadingOrders(false);
    }
  }

  useEffect(() => {
    void loadOrders();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!accepted) {
      toast.error('Bạn cần xác nhận điều khoản xử lý trước khi gửi đơn');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/meta-support/orders', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: selectedPackage.quantity,
          contact,
          gmail,
          note,
        }),
      });
      const payload = await readJsonResponse<{
        success: boolean;
        message?: string;
        data?: { order?: MetaSupportOrder | null; balance_after?: number };
      }>(response, 'Không tạo được đơn Auto kích nút Meta');

      if (typeof payload.data?.balance_after === 'number') {
        setBalances({ balance: payload.data.balance_after });
      }
      if (payload.data?.order) {
        setOrders((current) => [payload.data!.order!, ...current]);
      } else {
        await loadOrders();
      }
      setGmail('');
      setNote('');
      setAccepted(false);
      toast.success(payload.message || 'Đã gửi yêu cầu Auto kích nút Meta');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không tạo được đơn Auto kích nút Meta');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <PageHero
          eyebrow="Dịch vụ độc quyền"
          title="Auto kích nút + Chat Support Meta"
          description="Gửi Gmail cần xử lý, thông tin liên hệ và ghi chú support. AI tool sẽ hỗ trợ xử lý đúng hướng và cập nhật trạng thái ngay trong lịch sử đơn."
          stats={[
            { label: 'Gói dịch vụ', value: '1 TK', hint: formatCurrency(toNumber(packages[0]?.price, 450_000)), tone: 'blue' },
            { label: 'Đơn của bạn', value: String(totalOrders), hint: 'đã gửi', tone: 'slate' },
            { label: 'Đang xử lý', value: String(processingOrders), hint: 'chờ hoặc đang làm', tone: 'amber' },
          ]}
        />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <SectionPanel>
            <SectionHeader
              eyebrow="Tạo đơn"
              title="Thông tin đơn hàng"
              description="Chọn gói số lượng, nhập liên hệ và Gmail cần kích nút để admin tiếp nhận."
            />

            <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
              <div className="grid gap-3 md:max-w-md">
                {packages.map((item) => {
                  const active = item.quantity === selectedPackage.quantity;
                  return (
                    <button
                      key={item.quantity}
                      type="button"
                      onClick={() => setSelectedQuantity(item.quantity)}
                      className={cn(
                        'min-h-[116px] rounded-[1rem] border p-4 text-left transition-all',
                        active
                          ? 'border-brand-blue/60 bg-brand-blue/15 shadow-[0_24px_60px_-34px_rgba(37,99,235,0.9)]'
                          : 'border-slate-200 bg-white/70 hover:border-brand-blue/25 hover:bg-white dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]'
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-lg font-black uppercase tracking-tight text-slate-950 dark:text-white">
                          {item.label}
                        </span>
                        {active ? <CheckCircle2 className="h-5 w-5 text-brand-blue" /> : null}
                      </div>
                      <div className="mt-4 font-mono text-2xl font-black text-emerald-500">
                        {formatCurrency(toNumber(item.price, 0))}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Thông tin liên hệ</span>
                  <Input
                    value={contact}
                    onChange={(event) => setContact(event.target.value)}
                    placeholder="Zalo / Telegram / Số điện thoại"
                    required
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Gmail cần kích nút</span>
                  <textarea
                    value={gmail}
                    onChange={(event) => setGmail(event.target.value)}
                  placeholder="Nhập Gmail cần xử lý, có thể xuống dòng nhiều tài khoản"
                    required
                    className="field-elevated min-h-[96px] w-full rounded-[0.85rem] px-4 py-3 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-brand-blue focus:outline-none focus:ring-4 focus:ring-brand-blue/10 dark:text-white"
                  />
                </label>
              </div>

              <label className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Nội dung support</span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Nội dung cần nhắn với support Meta, tình trạng tài khoản hoặc yêu cầu thêm"
                  className="field-elevated min-h-[120px] w-full rounded-[0.85rem] px-4 py-3 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-brand-blue focus:outline-none focus:ring-4 focus:ring-brand-blue/10 dark:text-white"
                />
              </label>

              <div className="surface-card flex flex-col gap-4 rounded-[1rem] p-4 md:flex-row md:items-center md:justify-between">
                <label className="flex min-w-0 items-start gap-3 text-sm font-semibold leading-7 text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(event) => setAccepted(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 accent-blue-600"
                  />
                  <span>
                    Tôi xác nhận Gmail/tài khoản gửi lên thuộc quyền quản lý của mình và chịu trách nhiệm về thông tin cung cấp.
                  </span>
                </label>
                <div className="shrink-0 text-right">
                  <div className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">Thanh toán</div>
                  <div className="font-mono text-2xl font-black text-slate-950 dark:text-white">
                    {formatCurrency(toNumber(selectedPackage.price, 0))}
                  </div>
                </div>
              </div>

              <Button className="w-full" size="xl" type="submit" loading={submitting} loadingText="Đang gửi đơn">
                <Headset className="mr-2 h-4 w-4" />
                Đặt dịch vụ ngay
              </Button>
            </form>
          </SectionPanel>

          <SectionPanel className="h-fit">
            <SectionHeader eyebrow="Lưu ý" title="Cách xử lý" />
            <div className="mt-6 space-y-3">
              {[
                { icon: Mail, title: 'Gmail rõ ràng', desc: 'Gửi đúng Gmail hoặc danh sách Gmail cần kích nút.' },
                { icon: ShieldCheck, title: 'Tài khoản hợp lệ', desc: 'Chỉ nhận trường hợp bạn có quyền sử dụng/quản lý.' },
                { icon: Clock3, title: 'Admin cập nhật', desc: 'Trạng thái và ghi chú sẽ hiện trong lịch sử đơn.' },
              ].map((item) => (
                <div key={item.title} className="surface-card rounded-[1rem] p-4">
                  <div className="flex gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-brand-blue/20 bg-brand-blue/10 text-brand-blue">
                      <item.icon className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="font-black uppercase tracking-tight text-slate-950 dark:text-white">{item.title}</div>
                      <p className="mt-1 text-sm font-semibold leading-7 text-slate-500 dark:text-slate-400">{item.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionPanel>
        </div>

        <SectionPanel>
          <SectionHeader
            eyebrow="Lịch sử"
            title="Đơn Auto kích nút Meta"
            actions={
              <Button type="button" variant="secondary" onClick={() => loadOrders()} loading={loadingOrders} loadingText="Đang tải">
                <RefreshCw className="mr-2 h-4 w-4" />
                Làm mới
              </Button>
            }
          />

          <div className="mt-6 space-y-3">
            {loadingOrders ? (
              <div className="flex min-h-[180px] items-center justify-center text-slate-500">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : orders.length === 0 ? (
              <EmptyState
                icon={<AlertTriangle className="h-5 w-5" />}
                title="Chưa có đơn"
                description="Các yêu cầu Auto kích nút Meta của bạn sẽ hiển thị tại đây."
              />
            ) : (
              orders.map((order) => (
                <div key={order.id} className="surface-card rounded-[1rem] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="surface-chip rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                          #{order.id}
                        </span>
                        <span className={cn('rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em]', statusClass(order.status))}>
                          {statusLabel(order.status)}
                        </span>
                      </div>
                      <h3 className="mt-3 break-words text-lg font-black text-slate-950 dark:text-white">
                        {order.quantity} tài khoản - {order.contact}
                      </h3>
                      <p className="mt-2 whitespace-pre-line text-sm font-semibold leading-7 text-slate-500 dark:text-slate-400">
                        {order.gmail}
                      </p>
                      {order.admin_note ? (
                        <p className="mt-3 rounded-[0.85rem] border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm font-semibold leading-7 text-emerald-500">
                          {order.admin_note}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-xl font-black text-emerald-500">{formatCurrency(toNumber(order.price, 0))}</div>
                      <div className="mt-2 text-xs font-bold text-slate-500">{formatDateTime(order.updated_at)}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionPanel>
      </div>
    </AppShell>
  );
}
