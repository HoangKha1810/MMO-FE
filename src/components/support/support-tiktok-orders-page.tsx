'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, Plus, RefreshCw, Repeat2 } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { useSessionUser } from '@/hooks/use-session-user';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHero, SectionHeader, SectionPanel } from '@/components/ui/page-layout';
import { formatCurrency, toNumber } from '@/lib/utils';

interface TikTokOrder {
  id: number;
  username?: string;
  region?: string;
  service_key?: string;
  service_name?: string;
  tiktok_id?: string;
  buyer_name?: string;
  buyer_contact?: string;
  price?: number | string;
  status?: string;
  ngay_gia_han?: string;
  ngay_het_han?: string;
  created_at?: string;
}

interface TikTokService {
  id: number;
  region_slug?: string;
  name?: string;
  service_key?: string;
  price?: number | string;
  description?: string;
}

export function SupportTiktokOrdersPage() {
  const currentUser = useSessionUser();
  const user = currentUser.data;
  const [orders, setOrders] = useState<TikTokOrder[]>([]);
  const [services, setServices] = useState<TikTokService[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    region: '',
    service_key: '',
    tiktok_id: '',
    buyer_name: '',
    buyer_contact: '',
  });

  const filteredServices = useMemo(
    () => services.filter((service) => !form.region || service.region_slug === form.region),
    [form.region, services]
  );
  const regions = useMemo(() => Array.from(new Set(services.map((service) => service.region_slug).filter(Boolean))), [services]);
  const selectedService = services.find((service) => service.region_slug === form.region && service.service_key === form.service_key);
  const selectedPrice = toNumber(selectedService?.price, 0);
  const selectedPriceLabel = selectedService ? formatCurrency(selectedPrice) : services.length > 0 ? 'Chọn dịch vụ' : 'Chưa có đơn giá';
  const canCreateOrder = Boolean(selectedService && selectedPrice > 0 && form.region && form.service_key && form.tiktok_id.trim());

  async function loadOrders() {
    setLoading(true);
    setError('');
    const response = await fetch('/api/support-tiktok/orders', { cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok || !payload.success) {
      setError(payload.message || 'Không tải được đơn Support TikTok');
      return;
    }

    const nextServices = Array.isArray(payload.data?.services) ? payload.data.services : [];
    setOrders(Array.isArray(payload.data?.orders) ? payload.data.orders : []);
    setServices(nextServices);
    setForm((current) => ({
      ...current,
      region: current.region || String(nextServices[0]?.region_slug || ''),
      service_key: current.service_key || String(nextServices[0]?.service_key || ''),
    }));
  }

  useEffect(() => {
    void loadOrders();
  }, []);

  useEffect(() => {
    if (!form.region || filteredServices.length === 0) {
      return;
    }

    const hasSelectedService = filteredServices.some((service) => String(service.service_key) === form.service_key);
    if (hasSelectedService) {
      return;
    }

    setForm((current) => ({ ...current, service_key: String(filteredServices[0]?.service_key || '') }));
  }, [filteredServices, form.region, form.service_key]);

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedService || selectedPrice <= 0) {
      setError('Chọn dịch vụ có đơn giá hợp lệ trước khi tạo đơn.');
      return;
    }

    setSubmitting(true);
    setError('');
    setMessage('');
    const response = await fetch('/api/support-tiktok/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', ...form }),
    });
    const payload = await response.json().catch(() => ({}));
    setSubmitting(false);
    if (!response.ok || !payload.success) {
      setError(payload.message || 'Không tạo được đơn TikTok');
      return;
    }
    setMessage(payload.message || 'Đã tạo đơn TikTok');
    setForm((current) => ({ ...current, tiktok_id: '', buyer_name: '', buyer_contact: '' }));
    await loadOrders();
  }

  async function renewOrder(orderId: number) {
    setError('');
    setMessage('');
    const response = await fetch('/api/support-tiktok/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'renew', order_id: orderId }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.success) {
      setError(payload.message || 'Không gia hạn được đơn TikTok');
      return;
    }
    setMessage(payload.message || 'Đã gia hạn đơn TikTok');
    await loadOrders();
  }

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <PageHero
          eyebrow="Support TikTok"
          title="Đặt và gia hạn dịch vụ Support TikTok"
          description="Tạo đơn theo khu vực, chọn đúng gói dịch vụ, theo dõi thời hạn và gia hạn ngay trong cùng một module dành cho khách hàng TikTok."
          stats={[
            { label: 'Đơn', value: String(orders.length), hint: 'Đang hiển thị', tone: 'blue' },
            { label: 'Dịch vụ', value: String(services.length), hint: 'Menu/region đang active', tone: 'emerald' },
            { label: 'Số dư', value: formatCurrency(user?.balance || 0), hint: 'Tài khoản hiện tại', tone: 'amber' },
            { label: 'Gia hạn', value: '30 ngày', hint: 'Chu kỳ tiêu chuẩn', tone: 'violet' },
          ]}
          actions={
            <>
              <Link href="/user/support-tiktok" className="surface-chip rounded-full px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-600 dark:text-slate-200">Chat support</Link>
              <Button type="button" variant="outline" onClick={() => void loadOrders()} loading={loading} loadingText="Đang tải...">
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </>
          }
        />

        {error ? <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-500">{error}</div> : null}
        {message ? <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-500">{message}</div> : null}

        <SectionPanel className="space-y-5">
          <SectionHeader eyebrow="Create" title="Tạo đơn mới" description="Chọn khu vực và gói dịch vụ phù hợp để hệ thống tính giá chính xác trước khi tạo đơn." />
          <form onSubmit={createOrder} className="grid gap-3 lg:grid-cols-5">
            <select
              value={form.region}
              onChange={(event) => setForm((current) => ({ ...current, region: event.target.value, service_key: '' }))}
              className="field-elevated h-12 rounded-[1rem] px-4 text-sm font-bold text-slate-900 dark:text-white"
              required
            >
              <option value="">Chọn region</option>
              {regions.map((region) => <option key={region} value={region}>{region}</option>)}
            </select>
            <select
              value={form.service_key}
              onChange={(event) => setForm((current) => ({ ...current, service_key: event.target.value }))}
              className="field-elevated h-12 rounded-[1rem] px-4 text-sm font-bold text-slate-900 dark:text-white lg:col-span-2"
              disabled={filteredServices.length === 0}
              required
            >
              <option value="">{filteredServices.length === 0 ? 'Region này chưa có đơn giá' : 'Chọn dịch vụ'}</option>
              {filteredServices.map((service) => (
                <option key={String(service.id)} value={String(service.service_key)}>{service.name} - {formatCurrency(toNumber(service.price, 0))}</option>
              ))}
            </select>
            <Input value={form.tiktok_id} onChange={(event) => setForm((current) => ({ ...current, tiktok_id: event.target.value }))} placeholder="@tiktok hoặc ID" required />
            <Button type="submit" loading={submitting} loadingText="Đang tạo..." disabled={!canCreateOrder}>
              <Plus className="mr-2 h-4 w-4" />
              Tạo đơn
            </Button>
            <div className="rounded-[1.25rem] border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 lg:col-span-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
                    Đơn giá đang chọn
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-300">
                    Giá này được trừ trực tiếp khi tạo đơn, admin có thể chỉnh trong bảng dịch vụ TikTok.
                  </div>
                </div>
                <span className="font-mono text-2xl font-black text-emerald-500">{selectedPriceLabel}</span>
              </div>
            </div>
            <Input value={form.buyer_name} onChange={(event) => setForm((current) => ({ ...current, buyer_name: event.target.value }))} placeholder="Tên người mua" />
            <Input value={form.buyer_contact} onChange={(event) => setForm((current) => ({ ...current, buyer_contact: event.target.value }))} placeholder="Zalo/SĐT liên hệ" className="lg:col-span-2" />
          </form>
          <div className="rounded-[1.4rem] border border-cyan-400/20 bg-cyan-500/10 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-600 dark:text-cyan-300">
                  Bảng đơn giá
                </div>
                <div className="mt-1 text-sm font-bold text-slate-600 dark:text-slate-300">
                  Chọn region và dịch vụ, hệ thống sẽ tính đúng đơn giá trước khi tạo đơn.
                </div>
              </div>
              <div className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-right">
                <div className="text-[9px] font-black uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
                  Đang chọn
                </div>
                <div className="font-mono text-lg font-black text-emerald-600 dark:text-emerald-300">
                  {selectedService ? formatCurrency(selectedPrice) : 'Chưa chọn'}
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredServices.length === 0 ? (
                <div className="rounded-[1rem] border border-dashed border-slate-200 px-4 py-6 text-center text-sm font-bold text-slate-400 dark:border-white/10">
                  Region này chưa có đơn giá.
                </div>
              ) : (
                filteredServices.map((service) => {
                  const active = String(service.service_key) === form.service_key;
                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, service_key: String(service.service_key || '') }))}
                      className={`rounded-[1rem] border p-4 text-left transition ${
                        active
                          ? 'border-brand-blue/40 bg-brand-blue/10 shadow-[0_0_0_3px_rgba(37,99,235,0.12)]'
                          : 'border-slate-200 bg-white/60 hover:border-brand-blue/25 dark:border-white/10 dark:bg-white/[0.03]'
                      }`}
                    >
                      <div className="line-clamp-2 min-h-[2.5rem] text-sm font-black uppercase tracking-tight text-slate-950 dark:text-white">
                        {service.name || service.service_key}
                      </div>
                      <div className="mt-3 font-mono text-xl font-black text-emerald-500">
                        {formatCurrency(toNumber(service.price, 0))}
                      </div>
                      {service.description ? (
                        <div className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">
                          {service.description}
                        </div>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </SectionPanel>

        <SectionPanel className="space-y-5">
          <SectionHeader eyebrow="Orders" title="Danh sách đơn Support TikTok" description="Theo dõi tình trạng từng đơn, ngày hết hạn và thao tác gia hạn ngay khi cần duy trì dịch vụ." />
          {loading ? (
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 p-6 text-sm font-bold text-slate-500 dark:border-white/10">
              <Loader2 className="h-5 w-5 animate-spin" />
              Đang tải đơn...
            </div>
          ) : orders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm font-bold text-slate-400 dark:border-white/10">Chưa có đơn TikTok.</div>
          ) : (
            <div className="grid gap-3">
              {orders.map((order) => (
                <div key={order.id} className="surface-card grid gap-4 rounded-[1.5rem] p-5 lg:grid-cols-[minmax(0,1fr)_170px_150px] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="info">#{order.id}</Badge>
                      <Badge variant={String(order.status).toLowerCase() === 'active' ? 'success' : 'muted'}>{order.status || 'pending'}</Badge>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{order.region}</span>
                    </div>
                    <h3 className="mt-3 text-lg font-black uppercase text-slate-950 dark:text-white">{order.service_name || order.service_key}</h3>
                    <p className="mt-1 text-sm font-semibold leading-7 text-slate-500 dark:text-slate-400">
                      TikTok: <span className="font-black text-slate-800 dark:text-white">{order.tiktok_id}</span> · Hết hạn: {order.ngay_het_han ? new Date(order.ngay_het_han).toLocaleDateString('vi-VN') : 'chưa có'}
                    </p>
                  </div>
                  <div className="font-mono text-xl font-black text-emerald-500">{formatCurrency(toNumber(order.price, 0))}</div>
                  <Button type="button" variant="outline" onClick={() => void renewOrder(order.id)}>
                    <Repeat2 className="mr-2 h-4 w-4" />
                    Gia hạn
                  </Button>
                </div>
              ))}
            </div>
          )}
        </SectionPanel>
      </div>
    </AppShell>
  );
}
