import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { EmptyState, PageHero, SectionHeader, SectionPanel } from '@/components/ui/page-layout';
import { formatDatabaseDateTime, serializeDatabaseDateTime } from '@/lib/date-time';
import { safeRows } from '@/lib/legacy-modules';
import { formatCurrency, toNumber } from '@/lib/utils';
import { getCurrentUserForShell } from '@/lib/user-session';
import { Activity, ArrowDownUp, Boxes, CreditCard, ShieldCheck, Zap } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function UserHistoryPage() {
  const { raw, shell } = await getCurrentUserForShell();
  const [transactions, smmOrders, cardOrders, autoOrders, resourceOrders, gameOrders] = await Promise.all([
    safeRows('SELECT id, type, amount, balance_after, content, status, created_at FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 30', raw.id),
    safeRows('SELECT id, service_name, price, status, created_at FROM smm_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 30', raw.id),
    safeRows('SELECT id, telco, serial, amount, status, created_at FROM card_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 30', raw.id),
    safeRows('SELECT id, product_id, variant_id, price, status, created_at FROM automxh_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 30', raw.id),
    safeRows(`
      SELECT o.id, o.resource_id, o.total_price, o.status, o.created_at, r.title
      FROM resource_orders o
      LEFT JOIN mmo_resources r ON r.id = o.resource_id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC
      LIMIT 30
    `, raw.id),
    safeRows(`
      SELECT o.id, o.item_id, o.amount, o.status, o.created_at, i.title
      FROM game_market_orders o
      LEFT JOIN game_market_items i ON i.id = o.item_id
      WHERE o.buyer_id = ?
      ORDER BY o.created_at DESC
      LIMIT 30
    `, raw.id),
  ]);

  const rows = [
    ...transactions.map((item) => ({
      id: `trx-${item.id}`,
      type: String(item.type),
      title: String(item.content || `Giao dịch #${item.id}`),
      amount: toNumber(item.amount, 0),
      status: String(item.status),
      created_at: serializeDatabaseDateTime(item.created_at),
    })),
    ...smmOrders.map((item) => ({
      id: `smm-${item.id}`,
      type: 'smm',
      title: String(item.service_name || `SMM #${item.id}`),
      amount: toNumber(item.price, 0),
      status: String(item.status || 'Pending'),
      created_at: serializeDatabaseDateTime(item.created_at),
    })),
    ...cardOrders.map((item) => ({
      id: `card-${item.id}`,
      type: 'card',
      title: `${String(item.telco || 'Card')} ${String(item.serial || '')}`,
      amount: toNumber(item.amount),
      status: String(item.status),
      created_at: serializeDatabaseDateTime(item.created_at),
    })),
    ...autoOrders.map((item) => ({
      id: `auto-${item.id}`,
      type: 'automxh',
      title: `Auto MXH #${item.product_id || item.variant_id || item.id}`,
      amount: toNumber(item.price),
      status: String(item.status),
      created_at: serializeDatabaseDateTime(item.created_at),
    })),
    ...resourceOrders.map((item) => ({
      id: `resource-${item.id}`,
      type: 'resource',
      title: String(item.title || `Resource #${item.resource_id}`),
      amount: toNumber(item.total_price),
      status: String(item.status),
      created_at: serializeDatabaseDateTime(item.created_at),
    })),
    ...gameOrders.map((item) => ({
      id: `game-${item.id}`,
      type: 'game',
      title: String(item.title || `Game #${item.item_id}`),
      amount: toNumber(item.amount),
      status: String(item.status),
      created_at: serializeDatabaseDateTime(item.created_at),
    })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 80);

  const typeSummary = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.type] = (acc[row.type] || 0) + 1;
    return acc;
  }, {});
  const totalVolume = rows.reduce((sum, row) => sum + row.amount, 0);

  const typeMeta: Record<string, { label: string; variant: 'info' | 'warning' | 'success' | 'purple' | 'orange' | 'muted' }> = {
    smm: { label: 'SMM', variant: 'info' },
    card: { label: 'Card', variant: 'warning' },
    automxh: { label: 'Auto MXH', variant: 'orange' },
    resource: { label: 'Resource', variant: 'purple' },
    game: { label: 'Game', variant: 'success' },
    trx: { label: 'Transaction', variant: 'muted' },
  };

  return (
    <AppShell user={shell}>
      <div className="space-y-6">
        <PageHero
          eyebrow="Unified Ledger"
          title="Lịch sử giao dịch gom về một bảng, đọc nhanh hơn."
          description="Tất cả giao dịch, đơn dịch vụ, thẻ cào, tài nguyên và game order được gom lại để dễ quét theo loại, giá trị và thời gian."
          stats={[
            { label: 'Tổng dòng', value: String(rows.length), hint: 'Gộp tối đa 80 bản ghi gần nhất', tone: 'blue' },
            { label: 'Tổng volume', value: formatCurrency(totalVolume), hint: 'Cộng giá trị hiển thị trên bảng', tone: 'emerald' },
            { label: 'Đơn SMM', value: String(typeSummary.smm || 0), hint: 'Bản ghi dịch vụ tăng tương tác', tone: 'amber' },
            { label: 'Auto + Resource', value: String((typeSummary.automxh || 0) + (typeSummary.resource || 0)), hint: 'Nhóm mua sản phẩm/dịch vụ', tone: 'violet' },
          ]}
        />

        <SectionPanel className="space-y-5">
          <SectionHeader
            eyebrow="Recent Activity"
            title="Dòng thời gian giao dịch"
            description="Bảng dưới không đổi dữ liệu nguồn. Mình chỉ chuyển sang kiểu ledger rõ trạng thái, type badge và số tiền để nhìn chuyên nghiệp hơn."
            actions={
              <div className="flex flex-wrap gap-2">
                {Object.entries(typeSummary).map(([type, count]) => (
                  <Badge key={type} variant={typeMeta[type]?.variant || 'muted'} className="rounded-full px-3 py-1.5">
                    {typeMeta[type]?.label || type} · {count}
                  </Badge>
                ))}
              </div>
            }
          />

          {rows.length === 0 ? (
            <EmptyState
              title="Chưa có lịch sử giao dịch"
              description="Khi có transaction hoặc order phát sinh, chúng sẽ xuất hiện tại đây theo đúng thứ tự thời gian mới nhất."
              icon={<Activity className="h-5 w-5" />}
            />
          ) : (
            <div className="overflow-hidden rounded-[1.7rem] border border-slate-200/80 bg-white/80 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left">
                  <thead className="border-b border-slate-200/80 bg-slate-50/80 text-[10px] font-black uppercase tracking-[0.26em] text-slate-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-500">
                    <tr>
                      <th className="px-5 py-4">Loại</th>
                      <th className="px-5 py-4">Nội dung</th>
                      <th className="px-5 py-4">Số tiền</th>
                      <th className="px-5 py-4">Trạng thái</th>
                      <th className="px-5 py-4">Thời gian</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {rows.map((row) => {
                      const meta = typeMeta[row.type] || typeMeta.trx;
                      const iconMap: Record<string, ReactNode> = {
                        trx: <ArrowDownUp className="h-4 w-4" />,
                        smm: <ShieldCheck className="h-4 w-4" />,
                        card: <CreditCard className="h-4 w-4" />,
                        automxh: <Zap className="h-4 w-4" />,
                        resource: <Boxes className="h-4 w-4" />,
                        game: <Activity className="h-4 w-4" />,
                      };

                      return (
                        <tr key={row.id} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-white/[0.03]">
                          <td className="px-5 py-4">
                            <Badge variant={meta.variant} className="w-fit rounded-full px-3 py-1.5">
                              {iconMap[row.type]}
                              {meta.label}
                            </Badge>
                          </td>
                          <td className="px-5 py-4">
                            <div className="max-w-[340px] text-sm font-bold leading-7 text-slate-700 dark:text-slate-200">
                              {row.title}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="font-mono text-base font-black text-slate-950 dark:text-white">
                              {formatCurrency(row.amount)}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
                              {row.status}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                              {formatDatabaseDateTime(row.created_at)}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </SectionPanel>
      </div>
    </AppShell>
  );
}
