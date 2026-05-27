import Link from 'next/link';
import { Crown, Medal, ShieldCheck, Sparkles, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { PageHero, SectionHeader, SectionPanel } from '@/components/ui/page-layout';
import { safeRows } from '@/lib/legacy-modules';
import { formatCurrency, toNumber } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const tiers = [
  { name: 'Member', min: 0, tone: 'muted', benefit: 'Mở toàn bộ module cơ bản' },
  { name: 'Silver', min: 500000, tone: 'info', benefit: 'Ưu tiên hỗ trợ và badge hồ sơ' },
  { name: 'Gold', min: 2000000, tone: 'warning', benefit: 'Ưu tiên duyệt bài/forum ads' },
  { name: 'Diamond', min: 10000000, tone: 'success', benefit: 'Ưu tiên xử lý đơn lớn và support riêng' },
];

export default async function RankPage() {
  const rows = await safeRows(`
    SELECT id, username, fullname, rank, balance, post_count, is_blue_tick, created_at, last_activity
    FROM users
    WHERE status = 'active'
    ORDER BY balance DESC, post_count DESC, id DESC
    LIMIT 80
  `);

  const totalBalance = rows.reduce((sum, row) => sum + toNumber(row.balance, 0), 0);
  const blueTick = rows.filter((row) => Number(row.is_blue_tick || 0) === 1).length;

  return (
    <main className="mmo-board mmo-board-page">
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHero
          eyebrow="Rank Center"
          title="Cấp bậc thành viên và quyền lợi trên TRUNGTAMMMO"
          description="Theo dõi bảng xếp hạng cộng đồng, mốc cấp bậc và những quyền lợi nổi bật dành cho thành viên hoạt động tích cực trên nền tảng."
          stats={[
            { label: 'Thành viên', value: String(rows.length), hint: 'Top active users', tone: 'blue' },
            { label: 'Tổng số dư', value: formatCurrency(totalBalance), hint: 'Tính trên danh sách đang hiển thị', tone: 'emerald' },
            { label: 'Blue tick', value: String(blueTick), hint: 'Tài khoản đã xác minh', tone: 'violet' },
            { label: 'Tier', value: String(tiers.length), hint: 'Mốc rank hệ thống', tone: 'amber' },
          ]}
          actions={
            <>
              <Link href="/user/home" className="btn-kinetic rounded-full bg-brand-blue px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white">
                Vào workspace
              </Link>
              <Link href="/api" className="surface-chip rounded-full px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-600 dark:text-slate-200">
                Tài liệu API
              </Link>
            </>
          }
        />

        <SectionPanel className="space-y-5">
          <SectionHeader eyebrow="Rank Rules" title="Mốc cấp bậc" description="Mỗi cấp bậc phản ánh mức độ hoạt động và mở ra các quyền lợi hỗ trợ, ưu tiên hoặc hiển thị nổi bật khác nhau." />
          <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2 md:grid-cols-4">
            {tiers.map((tier, index) => (
              <div key={tier.name} className="surface-card rounded-[1.6rem] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-blue/10 text-brand-blue">
                    {index === 0 ? <ShieldCheck className="h-5 w-5" /> : index === 1 ? <Medal className="h-5 w-5" /> : index === 2 ? <Trophy className="h-5 w-5" /> : <Crown className="h-5 w-5" />}
                  </div>
                  <Badge variant={tier.tone as any} className="rounded-full px-3 py-1.5">{tier.name}</Badge>
                </div>
                <div className="mt-5 font-mono text-2xl font-black text-slate-950 dark:text-white">{formatCurrency(tier.min)}</div>
                <div className="mt-2 text-xs font-bold leading-6 text-slate-500 dark:text-slate-400">{tier.benefit}</div>
              </div>
            ))}
          </div>
        </SectionPanel>

        <SectionPanel className="space-y-5">
          <SectionHeader eyebrow="Leaderboard" title="Bảng thành viên nổi bật" description="Danh sách nổi bật giúp bạn theo dõi những tài khoản đang có mức hoạt động và số dư cao trên hệ thống." />
          <div className="overflow-hidden rounded-[1.7rem] border border-sky-400/20 bg-[#06162a]/78">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left">
              <thead className="border-b border-sky-400/15 text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                <tr>
                  <th className="px-5 py-4">Rank</th>
                  <th className="px-5 py-4">User</th>
                  <th className="px-5 py-4">Cấp</th>
                  <th className="px-5 py-4">Số dư</th>
                  <th className="px-5 py-4">Bài viết</th>
                  <th className="px-5 py-4">Hoạt động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {rows.map((row, index) => (
                  <tr key={String(row.id)} className="hover:bg-sky-500/10">
                    <td className="px-5 py-4 font-mono text-lg font-black text-brand-blue">#{index + 1}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 font-black text-white">
                        {String(row.fullname || row.username)}
                        {Number(row.is_blue_tick || 0) === 1 ? <Sparkles className="h-4 w-4 text-brand-blue" /> : null}
                      </div>
                      <div className="mt-1 text-xs font-bold text-slate-400">@{String(row.username)}</div>
                    </td>
                    <td className="px-5 py-4"><Badge variant="muted" className="rounded-full px-3 py-1.5">{String(row.rank || 'Member')}</Badge></td>
                    <td className="px-5 py-4 font-mono font-black text-emerald-500">{formatCurrency(toNumber(row.balance, 0))}</td>
                    <td className="px-5 py-4 font-mono font-black text-slate-200">{String(row.post_count || 0)}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-slate-400">{row.last_activity ? new Date(String(row.last_activity)).toLocaleString('vi-VN') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </SectionPanel>
      </div>
    </main>
  );
}
