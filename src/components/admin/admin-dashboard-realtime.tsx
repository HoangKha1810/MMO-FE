'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  Activity,
  AlertTriangle,
  Banknote,
  ChevronDown,
  Crown,
  DatabaseZap,
  FileWarning,
  Filter,
  LockKeyhole,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  TrendingUp,
  Users,
  WalletCards,
} from 'lucide-react';
import { formatDatabaseDateTime } from '@/lib/date-time';
import { cn } from '@/lib/utils';
import type { AdminDashboardStats, AdminPeriodStats } from '@/lib/admin-dashboard-stats';

interface AdminDashboardRealtimeProps {
  initialStats: AdminDashboardStats;
}

function money(value: number) {
  return `${new Intl.NumberFormat('vi-VN').format(Math.floor(value || 0))}đ`;
}

function number(value: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.floor(value || 0));
}

function percent(value: number) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function extractActivityAction(activity: string) {
  const value = String(activity || '').trim();
  if (!value) return 'system';

  const parts = value.split(':').map((part) => part.trim()).filter(Boolean);
  if (parts[0] === 'admin_ai' && parts[1]) {
    return `admin_ai:${parts[1]}`;
  }
  if (parts[0] === 'Cron task' && parts[1]) {
    return `cron:${parts[1]}`;
  }
  if (parts.length > 1) {
    return parts[0];
  }
  return value.split(/\s+/).slice(0, 4).join(' ');
}

