import Link from 'next/link';
import type { ReactNode } from 'react';
import { Activity, ArrowUpRight, Boxes, Cloud, CreditCard, PackageCheck, ReceiptText, ShieldCheck, Zap } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { LiveRefresh } from '@/components/live/live-refresh';
import { EmptyState, PageHero, SectionHeader, SectionPanel } from '@/components/ui/page-layout';
import { formatDatabaseDateTime, serializeDatabaseDateTime } from '@/lib/date-time';
import { safeRows, safeRowsFromTable } from '@/lib/legacy-modules';
import { formatCurrency, toNumber } from '@/lib/utils';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type OrderTone = 'info' | 'warning' | 'success' | 'purple' | 'orange' | 'muted';

interface OrderRow {
  id: string;
  type: string;
  title: string;
  code: string;
  amount: number;
  quantity?: number;
  status: string;
  createdAt: string;
  href: string;
}

const typeMeta: Record<string, { label: string; variant: OrderTone; icon: ReactNode }> = {
  smm: { label: 'SMM', variant: 'info', icon: <ShieldCheck className="h-4 w-4" /> },
  automxh: { label: 'Auto MXH', variant: 'orange', icon: <Zap className="h-4 w-4" /> },
  resource: { label: 'Resource', variant: 'purple', icon: <Boxes className="h-4 w-4" /> },
  game: { label: 'Game', variant: 'success', icon: <Activity className="h-4 w-4" /> },
  card: { label: 'Card', variant: 'warning', icon: <CreditCard className="h-4 w-4" /> },
  proxy: { label: 'Proxy', variant: 'info', icon: <Cloud className="h-4 w-4" /> },
};

