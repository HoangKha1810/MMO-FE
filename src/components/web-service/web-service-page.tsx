'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  Clock3,
  Code2,
  ExternalLink,
  Globe2,
  Loader2,
  MonitorSmartphone,
  Send,
  ServerCog,
  ShoppingBag,
  Store,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { EmptyState, PageHero, SectionHeader } from '@/components/ui/page-layout';
import { useSessionUser } from '@/hooks/use-session-user';
import { readJsonResponse } from '@/lib/client-api';
import { cn, formatCurrency, toNumber } from '@/lib/utils';

type WebServiceCategory = 'web_con' | 'build_web';

type WebServicePackage = {
  id: number;
  category: WebServiceCategory;
  package_key: string;
  title: string;
  description?: string | null;
  price_min_vnd: number;
  price_max_vnd: number;
  display_order: number;
  status: string;
};

type WebServiceOrder = {
  id?: number;
  order_code: string;
  package_id?: number;
  category: WebServiceCategory;
  package_key?: string;
  package_title: string;
  price_min_vnd: number;
  price_max_vnd: number;
  quoted_price_vnd: number;
  contact?: string | null;
  desired_domain?: string | null;
  requirement?: string | null;
  status: string;
  admin_note?: string | null;
  created_at?: string;
};

const categoryMeta: Record<WebServiceCategory, {
  label: string;
  title: string;
  description: string;
  icon: typeof Globe2;
  tone: string;
}> = {
  web_con: {
    label: 'Web con MMO',
    title: 'Web con MMO',
    description: 'Đấu 1 dịch vụ hoặc đấu full dịch vụ cho hệ thống MMO.',
    icon: ServerCog,
    tone: 'from-cyan-500 via-blue-500 to-indigo-500',
  },
  build_web: {
    label: 'Build Website',
    title: 'Build Website',
    description: 'Portfolio, web cá nhân, web bán hàng, chatbot và dự án web riêng.',
    icon: Code2,
    tone: 'from-emerald-400 via-cyan-500 to-blue-500',
  },
};

const packageIcons: Record<string, typeof Globe2> = {
  web_con_one_service: ServerCog,
  web_con_full_service: MonitorSmartphone,
  portfolio: UserRound,
  personal_info: Globe2,
  online_store: Store,
  chatbot: Bot,
  custom: ShoppingBag,
};

function normalizePackage(input: Record<string, unknown>): WebServicePackage {
  return {
    id: Math.trunc(toNumber(input.id, 0)),
    category: String(input.category || '') === 'build_web' ? 'build_web' : 'web_con',
    package_key: String(input.package_key || ''),
    title: String(input.title || ''),
    description: input.description == null ? null : String(input.description),
    price_min_vnd: toNumber(input.price_min_vnd, 0),
    price_max_vnd: toNumber(input.price_max_vnd, 0),
    display_order: Math.trunc(toNumber(input.display_order, 0)),
    status: String(input.status || 'active'),
  };
}

function normalizeOrder(input: Record<string, unknown>): WebServiceOrder {
  return {
    id: input.id == null ? undefined : Math.trunc(toNumber(input.id, 0)),
    order_code: String(input.order_code || ''),
    package_id: input.package_id == null ? undefined : Math.trunc(toNumber(input.package_id, 0)),
    category: String(input.category || '') === 'build_web' ? 'build_web' : 'web_con',
    package_key: input.package_key == null ? undefined : String(input.package_key),
    package_title: String(input.package_title || ''),
    price_min_vnd: toNumber(input.price_min_vnd, 0),
    price_max_vnd: toNumber(input.price_max_vnd, 0),
    quoted_price_vnd: toNumber(input.quoted_price_vnd, 0),
    contact: input.contact == null ? null : String(input.contact),
    desired_domain: input.desired_domain == null ? null : String(input.desired_domain),
    requirement: input.requirement == null ? null : String(input.requirement),
    status: String(input.status || 'pending'),
    admin_note: input.admin_note == null ? null : String(input.admin_note),
    created_at: input.created_at == null ? undefined : String(input.created_at),
  };
}

function formatPriceRange(minValue: number, maxValue: number) {
  const min = Math.max(0, Math.round(toNumber(minValue, 0)));
  const max = Math.max(0, Math.round(toNumber(maxValue, 0)));
  if (min <= 0 && max <= 0) return 'Liên hệ Admin';
  if (min === max || max <= 0) return formatCurrency(min);
  return `${formatCurrency(min)} - ${formatCurrency(max)}`;
}