export function AdminDashboardRealtime({ initialStats }: AdminDashboardRealtimeProps) {
  const [stats, setStats] = useState(initialStats);
  const [isPending, startTransition] = useTransition();
  const [lastError, setLastError] = useState('');
  const [activityFilter, setActivityFilter] = useState('all');
  const [expandedActivityId, setExpandedActivityId] = useState<number | null>(null);

  async function refreshStats(silent = false) {
    try {
      const response = await fetch('/api/admin/dashboard', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-store' },
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể tải dashboard realtime');
      }
      startTransition(() => {
        setStats(payload.data);
        setLastError('');
      });
    } catch (error) {
      if (!silent) {
        setLastError(error instanceof Error ? error.message : 'Không thể tải dashboard realtime');
      }
    }
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshStats(true);
      }
    }, 20000);

    return () => window.clearInterval(timer);
  }, []);

  const { pulse, statsToday, stats7d, stats30d, topUsers, activityLogs } = stats;
  const activityActions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const log of activityLogs) {
      const action = extractActivityAction(log.activity);
      counts.set(action, (counts.get(action) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count || a.action.localeCompare(b.action));
  }, [activityLogs]);
  const filteredActivityLogs = useMemo(() => {
    if (activityFilter === 'all') return activityLogs;
    return activityLogs.filter((log) => extractActivityAction(log.activity) === activityFilter);
  }, [activityFilter, activityLogs]);

  useEffect(() => {
    if (activityFilter !== 'all' && !activityActions.some((item) => item.action === activityFilter)) {
      setActivityFilter('all');
      setExpandedActivityId(null);
    }
  }, [activityActions, activityFilter]);

  const pulseCards = [
    {
      label: 'Đang online',
      value: number(pulse.online_users),
      hint: '5 phút gần nhất',
      icon: Activity,
      accent: 'from-emerald-500/16 to-teal-500/8 text-emerald-500',
    },
    {
      label: 'Thành viên',
      value: number(pulse.total_users),
      hint: `${number(pulse.locked_users)} bị khóa`,
      icon: Users,
      accent: 'from-blue-500/16 to-cyan-500/8 text-blue-500',
    },
    {
      label: 'Tổng số dư user',
      value: money(pulse.total_liability),
      hint: 'Liability hệ thống',
      icon: WalletCards,
      accent: 'from-amber-500/18 to-orange-500/8 text-amber-500',
    },
    {
      label: 'Queue SMM',
      value: number(pulse.realtime_orders),
      hint: `${number(pulse.smm_delayed)} đơn trễ > 1h`,
      icon: ShoppingBag,
      accent: 'from-indigo-500/16 to-blue-500/8 text-indigo-500',
    },
    {
      label: 'IP bị chặn',
      value: number(pulse.blacklisted_ips),
      hint: 'Blacklist + banned IP',
      icon: LockKeyhole,
      accent: 'from-rose-500/16 to-red-500/8 text-rose-500',
    },
    {
      label: 'Tố cáo Forum',
      value: number(pulse.pending_reports),
      hint: 'Report / thread pending',
      icon: FileWarning,
      accent: 'from-orange-500/16 to-amber-500/8 text-orange-500',
    },
    {
      label: 'Nạp chờ duyệt',
      value: number(pulse.pending_deposits),
      hint: 'Deposit pending realtime',
      icon: TrendingUp,
      accent: 'from-emerald-500/16 to-teal-500/8 text-emerald-500',
    },
  ];

  const periodSections: Array<{
    label: string;
    description: string;
    data: AdminPeriodStats;
    accent: string;
  }> = [
    { label: 'Hôm nay', description: 'Theo ngày hiện tại', data: statsToday, accent: 'bg-blue-500' },
    { label: '7 ngày qua', description: 'Tổng hợp tuần gần nhất', data: stats7d, accent: 'bg-violet-500' },
    { label: '30 ngày qua', description: 'Tổng hợp tháng gần nhất', data: stats30d, accent: 'bg-emerald-500' },
  ];

  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-950 sm:rounded-[2rem] sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-brand-blue/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.24em] text-emerald-500">
              <span className={cn('h-1.5 w-1.5 rounded-full bg-emerald-500', isPending ? 'animate-ping' : '')} />
              Kết nối dữ liệu live
            </div>
            <h1 className="mt-4 max-w-3xl break-words text-3xl font-black uppercase leading-[1.22] tracking-[-0.02em] text-slate-950 dark:text-white sm:text-4xl sm:leading-[1.18]">
              Giám sát hệ thống
            </h1>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-8 tracking-[0.016em] text-slate-500 dark:text-slate-400">
              Theo dõi nạp tiền, đơn hàng, người dùng, forum và hàng đợi dịch vụ theo thời gian gần thực để phản ứng nhanh với vận hành.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 break-all dark:border-white/10 dark:bg-white/[0.04]">
                <DatabaseZap className="h-3.5 w-3.5 text-brand-blue" />
                {stats.databaseUrl}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-white/10 dark:bg-white/[0.04]">
                Cập nhật {new Date(stats.generatedAt).toLocaleTimeString('vi-VN')}
              </span>
              {lastError ? (
                <span className="rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-rose-500">
                  {lastError}
                </span>
              ) : null}
            </div>
          </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { label: 'Online', value: number(pulse.online_users), icon: Activity },
                { label: '2FA', value: number(pulse.twofa_users), icon: ShieldCheck },
                { label: 'Locked', value: number(pulse.locked_users), icon: LockKeyhole },
                { label: 'Reports', value: number(pulse.pending_reports), icon: AlertTriangle },
              { label: 'SMM', value: number(pulse.realtime_orders), icon: ShoppingBag },
              { label: 'Pending', value: number(pulse.pending_deposits), icon: WalletCards },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
                <item.icon className="h-4 w-4 text-brand-blue" />
                <div className="mt-3 font-mono text-xl font-black text-slate-950 dark:text-white">{item.value}</div>
                <div className="mt-1 text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 min-[430px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {pulseCards.map((card) => (
          <div key={card.label} className="group relative overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl dark:border-white/10 dark:bg-slate-950">
            <div className={cn('absolute inset-x-0 top-0 h-1 bg-gradient-to-r', card.accent)} />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{card.label}</div>
                <div className="mt-3 font-mono text-2xl font-black tracking-[-0.04em] text-slate-950 dark:text-white">{card.value}</div>
                <div className="mt-2 text-xs font-bold text-slate-500 dark:text-slate-400">{card.hint}</div>
              </div>
              <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br', card.accent)}>
                <card.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        {periodSections.map((section) => (
          <div key={section.label} className="overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-950">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
              <div className="flex items-center gap-3">
                <span className={cn('h-10 w-1 rounded-full', section.accent)} />
                <div>
                  <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-950 dark:text-white">Hiệu suất {section.label}</h2>
                  <p className="mt-1 text-xs font-semibold text-slate-400">{section.description}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void refreshStats()}
                className="rounded-xl border border-slate-200 p-2 text-slate-400 transition-all hover:-translate-y-0.5 hover:text-brand-blue dark:border-white/10"
                aria-label="Refresh dashboard"
              >
                <RefreshCw className={cn('h-4 w-4', isPending ? 'animate-spin' : '')} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 p-4 min-[430px]:grid-cols-2 sm:p-5">
              {[
                { label: 'Doanh thu SMM', value: money(section.data.smm_revenue), icon: Banknote, tone: 'text-emerald-500' },
                { label: 'Biên lợi nhuận', value: percent(section.data.smm_revenue > 0 ? (section.data.smm_profit / section.data.smm_revenue) * 100 : 0), icon: TrendingUp, tone: 'text-blue-500' },
                { label: 'Đơn SMM', value: number(section.data.smm_total), icon: ShoppingBag, tone: 'text-indigo-500' },
                { label: 'Hoàn tiền', value: money(section.data.refunds_money), icon: AlertTriangle, tone: 'text-rose-500' },
                { label: 'Nạp tiền', value: money(section.data.deposit), icon: WalletCards, tone: 'text-emerald-500' },
                { label: 'User mới', value: `+${number(section.data.new_users)}`, icon: Users, tone: 'text-slate-700 dark:text-slate-200' },
                { label: 'Forum posts', value: number(section.data.forum_posts), icon: MessageSquare, tone: 'text-purple-500' },
                { label: 'Active user', value: number(section.data.active_users), icon: ShieldCheck, tone: 'text-amber-500' },
                { label: 'Auto MXH', value: money(section.data.amx_revenue), icon: Activity, tone: 'text-orange-500' },
                { label: 'Tổng spend', value: money(section.data.spent), icon: Banknote, tone: 'text-cyan-500' },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition-all hover:border-brand-blue/30 hover:bg-white dark:border-white/10 dark:bg-white/[0.035] dark:hover:bg-white/[0.06]">
                  <div className="flex items-center justify-between gap-3">
                    <item.icon className={cn('h-4 w-4', item.tone)} />
                    <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">{item.label}</span>
                  </div>
                  <div className={cn('mt-3 font-mono text-lg font-black tracking-[-0.04em]', item.tone)}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <div className="overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-950">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-950 dark:text-white">Hoạt động gần đây</h3>
              <p className="mt-1 text-xs font-semibold text-slate-400">
                {filteredActivityLogs.length}/{activityLogs.length} log mới nhất
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative inline-flex max-w-full items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                <Filter className="h-4 w-4 text-brand-blue" />
                <select
                  value={activityFilter}
                  onChange={(event) => {
                    setActivityFilter(event.target.value);
                    setExpandedActivityId(null);
                  }}
                  className="max-w-[240px] appearance-none bg-transparent pr-7 outline-none"
                  aria-label="Lọc hoạt động theo hành động"
                >
                  <option value="all">Tất cả hành động ({activityLogs.length})</option>
                  {activityActions.map((item) => (
                    <option key={item.action} value={item.action}>
                      {item.action} ({item.count})
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-slate-400" />
              </label>
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
            </div>
          </div>
          <div className="custom-scrollbar max-h-[560px] space-y-2 overflow-y-auto p-4">
            {filteredActivityLogs.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-200 py-8 text-center text-xs font-bold uppercase text-slate-400 dark:border-white/10">
                Không có log khớp bộ lọc
              </p>
            ) : (
              filteredActivityLogs.map((log) => {
                const action = extractActivityAction(log.activity);
                const expanded = expandedActivityId === log.id;
                return (
                  <div
                    key={log.id}
                    className={cn(
                      'rounded-2xl border transition-all',
                      expanded
                        ? 'border-brand-blue/30 bg-brand-blue/5 shadow-[0_18px_55px_-42px_rgba(37,99,235,0.9)] dark:bg-brand-blue/10'
                        : 'border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:border-white/10 dark:hover:bg-white/[0.04]'
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedActivityId(expanded ? null : log.id)}
                      className="flex w-full items-start gap-4 p-4 text-left"
                      aria-expanded={expanded}
                    >
                      <div className={cn(
                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
                        log.user?.role === 'admin' || log.user?.role === 'owner' ? 'bg-rose-500/10 text-rose-500' : 'bg-brand-blue/10 text-brand-blue'
                      )}>
                        {log.user?.role === 'admin' || log.user?.role === 'owner' ? <ShieldCheck className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-950 dark:text-white">
                            {log.user?.username || 'System'}
                          </span>
                          <span className="font-mono text-[10px] font-bold text-slate-400">
                            {formatDatabaseDateTime(log.created_at)}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-brand-blue/20 bg-brand-blue/10 px-2.5 py-1 font-mono text-[10px] font-black text-brand-blue">
                            {action}
                          </span>
                          {log.ip_address ? (
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[10px] font-bold text-slate-400 dark:border-white/10 dark:bg-white/[0.04]">
                              {log.ip_address}
                            </span>
                          ) : null}
                        </div>
                        <p className={cn('mt-2 text-sm font-semibold leading-7 text-slate-500 dark:text-slate-400', expanded ? 'break-words' : 'line-clamp-2')}>
                          {log.activity}
                        </p>
                      </div>
                      <ChevronDown className={cn('mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform', expanded ? 'rotate-180 text-brand-blue' : '')} />
                    </button>
                    {expanded ? (
                      <div className="border-t border-slate-200 px-4 pb-4 pt-3 dark:border-white/10 sm:ml-[4.75rem]">
                        <div className="grid gap-3 text-xs font-bold text-slate-500 dark:text-slate-400 lg:grid-cols-2">
                          <div className="rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.035]">
                            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Hành động</div>
                            <div className="mt-2 break-words font-mono text-slate-700 dark:text-slate-200">{action}</div>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.035]">
                            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">IP</div>
                            <div className="mt-2 break-words font-mono text-slate-700 dark:text-slate-200">{log.ip_address || 'Không ghi nhận'}</div>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.035] lg:col-span-2">
                            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Thiết bị / user agent</div>
                            <div className="mt-2 break-words font-mono text-slate-700 dark:text-slate-200">{log.user_agent || 'Không ghi nhận'}</div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-950">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 dark:border-white/10">
            <div>
              <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-950 dark:text-white">Top số dư</h3>
              <p className="mt-1 text-xs font-semibold text-slate-400">5 tài khoản đang giữ balance cao nhất</p>
            </div>
            <Crown className="h-5 w-5 text-amber-500" />
          </div>
          <div className="space-y-3 p-4">
            {topUsers.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-200 py-8 text-center text-xs font-bold uppercase text-slate-400 dark:border-white/10">
                Chưa có dữ liệu
              </p>
            ) : (
              topUsers.map((item, idx) => (
                <div key={`${item.username}-${idx}`} className="group flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition-all hover:border-brand-blue/30 hover:bg-white dark:border-white/10 dark:bg-white/[0.035] dark:hover:bg-white/[0.06]">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white font-mono text-xs font-black text-brand-blue shadow-sm dark:bg-slate-900">
                      #{idx + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-slate-950 dark:text-white">{item.username}</div>
                      <div className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{item.role}</div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-sm font-black text-brand-blue">{money(item.balance)}</div>
                    <div className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-slate-300">Số dư</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
