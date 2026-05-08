import { AppShell } from '@/components/layout/app-shell';
import { MetricCard, PageHero, SectionHeader, SectionPanel } from '@/components/ui/page-layout';
import { safeCount, safeRows } from '@/lib/legacy-modules';
import { formatCurrency, toNumber } from '@/lib/utils';
import { getCurrentUserForShell } from '@/lib/user-session';
import { Boxes, CreditCard, HandCoins, ShieldCheck, Wallet, Zap } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function UserStatisticsPage() {
  const { raw, shell } = await getCurrentUserForShell();
  const [depositSum, smmSum, smmCount, autoCount, cardCount, resourceCount, gameCount] = await Promise.all([
    safeRows('SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE user_id = ? AND type = ? AND status = ?', raw.id, 'deposit', 'success'),
    safeRows('SELECT COALESCE(SUM(price), 0) AS total FROM smm_orders WHERE user_id = ?', raw.id),
    safeCount('SELECT COUNT(*) AS total FROM smm_orders WHERE user_id = ?', raw.id),
    safeCount('SELECT COUNT(*) AS total FROM automxh_orders WHERE user_id = ?', raw.id),
    safeCount('SELECT COUNT(*) AS total FROM card_orders WHERE user_id = ?', raw.id),
    safeCount('SELECT COUNT(*) AS total FROM resource_orders WHERE user_id = ?', raw.id),
    safeCount('SELECT COUNT(*) AS total FROM game_market_orders WHERE buyer_id = ?', raw.id),
  ]);

  const cards = [
    {
      label: 'Số dư hiện tại',
      value: formatCurrency(shell.balance),
      hint: 'Trạng thái ví hiện tại của tài khoản',
      tone: 'blue' as const,
      icon: <Wallet className="h-4 w-4" />,
    },
    {
      label: 'Tổng nạp thành công',
      value: formatCurrency(toNumber(depositSum[0]?.total, 0)),
      hint: 'Tổng giao dịch deposit đã success',
      tone: 'emerald' as const,
      icon: <HandCoins className="h-4 w-4" />,
    },
    {
      label: 'Chi SMM',
      value: formatCurrency(toNumber(smmSum[0]?.total, 0)),
      hint: 'Tổng tiền đã dùng cho tăng tương tác',
      tone: 'amber' as const,
      icon: <ShieldCheck className="h-4 w-4" />,
    },
    {
      label: 'Đơn SMM',
      value: smmCount.toLocaleString('vi-VN'),
      hint: 'Đơn đã phát sinh trên cụm SMM',
      tone: 'slate' as const,
      icon: <ShieldCheck className="h-4 w-4" />,
    },
    {
      label: 'Đơn Auto MXH',
      value: autoCount.toLocaleString('vi-VN'),
      hint: 'Tổng order automation/social tool',
      tone: 'violet' as const,
      icon: <Zap className="h-4 w-4" />,
    },
    {
      label: 'Đơn card',
      value: cardCount.toLocaleString('vi-VN'),
      hint: 'Order đổi hoặc mua thẻ',
      tone: 'amber' as const,
      icon: <CreditCard className="h-4 w-4" />,
    },
    {
      label: 'Đơn tài nguyên',
      value: resourceCount.toLocaleString('vi-VN'),
      hint: 'Order từ mmo_resources',
      tone: 'emerald' as const,
      icon: <Boxes className="h-4 w-4" />,
    },
    {
      label: 'Đơn game',
      value: gameCount.toLocaleString('vi-VN'),
      hint: 'Giao dịch game market',
      tone: 'blue' as const,
      icon: <Boxes className="h-4 w-4" />,
    },
  ];

  const totalOrders = smmCount + autoCount + cardCount + resourceCount + gameCount;

  return (
    <AppShell user={shell}>
      <div className="space-y-6">
        <PageHero
          eyebrow="Account Analytics"
          title="Toàn cảnh tài khoản và hiệu suất giao dịch"
          description="Theo dõi số dư, tổng nạp và nhịp mua dịch vụ trên TRUNGTAMMMO trong một màn hình rõ ràng, giúp bạn kiểm soát chi tiêu và hiệu quả vận hành tài khoản nhanh hơn."
          stats={[
            { label: 'Số dư', value: formatCurrency(shell.balance), hint: 'Giá trị ví hiện tại', tone: 'blue' },
            { label: 'Ví game', value: formatCurrency(shell.game_balance), hint: 'Dùng riêng cho tài khoản game', tone: 'emerald' },
            { label: 'Chi SMM', value: formatCurrency(toNumber(smmSum[0]?.total, 0)), hint: 'Tổng spending SMM', tone: 'amber' },
            { label: 'Tổng order', value: totalOrders.toLocaleString('vi-VN'), hint: 'Cộng tất cả module bán hàng', tone: 'violet' },
          ]}
        />

        <SectionPanel className="space-y-5">
          <SectionHeader
            eyebrow="Snapshot"
            title="Chỉ số vận hành theo từng module"
            description="Mỗi nhóm chỉ số phản ánh một phần hoạt động mua bán, giúp bạn nhìn nhanh dòng tiền, khối lượng đơn và mức độ sử dụng từng dịch vụ."
          />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
              <MetricCard
                key={card.label}
                label={card.label}
                value={card.value}
                hint={card.hint}
                tone={card.tone}
                icon={card.icon}
              />
            ))}
          </div>
        </SectionPanel>
      </div>
    </AppShell>
  );
}
