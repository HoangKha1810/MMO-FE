'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Cloud,
  Cpu,
  ExternalLink,
  LayoutDashboard,
  Loader2,
  RefreshCcw,
  Search,
  Server,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MetricCard, PageHero, SectionHeader, SectionPanel } from '@/components/ui/page-layout';
import { formatDatabaseDateTime } from '@/lib/date-time';
import { cn, formatCurrency } from '@/lib/utils';
import type { MonitorOrder, MonitorSection, VpsProxyMonitorData } from '@/lib/admin-vps-proxy-monitor';

type SectionKey = 'all' | MonitorSection['key'];

const sectionTabs: Array<{ key: SectionKey; label: string }> = [
  { key: 'all', label: 'Tất cả' },
  { key: 'proxy', label: 'Proxy' },
  { key: 'vps-gpu', label: 'VPS GPU' },
  { key: 'cloud-vps', label: 'Cloud VPS' },
];

function sectionIcon(key: MonitorSection['key']) {
  if (key === 'proxy') return <ShieldCheck className="h-4 w-4" />;
  if (key === 'vps-gpu') return <Cpu className="h-4 w-4" />;
  return <Server className="h-4 w-4" />;
}

function typeLabel(type: MonitorOrder['type']) {
  if (type === 'proxy') return 'Proxy';
  if (type === 'vps-gpu') return 'VPS GPU';
  return 'Cloud VPS';
}

function statusVariant(status: string): 'success' | 'warning' | 'danger' | 'info' | 'muted' {
  const normalized = status.toLowerCase();
  if (['completed', 'complete', 'success', 'done', 'hoàn thành'].includes(normalized)) return 'success';
  if (['pending', 'processing', 'creating', 'running', 'active', 'deletion_pending'].includes(normalized)) return 'info';
  if (['failed', 'error', 'canceled', 'cancelled', 'deleted', 'ended'].includes(normalized)) return 'danger';
  if (['refunded', 'refund'].includes(normalized)) return 'warning';
  return 'muted';
}

function flattenSections(data: VpsProxyMonitorData | null) {
  return (data?.sections || []).flatMap((section) => section.orders);
}

