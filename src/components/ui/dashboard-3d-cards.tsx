'use client';

import { Layers3, ShieldCheck, Bot } from 'lucide-react';
import { Floating3DCard } from '@/components/ui/floating-3d-card';
import { Balance3DCard } from '@/components/ui/balance-3d-card';
import { cn } from '@/lib/utils';

interface Dashboard3DCardsProps {
  totalServiceModules: number;
  userRank: string;
  balance: number;
  totalDeposit: number;
  monthlyDeposit: number;
  className?: string;
}

const metricItems = [
  { label: 'Module dịch vụ', key: 'modules', icon: Layers3 },
  { label: 'Tài khoản', key: 'rank', icon: ShieldCheck },
  { label: 'AI Manager', key: 'ai', icon: Bot },
];

export function Dashboard3DCards({
  totalServiceModules,
  userRank,
  balance,
  totalDeposit,
  monthlyDeposit,
  className,
}: Dashboard3DCardsProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Hero metric cards — 3D floating + tilt */}
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 md:gap-4">
        {metricItems.map((item, index) => {
          const value = item.key === 'modules'
            ? String(totalServiceModules).padStart(2, '0')
            : item.key === 'rank'
            ? userRank || 'Member'
            : 'Live';

          return (
            <Floating3DCard
              key={item.key}
              floatDelay={index * 0.3}
              floatDuration={7 + index}
              floatDirection="both"
              tiltMax={7}
              className="rounded-[1.4rem]"
            >
              <div className="min-w-0 rounded-[1.4rem] border border-slate-200/80 bg-white/70 p-4 backdrop-blur-sm dark:border-white/8 dark:bg-white/[0.04]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-white/35 sm:text-[10px] sm:tracking-[0.3em]">
                      {item.label}
                    </div>
                    <div className="mt-3 break-words text-xl font-black uppercase tracking-[-0.028em] text-slate-950 dark:text-white sm:text-2xl">
                      {value}
                    </div>
                    <div className="mt-2 text-xs font-semibold leading-7 text-slate-500 dark:text-white/45">
                      {item.key === 'modules'
                        ? 'Các cụm chức năng đang sẵn sàng'
                        : item.key === 'rank'
                        ? 'Cấp bậc hiện tại của bạn'
                        : 'Kết nối trực tiếp công cụ AI'}
                    </div>
                  </div>
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-brand-blue/20 bg-brand-blue/10 text-brand-blue">
                    <item.icon className="h-4 w-4" />
                  </span>
                </div>
              </div>
            </Floating3DCard>
          );
        })}
      </div>

      {/* Balance + deposit cards — 3D balance card + floating variants */}
      <div className="grid min-w-0 gap-4 min-[430px]:grid-cols-2 2xl:grid-cols-1">
        <Floating3DCard floatDelay={0.9} floatDuration={8} floatDirection="up" tiltMax={6}>
          <Balance3DCard balance={balance} className="w-full" />
        </Floating3DCard>

        <Floating3DCard floatDelay={1.2} floatDuration={9} floatDirection="down" tiltMax={6}>
          <div className="dashboard-metric min-w-0 rounded-[1.4rem] border border-slate-200/80 bg-white/70 p-4 backdrop-blur-sm dark:border-white/8 dark:bg-white/[0.04] sm:p-5 md:p-6">
            <div className="relative z-10 min-w-0">
              <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-white/35 sm:text-[10px] sm:tracking-[0.34em]">
                Deposit
              </div>
              <label className="mt-3 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-white/45 sm:mt-4 sm:text-xs sm:tracking-[0.28em]">
                Tổng Nạp tích luỹ
              </label>
              <div className="mt-3 w-full font-mono tabular-nums whitespace-nowrap text-[min(1.5rem,4.8vw)] font-black uppercase leading-[1.08] tracking-[-0.05em] text-emerald-500 dark:text-emerald-400">
                {new Intl.NumberFormat('vi-VN').format(totalDeposit)}
                <span className="ml-1 text-[0.65em] font-black uppercase tracking-tight">đ</span>
              </div>
            </div>
          </div>
        </Floating3DCard>

        <Floating3DCard floatDelay={1.5} floatDuration={10} floatDirection="both" tiltMax={6}>
          <div className="dashboard-metric min-w-0 rounded-[1.4rem] border border-slate-200/80 bg-white/70 p-4 backdrop-blur-sm dark:border-white/8 dark:bg-white/[0.04] sm:p-5 md:p-6">
            <div className="relative z-10 min-w-0">
              <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-white/35 sm:text-[10px] sm:tracking-[0.34em]">
                Monthly
              </div>
              <label className="mt-3 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-white/45 sm:mt-4 sm:text-xs sm:tracking-[0.28em]">
                Nạp Tháng hiện tại
              </label>
              <div className="mt-3 w-full font-mono tabular-nums whitespace-nowrap text-[min(1.5rem,4.8vw)] font-black uppercase leading-[1.08] tracking-[-0.05em] text-orange-500 dark:text-orange-400">
                {new Intl.NumberFormat('vi-VN').format(monthlyDeposit)}
                <span className="ml-1 text-[0.65em] font-black uppercase tracking-tight">đ</span>
              </div>
            </div>
          </div>
        </Floating3DCard>
      </div>
    </div>
  );
}
