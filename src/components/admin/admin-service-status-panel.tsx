'use client';

import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Loader2, Power, PowerOff, RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SectionHeader, SectionPanel } from '@/components/ui/page-layout';
import { cn } from '@/lib/utils';

interface ServiceStatusItem {
  key: string;
  statusKey: string;
  title: string;
  description: string;
  href: string;
  external: boolean;
  iconKey: string;
  color: string;
  textColor: string;
  status: string;
  enabled: boolean;
}

interface ServiceStatusResponse {
  success: boolean;
  message?: string;
  items?: ServiceStatusItem[];
  stats?: {
    total: number;
    active: number;
    maintenance: number;
  };
}

export function AdminServiceStatusPanel() {
  const [items, setItems] = useState<ServiceStatusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [stats, setStats] = useState<ServiceStatusResponse['stats']>();

  async function loadStatuses() {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/service-statuses', { cache: 'no-store' });
      const payload: ServiceStatusResponse = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể tải trạng thái dịch vụ');
      }
      setItems(payload.items || []);
      setStats(payload.stats);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể tải trạng thái dịch vụ');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatuses();
  }, []);

  async function toggleService(item: ServiceStatusItem) {
    setSavingKey(item.key);
    try {
      const response = await fetch('/api/admin/service-statuses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceKey: item.key,
          enabled: !item.enabled,
        }),
      });
      const payload: ServiceStatusResponse = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể cập nhật trạng thái dịch vụ');
      }
      setItems(payload.items || []);
      setStats(payload.stats);
      toast.success(payload.message || 'Đã cập nhật trạng thái dịch vụ');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể cập nhật trạng thái dịch vụ');
    } finally {
      setSavingKey(null);
    }
  }

  const activeCount = useMemo(() => stats?.active ?? items.filter((item) => item.enabled).length, [items, stats]);
  const maintenanceCount = useMemo(
    () => stats?.maintenance ?? items.filter((item) => !item.enabled).length,
    [items, stats]
  );

  return (
    <SectionPanel className="space-y-5">
      <SectionHeader
        eyebrow="Service Control"
        title="Bật / tắt dịch vụ"
        description="Điều khiển nhanh trạng thái các module đang hiển thị ngoài trang chủ. Tắt dịch vụ sẽ chuyển card về trạng thái Offline ngay sau khi cập nhật."
        actions={
          <>
            <Badge variant="success" className="rounded-full px-3 py-1.5">
              <ShieldCheck className="h-3 w-3" />
              Active {activeCount}
            </Badge>
            <Badge variant="warning" className="rounded-full px-3 py-1.5">
              Offline {maintenanceCount}
            </Badge>
            <Button type="button" size="sm" variant="outline" onClick={() => void loadStatuses()} disabled={loading}>
              <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
              Refresh
            </Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-2">
        {loading ? (
          <div className="col-span-full rounded-[1.45rem] border border-dashed border-slate-200/80 px-4 py-16 text-center text-slate-400 dark:border-white/10">
            <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
            Đang tải trạng thái dịch vụ...
          </div>
        ) : items.map((item) => {
          const saving = savingKey === item.key;
          return (
            <article
              key={item.key}
              className={cn(
                'rounded-[1.5rem] border p-5 transition-all',
                item.enabled
                  ? 'border-emerald-500/20 bg-emerald-500/[0.06]'
                  : 'border-slate-200/80 bg-slate-100/70 dark:border-white/10 dark:bg-white/[0.03]'
              )}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={item.enabled ? 'success' : 'muted'} className="rounded-full px-3 py-1.5">
                      {item.enabled ? 'Open' : 'Offline'}
                    </Badge>
                    <Badge variant="muted" className="rounded-full px-3 py-1.5">
                      {item.statusKey}
                    </Badge>
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-[-0.02em] text-slate-950 dark:text-white">
                      {item.title}
                    </h3>
                    <p className="mt-2 max-w-2xl text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
                      {item.description}
                    </p>
                  </div>
                  <a
                    href={item.href}
                    target={item.external ? '_blank' : undefined}
                    rel={item.external ? 'noreferrer' : undefined}
                    className="inline-flex max-w-full items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500 transition-colors hover:text-brand-blue dark:text-slate-400"
                  >
                    <span className="truncate">{item.href}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  </a>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={item.enabled ? 'outline' : 'default'}
                    loading={saving}
                    loadingText={item.enabled ? 'Đang tắt...' : 'Đang bật...'}
                    onClick={() => void toggleService(item)}
                  >
                    {item.enabled ? <PowerOff className="mr-2 h-4 w-4" /> : <Power className="mr-2 h-4 w-4" />}
                    {item.enabled ? 'Tắt dịch vụ' : 'Bật dịch vụ'}
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </SectionPanel>
  );
}