export function AdminVpsProxyMonitorPage() {
  const [data, setData] = useState<VpsProxyMonitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<SectionKey>('all');
  const [search, setSearch] = useState('');

  async function loadData(background = false) {
    if (background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const response = await fetch('/api/admin/vps-proxy-monitor', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-store' },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không tải được giám sát VPS/Proxy');
      }
      setData(payload.data as VpsProxyMonitorData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được giám sát VPS/Proxy');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => void loadData(true), 15000);
    return () => window.clearInterval(interval);
  }, []);

  const filteredOrders = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return flattenSections(data).filter((order) => {
      if (activeTab !== 'all' && order.type !== activeTab) return false;
      if (!keyword) return true;

      return [
        order.code,
        order.username,
        order.title,
        order.status,
        order.detail,
        order.note,
        String(order.userId || ''),
      ].join(' ').toLowerCase().includes(keyword);
    });
  }, [activeTab, data, search]);

  const activeSections = useMemo(() => {
    if (!data) return [];
    return activeTab === 'all'
      ? data.sections
      : data.sections.filter((section) => section.key === activeTab);
  }, [activeTab, data]);

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Operations Monitor"
        title="Giám sát đơn VPS và Proxy"
        description="Theo dõi nhanh đơn proxy, VPS GPU và Cloud VPS portal trong một màn hình admin để support biết đơn nào đang xử lý, đơn nào đã xong và tổng tiền đã ghi nhận."
        stats={[
          { label: 'Tổng đơn', value: String(data?.stats.total || 0), hint: 'Proxy + VPS', tone: 'blue' },
          { label: 'Đang chạy', value: String(data?.stats.active || 0), hint: 'Active / processing', tone: 'emerald' },
          { label: 'Chờ xử lý', value: String(data?.stats.pending || 0), hint: 'Pending / creating', tone: 'amber' },
          { label: 'Doanh thu', value: formatCurrency(data?.stats.revenue || 0), hint: 'Theo dữ liệu local/API', tone: 'violet' },
        ]}
        actions={
          <>
            <Button asChild type="button" variant="outline">
              <Link href="/vps/dashboard" target="_blank" rel="noreferrer">
                <LayoutDashboard className="mr-2 h-4 w-4" />
                Dashboard VPS
              </Link>
            </Button>
            <Button asChild type="button" variant="outline">
              <Link href="/vps/admin" target="_blank" rel="noreferrer">
                <Server className="mr-2 h-4 w-4" />
                Admin VPS
              </Link>
            </Button>
            <Badge variant={error ? 'danger' : refreshing ? 'info' : 'muted'} className="rounded-full px-3 py-1.5">
              {error ? 'Có lỗi tải dữ liệu' : refreshing ? 'Đang cập nhật' : `Cập nhật ${data?.updatedAt ? formatDatabaseDateTime(data.updatedAt) : '—'}`}
            </Badge>
            <Button type="button" variant="outline" onClick={() => void loadData(true)} disabled={loading || refreshing}>
              {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              Làm mới
            </Button>
          </>
        }
      />

      {error ? (
        <div className="rounded-[1rem] border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-600 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Proxy" value={String(data?.stats.proxy || 0)} hint="Đơn proxy local" tone="blue" icon={<ShieldCheck className="h-4 w-4" />} />
        <MetricCard label="VPS GPU" value={String(data?.stats.vpsGpu || 0)} hint="Instance GPU billing" tone="violet" icon={<Cpu className="h-4 w-4" />} />
        <MetricCard label="Cloud VPS" value={String(data?.stats.cloudVps || 0)} hint="Portal tích hợp" tone="emerald" icon={<Server className="h-4 w-4" />} />
      </div>

      <SectionPanel className="space-y-5">
        <SectionHeader
          eyebrow="Filters"
          title="Danh sách đơn"
          description="Lọc theo loại đơn hoặc tìm theo user web, mã đơn, trạng thái và ghi chú."
          actions={
            <div className="relative min-w-[280px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm username, mã đơn..."
                className="pl-10"
              />
            </div>
          }
        />

        <div className="flex flex-wrap gap-2">
          {sectionTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition-all',
                activeTab === tab.key
                  ? 'border-brand-blue bg-brand-blue text-white'
                  : 'surface-chip text-slate-500 dark:text-slate-300'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeSections.some((section) => section.warning) ? (
          <div className="space-y-2">
            {activeSections.filter((section) => section.warning).map((section) => (
              <div key={section.key} className="flex gap-3 rounded-[1rem] border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-700 dark:text-amber-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <span className="font-black">{section.title}:</span> {section.warning}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 dark:border-white/10">
                <th className="px-3 py-3">Loại</th>
                <th className="px-3 py-3">Mã đơn</th>
                <th className="px-3 py-3">User web</th>
                <th className="px-3 py-3">Dịch vụ</th>
                <th className="px-3 py-3">SL</th>
                <th className="px-3 py-3">Tổng tiền</th>
                <th className="px-3 py-3">Trạng thái</th>
                <th className="px-3 py-3">Chi tiết</th>
                <th className="px-3 py-3">Tạo lúc</th>
                <th className="px-3 py-3">Nguồn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/10">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-3 py-16 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-brand-blue" />
                    <div className="mt-3 text-xs font-black uppercase tracking-[0.2em] text-slate-400">Đang tải giám sát</div>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-16 text-center text-sm font-bold text-slate-400">
                    Chưa có đơn phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="align-top transition-colors hover:bg-slate-50/70 dark:hover:bg-white/[0.03]">
                    <td className="px-3 py-4">
                      <Badge variant={order.type === 'proxy' ? 'info' : order.type === 'vps-gpu' ? 'purple' : 'success'} className="rounded-full px-3 py-1.5">
                        {typeLabel(order.type)}
                      </Badge>
                    </td>
                    <td className="px-3 py-4 font-mono text-xs font-black text-slate-700 dark:text-slate-200">{order.code}</td>
                    <td className="px-3 py-4">
                      <div className="font-black text-slate-950 dark:text-white">{order.username}</div>
                      {order.userId ? <div className="mt-1 font-mono text-xs font-semibold text-slate-400">#{order.userId}</div> : null}
                    </td>
                    <td className="px-3 py-4 max-w-[220px]">
                      <div className="font-black text-slate-950 dark:text-white">{order.title}</div>
                      {order.note ? <div className="mt-1 line-clamp-2 text-xs font-semibold text-slate-400">{order.note}</div> : null}
                    </td>
                    <td className="px-3 py-4 font-mono font-black">{order.quantity}</td>
                    <td className="px-3 py-4 font-mono font-black text-brand-blue">{formatCurrency(order.amount)}</td>
                    <td className="px-3 py-4">
                      <Badge variant={statusVariant(order.status)} className="rounded-full px-3 py-1.5">
                        {order.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-4 max-w-[320px] text-xs font-semibold leading-6 text-slate-500 dark:text-slate-300">
                      {order.detail || '—'}
                    </td>
                    <td className="px-3 py-4 font-mono text-xs font-semibold text-slate-500 dark:text-slate-300">
                      {order.createdAt ? formatDatabaseDateTime(order.createdAt) : '—'}
                    </td>
                    <td className="px-3 py-4">
                      {order.href ? (
                        <Button asChild size="sm" variant="outline" className="px-3">
                          <Link href={order.href}>
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Mở
                          </Link>
                        </Button>
                      ) : (
                        <Cloud className="h-4 w-4 text-slate-400" />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionPanel>
    </div>
  );
}
