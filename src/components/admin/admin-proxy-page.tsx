'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Cloud,
  Loader2,
  RefreshCcw,
  Save,
  Server,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, MetricCard, PageHero, SectionHeader, SectionPanel } from '@/components/ui/page-layout';
import { formatDatabaseDateTime } from '@/lib/date-time';
import { formatCurrency } from '@/lib/utils';
import type { ProxyAdminDashboardData, ProxyPackageRecord } from '@/types/proxy';

type PackageDraft = ProxyPackageRecord;

function formatLocation(value: string) {
  if (value === 'residential') return 'Residential';
  if (value === 'datacenter') return 'Datacenter';
  return value || 'Khác';
}

export function AdminProxyPage() {
  const [data, setData] = useState<ProxyAdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locationFilter, setLocationFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [serviceStatus, setServiceStatus] = useState<'active' | 'maintenance'>('active');
  const [serviceName, setServiceName] = useState('');
  const [serviceDescription, setServiceDescription] = useState('');
  const [serviceNote, setServiceNote] = useState('');
  const [defaultProtocol, setDefaultProtocol] = useState<'HTTP' | 'SOCKS5'>('HTTP');
  const [priceMultiplier, setPriceMultiplier] = useState('1.2');
  const [packageDrafts, setPackageDrafts] = useState<PackageDraft[]>([]);

  function syncDraftState(payload: ProxyAdminDashboardData) {
    setData(payload);
    setServiceStatus(payload.settings.serviceStatus === 'maintenance' ? 'maintenance' : 'active');
    setServiceName(payload.settings.serviceName || '');
    setServiceDescription(payload.settings.serviceDescription || '');
    setServiceNote(payload.settings.serviceNote || '');
    setDefaultProtocol(payload.settings.defaultProtocol || 'HTTP');
    setPriceMultiplier(String(payload.settings.priceMultiplier || 1.2));
    setPackageDrafts(payload.packages || []);
  }

  async function loadDashboard(showToast = false) {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/proxy', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-store' },
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể tải dashboard proxy');
      }
      syncDraftState(payload.data as ProxyAdminDashboardData);
      if (showToast) {
        toast.success('Đã làm mới dữ liệu proxy');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể tải dashboard proxy');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const filteredPackages = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return packageDrafts.filter((item) => {
      if (locationFilter !== 'all' && item.location !== locationFilter) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      return `${item.name} ${item.label} ${item.type} ${item.location}`.toLowerCase().includes(keyword);
    });
  }, [locationFilter, packageDrafts, search]);

  function updatePackageDraft(id: string, patch: Partial<PackageDraft>) {
    setPackageDrafts((current) =>
      current.map((item) => item.id === id ? { ...item, ...patch } : item)
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      const packagePricing = packageDrafts.length > 0
        ? Object.fromEntries(
            packageDrafts.map((item) => [
              item.id,
              {
                enabled: item.enabled,
                sellPricePerDay: Number(item.sellPricePerDay || 0),
                renewPricePerDay: Number(item.renewPricePerDay || 0),
                label: item.label || '',
                note: item.note || '',
              },
            ])
          )
        : (data?.settings.packagePricing || {});

      const response = await fetch('/api/admin/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceStatus,
          serviceName,
          serviceDescription,
          serviceNote,
          defaultProtocol,
          priceMultiplier: Number(priceMultiplier || 1.2),
          packagePricing,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể lưu cấu hình proxy');
      }
      toast.success('Đã lưu cấu hình proxy');
      await loadDashboard();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể lưu cấu hình proxy');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Proxy Admin"
        title="Cấu hình dịch vụ proxy và giá bán theo package"
        description="Module này đọc token từ env, tải package trực tiếp từ vendor và cho phép admin cấu hình giá bán / ngày, giá gia hạn / ngày cùng trạng thái hiển thị của dịch vụ proxy."
        stats={[
          { label: 'Package', value: String(data?.stats.totalPackages || 0), hint: 'Tổng package đọc từ vendor', tone: 'blue' },
          { label: 'Đang bật', value: String(data?.stats.enabledPackages || 0), hint: 'Package đang cho phép bán', tone: 'emerald' },
          { label: 'Proxy local', value: String(data?.stats.totalOwned || 0), hint: 'Proxy đã lưu trong hệ thống', tone: 'amber' },
          { label: 'Đơn proxy', value: String(data?.stats.totalOrders || 0), hint: 'Đơn mua + gia hạn đã ghi nhận', tone: 'violet' },
        ]}
        actions={
          <>
            <Badge variant={data?.settings.envConfigured ? 'success' : 'danger'} className="rounded-full px-3 py-1.5">
              {data?.settings.envConfigured ? 'Token env sẵn sàng' : 'Thiếu PROXY_VNCLOUD_TOKEN'}
            </Badge>
            <Button type="button" variant="outline" onClick={() => void loadDashboard(true)} disabled={loading}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Làm mới
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <SectionPanel className="space-y-5">
          <SectionHeader
            eyebrow="General Config"
            title="Cấu hình chung"
            description="Bật/tắt module proxy, chỉnh nội dung hiển thị ngoài user page và hệ số markup mặc định để gợi ý giá bán."
          />

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="block text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Trạng thái</span>
              <select
                value={serviceStatus}
                onChange={(event) => setServiceStatus(event.target.value === 'maintenance' ? 'maintenance' : 'active')}
                className="field-elevated h-11 w-full rounded-[1rem] px-4 text-sm font-semibold text-slate-900 outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10 dark:text-white"
              >
                <option value="active">Active</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className="block text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Protocol mặc định</span>
              <select
                value={defaultProtocol}
                onChange={(event) => setDefaultProtocol(event.target.value === 'SOCKS5' ? 'SOCKS5' : 'HTTP')}
                className="field-elevated h-11 w-full rounded-[1rem] px-4 text-sm font-semibold text-slate-900 outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10 dark:text-white"
              >
                <option value="HTTP">HTTP</option>
                <option value="SOCKS5">SOCKS5</option>
              </select>
            </label>
          </div>

          <label className="space-y-2">
            <span className="block text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Tên dịch vụ</span>
            <Input value={serviceName} onChange={(event) => setServiceName(event.target.value)} />
          </label>

          <label className="space-y-2">
            <span className="block text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Mô tả ngắn</span>
            <textarea
              rows={3}
              value={serviceDescription}
              onChange={(event) => setServiceDescription(event.target.value)}
              className="field-elevated w-full rounded-[1rem] px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10 dark:text-white"
            />
          </label>

          <label className="space-y-2">
            <span className="block text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Ghi chú hiển thị</span>
            <textarea
              rows={4}
              value={serviceNote}
              onChange={(event) => setServiceNote(event.target.value)}
              className="field-elevated w-full rounded-[1rem] px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10 dark:text-white"
            />
          </label>

          <label className="space-y-2">
            <span className="block text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Markup mặc định</span>
            <Input type="number" min="1" step="0.05" value={priceMultiplier} onChange={(event) => setPriceMultiplier(event.target.value)} />
            <p className="text-xs font-semibold leading-6 text-slate-500 dark:text-slate-400">
              Giá gợi ý sẽ được tính theo công thức: `vendor price / duration_days * markup`. Bạn có thể ghi đè trực tiếp từng package ở bảng bên dưới.
            </p>
          </label>

          <div className="flex justify-end">
            <Button type="button" onClick={handleSave} disabled={saving} loading={saving} loadingText="Đang lưu...">
              <Save className="mr-2 h-4 w-4" />
              Lưu cấu hình proxy
            </Button>
          </div>
        </SectionPanel>

        <div className="space-y-4">
          <MetricCard
            label="Số dư vendor"
            value={data?.profile ? formatCurrency(data.profile.cash) : '—'}
            hint="Số dư đọc từ /profile của tài khoản proxy."
            tone="blue"
            icon={<Wallet className="h-4 w-4" />}
          />
          <MetricCard
            label="Chiết khấu"
            value={data?.profile ? `${data.profile.discount}%` : '—'}
            hint="Chiết khấu vendor hiện tại nếu API cung cấp."
            tone="emerald"
            icon={<ShieldCheck className="h-4 w-4" />}
          />

          <Card>
            <CardHeader>
              <CardTitle>Vendor Profile</CardTitle>
              <CardDescription>Thông tin tài khoản proxy đang hoạt động qua token env.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!data?.settings.envConfigured ? (
                <EmptyState
                  title="Chưa có token env"
                  description="Hãy thêm PROXY_VNCLOUD_TOKEN vào env để hệ thống có thể tải package và đọc profile vendor."
                  icon={<ShieldCheck className="h-5 w-5" />}
                />
              ) : !data?.profile ? (
                <div className="rounded-[1.2rem] border border-amber-500/20 bg-amber-500/10 px-4 py-4 text-sm font-semibold leading-7 text-amber-700 dark:text-amber-300">
                  Chưa đọc được profile vendor. Hãy kiểm tra lại token hoặc khả năng kết nối tới API proxy.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-[1.15rem] bg-slate-50 px-4 py-3 dark:bg-white/[0.04]">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Tên</div>
                    <div className="mt-2 text-sm font-black text-slate-950 dark:text-white">{data.profile.name || '—'}</div>
                  </div>
                  <div className="rounded-[1.15rem] bg-slate-50 px-4 py-3 dark:bg-white/[0.04]">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Email</div>
                    <div className="mt-2 text-sm font-black text-slate-950 dark:text-white">{data.profile.email || '—'}</div>
                  </div>
                  <div className="rounded-[1.15rem] bg-slate-50 px-4 py-3 dark:bg-white/[0.04]">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Role</div>
                    <div className="mt-2 text-sm font-black text-slate-950 dark:text-white">{data.profile.role || '—'}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <SectionPanel className="space-y-5">
        <SectionHeader
          eyebrow="Package Pricing"
          title="Giá bán theo package"
          description="Mỗi package có thể bật/tắt riêng, chỉnh giá bán / ngày, giá gia hạn / ngày, badge và ghi chú hiển thị bên user page."
          actions={
            <div className="flex flex-wrap gap-2">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm package..."
                className="w-[220px]"
              />
              {[
                { key: 'all', label: 'Tất cả' },
                { key: 'residential', label: 'Residential' },
                { key: 'datacenter', label: 'Datacenter' },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setLocationFilter(item.key)}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] transition-all ${
                    locationFilter === item.key
                      ? 'border-brand-blue bg-brand-blue text-white'
                      : 'border-slate-200/80 bg-white/80 text-slate-500 hover:border-brand-blue/25 hover:text-brand-blue dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          }
        />

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="mr-3 h-5 w-5 animate-spin" />
            Đang tải package proxy
          </div>
        ) : filteredPackages.length === 0 ? (
          <EmptyState
            title="Chưa có package nào"
            description="Hệ thống chưa đọc được package từ vendor hoặc không có package phù hợp với bộ lọc hiện tại."
            icon={<Cloud className="h-5 w-5" />}
          />
        ) : (
          <div className="grid gap-4">
            {filteredPackages.map((item) => (
              <article
                key={item.id}
                className="rounded-[1.45rem] border border-slate-200/80 bg-white/78 p-5 dark:border-white/10 dark:bg-white/[0.035]"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-brand-blue/15 bg-brand-blue/10 text-brand-blue">
                        {item.location === 'datacenter' ? <Server className="h-5 w-5" /> : <Cloud className="h-5 w-5" />}
                      </div>
                      <div className="text-lg font-black uppercase leading-[1.1] tracking-[-0.03em] text-slate-950 dark:text-white">
                        {item.name}
                      </div>
                      <Badge variant="info" className="rounded-full px-3 py-1.5">{formatLocation(item.location)}</Badge>
                      <Badge variant="muted" className="rounded-full px-3 py-1.5">{item.type}</Badge>
                    </div>
                    <div className="mt-3 text-sm font-semibold leading-7 text-slate-500 dark:text-slate-400">
                      Vendor `{formatCurrency(item.providerPrice)}` / {item.durationDays} ngày • gợi ý `{formatCurrency(item.suggestedPricePerDay)}` / ngày • tối thiểu {item.minDays} ngày • tối đa {item.maxQuantity} proxy
                    </div>
                  </div>

                  <label className="inline-flex items-center gap-3 rounded-full border border-slate-200/80 bg-slate-50 px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={(event) => updatePackageDraft(item.id, { enabled: event.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue/30"
                    />
                    Bật package
                  </label>
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-[repeat(5,minmax(0,1fr))]">
                  <label className="space-y-2">
                    <span className="block text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Giá bán / ngày</span>
                    <Input
                      type="number"
                      min="0"
                      value={String(item.sellPricePerDay)}
                      onChange={(event) => updatePackageDraft(item.id, { sellPricePerDay: Number(event.target.value || 0) })}
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="block text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Giá gia hạn / ngày</span>
                    <Input
                      type="number"
                      min="0"
                      value={String(item.renewPricePerDay)}
                      onChange={(event) => updatePackageDraft(item.id, { renewPricePerDay: Number(event.target.value || 0) })}
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="block text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Badge</span>
                    <Input value={item.label} onChange={(event) => updatePackageDraft(item.id, { label: event.target.value })} placeholder="Ví dụ: Hot / VN IP" />
                  </label>
                  <label className="space-y-2 xl:col-span-2">
                    <span className="block text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Ghi chú hiển thị</span>
                    <Input value={item.note} onChange={(event) => updatePackageDraft(item.id, { note: event.target.value })} placeholder="Hiển thị mô tả ngắn tại card bên user" />
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => updatePackageDraft(item.id, {
                      sellPricePerDay: item.suggestedPricePerDay,
                      renewPricePerDay: item.suggestedPricePerDay,
                    })}
                  >
                    Dùng giá gợi ý
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => updatePackageDraft(item.id, {
                      label: '',
                      note: '',
                    })}
                  >
                    Xóa badge / note
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionPanel>

      <SectionPanel className="space-y-5">
        <SectionHeader
          eyebrow="Recent Orders"
          title="Đơn proxy gần nhất"
          description="Theo dõi những đơn mua mới và gia hạn đã đi qua hệ thống để kiểm tra sức mua và tình trạng xử lý."
        />

        {!data || data.orders.length === 0 ? (
          <EmptyState
            title="Chưa có đơn proxy"
            description="Khi user bắt đầu mua hoặc gia hạn proxy, đơn sẽ hiển thị tại đây."
            icon={<Cloud className="h-5 w-5" />}
          />
        ) : (
          <div className="grid gap-3">
            {data.orders.map((order) => (
              <div
                key={order.id}
                className="grid gap-4 rounded-[1.35rem] border border-slate-200/80 bg-white/75 p-4 dark:border-white/10 dark:bg-white/[0.035] md:grid-cols-[150px_minmax(0,1fr)_150px]"
              >
                <div className="flex items-center gap-2">
                  <Badge variant={order.kind === 'renew' ? 'warning' : 'info'} className="rounded-full px-3 py-1.5">
                    {order.kind === 'renew' ? 'Gia hạn' : 'Mua mới'}
                  </Badge>
                  <Badge variant={order.status === 'completed' ? 'success' : order.status === 'partial' ? 'warning' : 'muted'} className="rounded-full px-3 py-1.5">
                    {order.status}
                  </Badge>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-black uppercase tracking-[0.04em] text-slate-950 dark:text-white">
                    {order.packageName || `Proxy order #${order.id}`}
                  </div>
                  <div className="mt-2 text-xs font-semibold leading-6 text-slate-500 dark:text-slate-400">
                    {formatLocation(order.location)} • {order.quantity} proxy • {order.days} ngày • {formatDatabaseDateTime(order.createdAt)}
                  </div>
                  {order.note ? (
                    <div className="mt-2 text-xs font-semibold leading-6 text-slate-500 dark:text-slate-400">{order.note}</div>
                  ) : null}
                </div>
                <div className="flex items-center justify-end text-right">
                  <div>
                    <div className="text-sm font-black text-brand-blue">{formatCurrency(order.totalPrice)}</div>
                    <div className="mt-1 text-xs font-semibold text-slate-400">{formatCurrency(order.unitPrice)} / ngày</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionPanel>
    </div>
  );
}