function statusLabel(status: string) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'completed') return 'Hoàn tất';
  if (normalized === 'processing') return 'Đang xử lý';
  if (normalized === 'quoted') return 'Đã báo giá';
  if (normalized === 'canceled' || normalized === 'cancelled') return 'Đã hủy';
  return 'Chờ admin';
}

function statusClass(status: string) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'completed') return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/25 dark:text-emerald-300';
  if (normalized === 'processing') return 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:border-sky-400/25 dark:text-sky-300';
  if (normalized === 'quoted') return 'border-violet-500/25 bg-violet-500/10 text-violet-700 dark:border-violet-400/25 dark:text-violet-300';
  if (normalized === 'canceled' || normalized === 'cancelled') {
    return 'border-rose-500/25 bg-rose-500/10 text-rose-700 dark:border-rose-400/25 dark:text-rose-300';
  }
  return 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:border-amber-400/25 dark:text-amber-300';
}

function formatDateTime(value?: string) {
  if (!value) return '-';
  const raw = String(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
  if (match) {
    return `${match[4]}:${match[5]} ${match[3]}/${match[2]}`;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  }).format(date);
}

export function WebServicePage() {
  const { data: user } = useSessionUser();
  const [packages, setPackages] = useState<WebServicePackage[]>([]);
  const [orders, setOrders] = useState<WebServiceOrder[]>([]);
  const [activeTab, setActiveTab] = useState<WebServiceCategory>('web_con');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [contact, setContact] = useState('');
  const [desiredDomain, setDesiredDomain] = useState('');
  const [requirement, setRequirement] = useState('');
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const grouped = useMemo(() => ({
    web_con: packages.filter((item) => item.category === 'web_con'),
    build_web: packages.filter((item) => item.category === 'build_web'),
  }), [packages]);

  const activePackages = grouped[activeTab];
  const selectedPackage = useMemo(() => (
    packages.find((item) => item.id === selectedId) || activePackages[0] || null
  ), [activePackages, packages, selectedId]);

  useEffect(() => {
    if (!selectedPackage) return;
    if (!activePackages.some((item) => item.id === selectedPackage.id)) {
      setSelectedId(activePackages[0]?.id ?? null);
    }
  }, [activePackages, selectedPackage]);

  useEffect(() => {
    if (!contact && user?.email) {
      setContact(user.email);
    }
  }, [contact, user?.email]);

  async function loadPackages() {
    setLoadingPackages(true);
    try {
      const response = await fetch('/api/web-service/packages', {
        cache: 'no-store',
        credentials: 'include',
        headers: { 'Cache-Control': 'no-store' },
      });
      const payload = await readJsonResponse<{ success: boolean; data?: Array<Record<string, unknown>> }>(
        response,
        'Không tải được bảng giá dịch vụ web'
      );
      const nextPackages = (payload.data || []).map(normalizePackage);
      setPackages(nextPackages);
      setSelectedId((current) => current || nextPackages.find((item) => item.category === activeTab)?.id || nextPackages[0]?.id || null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không tải được bảng giá dịch vụ web');
    } finally {
      setLoadingPackages(false);
    }
  }

  async function loadOrders() {
    setLoadingOrders(true);
    try {
      const response = await fetch('/api/web-service/orders', {
        cache: 'no-store',
        credentials: 'include',
        headers: { 'Cache-Control': 'no-store' },
      });
      const payload = await readJsonResponse<{ success: boolean; data?: Array<Record<string, unknown>> }>(
        response,
        'Không tải được lịch sử đặt dịch vụ web'
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

  function selectTab(tab: WebServiceCategory) {
    setActiveTab(tab);
    const first = grouped[tab][0];
    setSelectedId(first?.id ?? null);
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast.success('Đã copy mã đơn');
    } catch {
      toast.error('Không copy được mã đơn');
    }
  }

  async function submitOrder() {
    if (!selectedPackage) {
      toast.error('Vui lòng chọn gói dịch vụ');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/web-service/orders', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package_id: selectedPackage.id,
          contact,
          desired_domain: desiredDomain,
          requirement,
          confirm: true,
        }),
      });
      const payload = await readJsonResponse<{
        success: boolean;
        message?: string;
        data?: { order?: Record<string, unknown> };
      }>(response, 'Không gửi được yêu cầu dịch vụ web');
      const order = payload.data?.order ? normalizeOrder(payload.data.order) : null;
      if (order) {
        setOrders((current) => [order, ...current.filter((item) => item.order_code !== order.order_code)]);
      } else {
        await loadOrders();
      }
      setRequirement('');
      setDesiredDomain('');
      toast.success(payload.message || 'Đã gửi yêu cầu dịch vụ web');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không gửi được yêu cầu dịch vụ web');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <PageHero
          eyebrow="Dịch vụ web"
          title="Web con MMO và Build Website"
          description="Chọn gói web con hoặc build website, gửi nhu cầu và admin sẽ tiếp nhận đơn ngay trong trang quản trị."
          stats={[
            { label: 'Web con', value: `${grouped.web_con.length} gói`, hint: 'Đấu 1 dịch vụ hoặc full', tone: 'blue' },
            { label: 'Build web', value: `${grouped.build_web.length} gói`, hint: 'Portfolio, store, chatbot', tone: 'emerald' },
          ]}
          actions={
            <Button asChild variant="outline" size="sm">
              <a href="https://hotieubao.net" target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                Hotieubao.net
              </a>
            </Button>
          }
        />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <main className="space-y-5">
            <section className="surface-panel rounded-[1rem] p-3 sm:p-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {(['web_con', 'build_web'] as WebServiceCategory[]).map((tab) => {
                  const meta = categoryMeta[tab];
                  const Icon = meta.icon;
                  const active = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      className={cn(
                        'flex min-h-[4.5rem] items-center gap-3 rounded-[0.9rem] border px-4 py-3 text-left transition-all',
                        active
                          ? 'border-brand-blue/30 bg-brand-blue/12 text-brand-blue shadow-[0_18px_44px_-32px_rgba(37,99,235,0.62)] dark:border-cyan-300/25 dark:bg-cyan-400/10 dark:text-cyan-100'
                          : 'border-slate-200/80 bg-white/70 text-slate-600 hover:border-brand-blue/20 hover:text-brand-blue dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:border-cyan-300/20 dark:hover:text-cyan-100'
                      )}
                      onClick={() => selectTab(tab)}
                    >
                      <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-[0.8rem] bg-gradient-to-br text-white', meta.tone)}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black uppercase tracking-[0.14em]">{meta.label}</span>
                        <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">{meta.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <SectionHeader
              eyebrow={categoryMeta[activeTab].label}
              title={categoryMeta[activeTab].title}
              description={categoryMeta[activeTab].description}
            />

            {loadingPackages ? (
              <div className="grid gap-4 md:grid-cols-2">
                {Array.from({ length: activeTab === 'web_con' ? 2 : 5 }).map((_, index) => (
                  <div key={index} className="h-72 animate-pulse rounded-[1.25rem] border border-brand-blue/15 bg-white/70 dark:bg-slate-950/50" />
                ))}
              </div>
            ) : activePackages.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {activePackages.map((pack) => (
                  <PackageCard
                    key={pack.id}
                    pack={pack}
                    active={selectedPackage?.id === pack.id}
                    onSelect={() => setSelectedId(pack.id)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="Chưa có gói"
                description="Admin chưa bật gói cho tab này."
                icon={<Globe2 className="h-5 w-5" />}
              />
            )}
          </main>

          <aside className="space-y-4">
            <section className="surface-panel rounded-[1rem] p-5">
              <SectionHeader
                eyebrow="Tạo yêu cầu"
                title="Thông tin dự án"
                description="Admin sẽ dùng thông tin này để tư vấn và cập nhật đơn."
              />

              <div className="mt-5 space-y-4">
                <div className="rounded-[1rem] border border-brand-blue/20 bg-brand-blue/10 p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.26em] text-slate-400">Gói đang chọn</div>
                  <div className="mt-2 text-lg font-black text-slate-950 dark:text-white">
                    {selectedPackage?.title || 'Chưa chọn gói'}
                  </div>
                  <div className="mt-1 font-mono text-base font-black text-brand-blue dark:text-cyan-200">
                    {selectedPackage ? formatPriceRange(selectedPackage.price_min_vnd, selectedPackage.price_max_vnd) : '-'}
                  </div>
                </div>

                <label className="block space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Liên hệ</span>
                  <input
                    value={contact}
                    onChange={(event) => setContact(event.target.value)}
                    placeholder="Zalo, Telegram, email hoặc SĐT"
                    className="h-12 w-full rounded-[0.9rem] border border-slate-200/80 bg-white/85 px-4 text-sm font-bold text-slate-950 outline-none transition focus:border-brand-blue/50 focus:ring-4 focus:ring-brand-blue/10 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Domain / web mẫu</span>
                  <input
                    value={desiredDomain}
                    onChange={(event) => setDesiredDomain(event.target.value)}
                    placeholder="Domain muốn dùng hoặc link web tham khảo"
                    className="h-12 w-full rounded-[0.9rem] border border-slate-200/80 bg-white/85 px-4 text-sm font-bold text-slate-950 outline-none transition focus:border-brand-blue/50 focus:ring-4 focus:ring-brand-blue/10 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Nhu cầu</span>
                  <textarea
                    value={requirement}
                    onChange={(event) => setRequirement(event.target.value)}
                    rows={5}
                    placeholder="Mô tả dịch vụ muốn đấu, chức năng cần có, thời gian mong muốn..."
                    className="w-full resize-none rounded-[0.9rem] border border-slate-200/80 bg-white/85 px-4 py-3 text-sm font-semibold leading-7 text-slate-950 outline-none transition focus:border-brand-blue/50 focus:ring-4 focus:ring-brand-blue/10 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
                  />
                </label>

                <Button
                  className="w-full"
                  loading={submitting}
                  loadingText="Đang gửi"
                  onClick={submitOrder}
                  disabled={!selectedPackage}
                >
                  <Send className="h-4 w-4" />
                  Gửi yêu cầu
                </Button>
              </div>
            </section>

            <section className="surface-panel rounded-[1rem] p-5">
              <SectionHeader eyebrow="Lịch sử" title="Đơn dịch vụ web" />
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
                        <span>{order.quoted_price_vnd > 0 ? formatCurrency(order.quoted_price_vnd) : formatPriceRange(order.price_min_vnd, order.price_max_vnd)}</span>
                        <span>{formatDateTime(order.created_at)}</span>
                      </div>
                      {order.admin_note ? (
                        <div className="mt-3 rounded-[0.75rem] border border-cyan-400/20 bg-cyan-400/10 p-3 text-xs font-semibold leading-6 text-cyan-800 dark:text-cyan-100">
                          {order.admin_note}
                        </div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <EmptyState
                    className="py-8"
                    title="Chưa có đơn"
                    description="Yêu cầu đã gửi sẽ được lưu ở đây."
                    icon={<Clock3 className="h-5 w-5" />}
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

function PackageCard({
  pack,
  active,
  onSelect,
}: {
  pack: WebServicePackage;
  active: boolean;
  onSelect: () => void;
}) {
  const meta = categoryMeta[pack.category];
  const Icon = packageIcons[pack.package_key] || meta.icon;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group relative min-h-[19rem] overflow-hidden rounded-[1.25rem] border p-5 text-left transition-all',
        active
          ? 'border-cyan-400/40 bg-[linear-gradient(145deg,rgba(37,99,235,0.14),rgba(14,165,233,0.12),rgba(20,184,166,0.1))] shadow-[0_26px_70px_-46px_rgba(14,165,233,0.78)]'
          : 'border-brand-blue/16 bg-white/86 hover:-translate-y-1 hover:border-cyan-400/30 hover:shadow-[0_24px_70px_-48px_rgba(14,165,233,0.55)] dark:bg-slate-950/48'
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(37,99,235,0.16),transparent_34%),radial-gradient(circle_at_88%_12%,rgba(20,184,166,0.12),transparent_30%)] dark:bg-[radial-gradient(circle_at_15%_10%,rgba(37,99,235,0.28),transparent_34%),radial-gradient(circle_at_88%_12%,rgba(20,184,166,0.2),transparent_30%)]" />
      <div className="relative flex h-full min-h-[16.5rem] flex-col">
        <div className="flex items-start justify-between gap-4">
          <span className={cn('grid h-14 w-14 shrink-0 place-items-center rounded-[1rem] bg-gradient-to-br text-white shadow-[0_20px_44px_-30px_rgba(14,165,233,0.9)]', meta.tone)}>
            <Icon className="h-6 w-6" />
          </span>
          <span className="rounded-full border border-brand-blue/20 bg-brand-blue/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-brand-blue dark:border-cyan-300/20 dark:text-cyan-100">
            {meta.label}
          </span>
        </div>

        <div className="mt-5 min-w-0 flex-1">
          <h3 className="break-words text-xl font-black uppercase leading-tight text-slate-950 dark:text-white">{pack.title}</h3>
          <p className="mt-3 line-clamp-3 text-sm font-semibold leading-7 text-slate-600 dark:text-slate-300">
            {pack.description}
          </p>
        </div>

        <div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 border-t border-slate-200/80 pt-5 dark:border-white/10">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Giá dự kiến</div>
            <div className="mt-2 break-words font-mono text-xl font-black text-brand-blue dark:text-cyan-200">
              {formatPriceRange(pack.price_min_vnd, pack.price_max_vnd)}
            </div>
          </div>
          <span className={cn(
            'inline-flex h-10 w-10 items-center justify-center rounded-full border',
            active
              ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-500'
              : 'border-slate-200/80 bg-white/80 text-slate-400 dark:border-white/10 dark:bg-white/[0.04]'
          )}>
            <CheckCircle2 className="h-5 w-5" />
          </span>
        </div>
      </div>
    </button>
  );
}
