import { Crown, Medal, ShieldCheck, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SectionHeader, SectionPanel } from '@/components/ui/page-layout';
import { formatCurrency } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const tiers = [
  { name: 'Member', min: 0, tone: 'muted', benefit: 'Mở toàn bộ module cơ bản' },
  { name: 'Silver', min: 500000, tone: 'info', benefit: 'Ưu tiên hỗ trợ và badge hồ sơ' },
  { name: 'Gold', min: 2000000, tone: 'warning', benefit: 'Ưu tiên duyệt bài/forum ads' },
  { name: 'Diamond', min: 10000000, tone: 'success', benefit: 'Ưu tiên xử lý đơn lớn và support riêng' },
];

export default function RankPage() {
  return (
    <main className="mmo-board mmo-board-page">
      <div className="mx-auto max-w-6xl space-y-6">
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
      </div>
    </main>
  );
}