export default async function UserOrdersPage() {
  const { raw, shell } = await getCurrentUserForShell();
  const [smmOrders, autoOrders, resourceOrders, gameOrders, cardOrders, proxyOrders] = await Promise.all([
    safeRows(`
      SELECT id, api_order_id, service_name, quantity, price, status, created_at
      FROM smm_orders
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `, raw.id),
    safeRows(`
      SELECT o.id, o.product_id, o.variant_id, o.price, o.status, o.created_at, p.name AS product_name
      FROM automxh_orders o
      LEFT JOIN automxh_products p ON p.id = o.product_id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC
      LIMIT 50
    `, raw.id),
    safeRows(`
      SELECT o.id, o.resource_id, o.quantity, o.total_price, o.status, o.created_at, r.title
      FROM resource_orders o
      LEFT JOIN mmo_resources r ON r.id = o.resource_id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC
      LIMIT 50
    `, raw.id),
    safeRows(`
      SELECT o.id, o.item_id, o.amount, o.status, o.created_at, i.title
      FROM game_market_orders o
      LEFT JOIN game_market_items i ON i.id = o.item_id
      WHERE o.buyer_id = ?
      ORDER BY o.created_at DESC
      LIMIT 50
    `, raw.id),
    safeRowsFromTable('card_orders', `
      SELECT id, type, telco, serial, amount, status, created_at
      FROM card_orders
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `, raw.id),
    safeRows(`
      SELECT id, kind, package_name, quantity, total_price, status, created_at
      FROM proxy_orders
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `, raw.id),
  ]);

  const orders: OrderRow[] = [
    ...smmOrders.map((item) => ({
      id: `smm-${item.id}`,
      type: 'smm',
      title: String(item.service_name || `Dịch vụ SMM #${item.id}`),
      code: String(item.api_order_id || item.id),
      amount: toNumber(item.price, 0),
      quantity: toNumber(item.quantity, 0),
      status: String(item.status || 'Pending'),
      createdAt: serializeDatabaseDateTime(item.created_at),
      href: '/user/history',
    })),
    ...autoOrders.map((item) => ({
      id: `auto-${item.id}`,
      type: 'automxh',
      title: String(item.product_name || `Auto MXH #${item.product_id || item.variant_id || item.id}`),
      code: String(item.id),
      amount: toNumber(item.price, 0),
      status: String(item.status || 'pending'),
      createdAt: serializeDatabaseDateTime(item.created_at),
      href: '/user/automxh',
    })),
    ...resourceOrders.map((item) => ({
      id: `resource-${item.id}`,
      type: 'resource',
      title: String(item.title || `Tài nguyên #${item.resource_id}`),
      code: String(item.id),
      amount: toNumber(item.total_price, 0),
      quantity: toNumber(item.quantity, 0),
      status: String(item.status || 'pending'),
      createdAt: serializeDatabaseDateTime(item.created_at),
      href: `/user/resources/${item.resource_id}`,
    })),
    ...gameOrders.map((item) => ({
      id: `game-${item.id}`,
      type: 'game',
      title: String(item.title || `Game #${item.item_id}`),
      code: String(item.id),
      amount: toNumber(item.amount, 0),
      status: String(item.status || 'processing'),
      createdAt: serializeDatabaseDateTime(item.created_at),
      href: `/user/game-market/${item.item_id}`,
    })),
    ...cardOrders.map((item) => ({
      id: `card-${item.id}`,
      type: 'card',
      title: `${String(item.telco || item.type || 'Thẻ cào')} ${String(item.serial || '')}`.trim(),
      code: String(item.id),
      amount: toNumber(item.amount, 0),
      status: String(item.status || 'pending'),
      createdAt: serializeDatabaseDateTime(item.created_at),
      href: '/user/card',
    })),
    ...proxyOrders.map((item) => ({
      id: `proxy-${item.id}`,
      type: 'proxy',
      title: String(item.package_name || `Proxy order #${item.id}`),
      code: String(item.id),
      amount: toNumber(item.total_price, 0),
      quantity: toNumber(item.quantity, 0),
      status: String(item.status || 'pending'),
      createdAt: serializeDatabaseDateTime(item.created_at),
      href: '/user/proxy',
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 120);

  const totalVolume = orders.reduce((sum, order) => sum + order.amount, 0);
  const pendingCount = orders.filter((order) => /pending|processing|progress/i.test(order.status)).length;
  const completedCount = orders.filter((order) => /success|completed|done/i.test(order.status)).length;

  return (
    <AppShell user={shell}>
      <LiveRefresh intervalMs={10000} />
      <div className="space-y-6">
        <PageHero
          eyebrow="Order Center"
          title="Trung tâm theo dõi đơn hàng đa dịch vụ"
          description="Quản lý SMM, Auto MXH, tài nguyên, game market và thẻ cào trong cùng một dòng thời gian để kiểm tra tiến độ và giá trị giao dịch thuận tiện hơn."
          stats={[
            { label: 'Tổng đơn', value: String(orders.length), hint: 'Tối đa 120 đơn mới nhất', tone: 'blue' },
            { label: 'Đang xử lý', value: String(pendingCount), hint: 'Pending / Processing', tone: 'amber' },
            { label: 'Hoàn tất', value: String(completedCount), hint: 'Success / Completed', tone: 'emerald' },
            { label: 'Volume', value: formatCurrency(totalVolume), hint: 'Tổng giá trị hiển thị', tone: 'violet' },
          ]}
        />

        <SectionPanel className="space-y-5">
          <SectionHeader
            eyebrow="Live Orders"
            title="Danh sách đơn hàng"
            description="Mở từng dòng để đi tới đúng module xử lý, xem chi tiết trạng thái và tiếp tục thao tác khi cần."
            actions={
              <Link
                href="/user/history"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-600 transition-all hover:-translate-y-0.5 hover:border-brand-blue hover:text-brand-blue dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
              >
                <ReceiptText className="h-4 w-4" />
                Lịch sử giao dịch
              </Link>
            }
          />

          {orders.length === 0 ? (
            <EmptyState
              title="Chưa có đơn hàng"
              description="Đơn hàng từ các dịch vụ của TRUNGTAMMMO sẽ xuất hiện tại đây ngay sau khi phát sinh."
              icon={<PackageCheck className="h-5 w-5" />}
            />
          ) : (
            <div className="grid gap-3">
              {orders.map((order) => {
                const meta = typeMeta[order.type] || typeMeta.smm;
                return (
                  <Link
                    key={order.id}
                    href={order.href}
                    className="group grid gap-4 rounded-[1.45rem] border border-slate-200/80 bg-white/80 p-4 shadow-sm transition-all hover:-translate-y-1 hover:border-brand-blue/30 hover:shadow-xl dark:border-white/10 dark:bg-white/[0.035] md:grid-cols-[160px_minmax(0,1fr)_170px_150px]"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant={meta.variant} className="w-fit rounded-full px-3 py-1.5">
                        {meta.icon}
                        {meta.label}
                      </Badge>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-slate-950 dark:text-white">{order.title}</div>
                      <div className="mt-1 text-xs font-bold text-slate-400">
                        #{order.code}{order.quantity ? ` · SL ${order.quantity}` : ''} · {formatDatabaseDateTime(order.createdAt)}
                      </div>
                    </div>
                    <div className="font-mono text-base font-black text-slate-950 dark:text-white">
                      {formatCurrency(order.amount)}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                        {order.status}
                      </span>
                      <ArrowUpRight className="h-4 w-4 text-slate-300 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-blue" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </SectionPanel>
      </div>
    </AppShell>
  );
}
