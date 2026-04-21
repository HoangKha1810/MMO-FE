import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import {
  ArrowUpRight,
  Bot,
  Headset,
  Layers3,
  ShieldCheck,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { HomeServiceCard } from '@/components/modules/home-service-card';
import { db } from '@/lib/db';
import {
  buildLegacyAssetUrl,
  getHomeServiceGrid,
  getLegacySetting,
  getLegacySettingsMap,
  getSidebarServiceCatalog,
} from '@/lib/legacy-settings';
import { toNumber } from '@/lib/utils';

async function getUser(userId: number) {
  try {
    const user = await db.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        fullname: true,
        avatar: true,
        balance: true,
        rank: true,
        role: true,
        is_blue_tick: true,
      },
    });

    if (!user) {
      return null;
    }

    return {
      ...user,
      avatar: buildLegacyAssetUrl(user.avatar) || undefined,
      balance: toNumber(user.balance, 0),
    };
  } catch {
    return null;
  }
}

async function getDepositStats(userId: number) {
  try {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [totalDeposit, monthlyDeposit] = await Promise.all([
      db.transactions.aggregate({
        where: { user_id: userId, type: 'deposit', status: 'success' },
        _sum: { amount: true },
      }),
      db.transactions.aggregate({
        where: { user_id: userId, type: 'deposit', status: 'success', created_at: { gte: monthStart } },
        _sum: { amount: true },
      }),
    ]);

    return {
      totalDeposit: toNumber(totalDeposit._sum.amount, 0),
      monthlyDeposit: toNumber(monthlyDeposit._sum.amount, 0),
    };
  } catch {
    return {
      totalDeposit: 0,
      monthlyDeposit: 0,
    };
  }
}

export default async function HomePage() {
  const cookieStore = await cookies();
  const userId = parseInt(cookieStore.get('user_id')?.value || '0', 10);

  if (!userId) {
    redirect('/auth/login');
  }

  const settings = await getLegacySettingsMap();
  const [user, depositStats] = await Promise.all([
    getUser(userId),
    getDepositStats(userId),
  ]);

  if (!user) {
    redirect('/auth/login');
  }

  const services = getHomeServiceGrid(settings).map((service, index) => ({
    ...service,
    index: index + 1,
  }));
  const sidebarServices = getSidebarServiceCatalog(settings);
  const welcomeTitle = getLegacySetting(settings, 'home_welcome_title', 'Chào mừng trở lại,');
  const quickLaunch = services.filter((service) => !service.maintenance).slice(0, 3);
  const totalServiceModules = services.length + sidebarServices.length;

  return (
    <AppShell
      user={{
        username: user.username,
        email: user.email,
        balance: user.balance,
        rank: user.rank || 'Member',
        role: String(user.role || 'member'),
        avatar: user.avatar || undefined,
        is_blue_tick: Boolean(user.is_blue_tick),
      }}
      sidebarServices={sidebarServices}
    >
      <div className="space-y-6 sm:space-y-8">
        <div className="grid grid-cols-1 gap-4 sm:gap-6 2xl:grid-cols-[minmax(0,1.35fr)_380px]">
          <section className="dashboard-hero group min-w-0 p-4 sm:p-7 md:p-9 xl:p-10">
            <div className="relative z-10 flex h-full flex-col gap-8">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 max-w-2xl">
                  <div className="mb-4 inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 sm:mb-5 sm:px-3.5 sm:py-2">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                    <span className="text-[9px] font-black uppercase tracking-[0.24em] text-emerald-500 dark:text-emerald-400 sm:text-[10px] sm:tracking-[0.34em]">
                      Hệ thống trực tuyến
                    </span>
                  </div>
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-white/35 sm:text-sm sm:tracking-[0.3em]">{welcomeTitle}</div>
                  <h1 className="mt-3 max-w-3xl break-words text-3xl font-black uppercase leading-[1.22] tracking-[-0.02em] text-slate-950 dark:text-white sm:text-4xl sm:leading-[1.18] md:text-5xl md:leading-[1.16]">
                    {user.username}
                  </h1>
                  <p className="mt-4 max-w-xl text-xs font-medium uppercase leading-[2.05] tracking-[0.08em] text-slate-600 dark:text-white/55 sm:mt-5 sm:text-sm sm:leading-[2.15] sm:tracking-[0.14em]">
                    Hệ thống <span className="font-black text-brand-blue">TRUNGTAMMMO</span> đã sẵn sàng đồng hành cùng bạn trong quản lý đơn hàng, tài nguyên số, tăng trưởng mạng xã hội và các giao dịch MMO trên một workspace tập trung.
                  </p>
                </div>

                <div className="dashboard-quick-strip min-w-0 w-full p-4 xl:max-w-[280px]">
                  <div className="text-[9px] font-black uppercase tracking-[0.24em] text-slate-400 dark:text-white/35 sm:text-[10px] sm:tracking-[0.34em]">
                    Quick Launch
                  </div>
                  <div className="mt-4 space-y-2">
                    {quickLaunch.map((item) => (
                      <a
                        key={item.key}
                        href={item.maintenance ? 'javascript:void(0)' : item.href}
                        target={item.external && !item.maintenance ? '_blank' : undefined}
                        rel={item.external && !item.maintenance ? 'noreferrer' : undefined}
                        className={`flex min-w-0 items-center justify-between gap-3 rounded-[1rem] border px-3 py-3 text-[10px] font-black uppercase tracking-[0.14em] transition-all sm:text-xs sm:tracking-[0.22em] ${
                          item.maintenance
                            ? 'cursor-not-allowed border-slate-200/70 bg-white/55 text-slate-400 dark:border-white/6 dark:bg-white/[0.03] dark:text-white/30'
                            : 'border-slate-200/80 bg-white/72 text-slate-700 hover:-translate-y-0.5 hover:border-brand-blue/25 hover:bg-white dark:border-white/8 dark:bg-white/[0.04] dark:text-white/80 dark:hover:bg-white/[0.07]'
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate">{item.title}</span>
                        <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 md:gap-4">
                {[
                  { label: 'Module dịch vụ', value: String(totalServiceModules).padStart(2, '0'), hint: 'Các cụm chức năng đang sẵn sàng', icon: Layers3 },
                  { label: 'Tài khoản', value: user.rank || 'Member', hint: 'Cấp bậc hiện tại của bạn', icon: ShieldCheck },
                  { label: 'AI Manager', value: 'Live', hint: 'Kết nối trực tiếp công cụ AI', icon: Bot },
                ].map((item) => (
                  <div key={item.label} className="min-w-0 rounded-[1.4rem] border border-slate-200/80 bg-white/70 p-4 backdrop-blur-sm dark:border-white/8 dark:bg-white/[0.04]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-white/35 sm:text-[10px] sm:tracking-[0.3em]">{item.label}</div>
                        <div className="mt-3 break-words text-xl font-black uppercase tracking-[-0.028em] text-slate-950 dark:text-white sm:text-2xl">{item.value}</div>
                        <div className="mt-2 text-xs font-semibold leading-7 text-slate-500 dark:text-white/45">{item.hint}</div>
                      </div>
                      <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-brand-blue/20 bg-brand-blue/10 text-brand-blue">
                        <item.icon className="h-4 w-4" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pointer-events-none absolute bottom-0 right-4 hidden translate-y-8 opacity-20 transition-all duration-700 group-hover:translate-y-4 dark:opacity-30 2xl:block">
              <img
                src="/assets/images/528b91cfa29c7ffd85418f4b1e8cc8ce.png"
                alt="Illustration"
                className="h-auto w-[330px] object-contain"
              />
            </div>
          </section>

          <div className="grid min-w-0 gap-4 min-[430px]:grid-cols-2 2xl:grid-cols-1">
            {[
              { label: 'Số Dư khả dụng', val: user.balance, color: 'text-brand-blue', kicker: 'Wallet' },
              { label: 'Tổng Nạp tích luỹ', val: depositStats.totalDeposit, color: 'text-emerald-500 dark:text-emerald-400', kicker: 'Deposit' },
              { label: 'Nạp Tháng hiện tại', val: depositStats.monthlyDeposit, color: 'text-orange-500 dark:text-orange-400', kicker: 'Monthly' },
              { label: 'Cấp Bậc tài khoản', val: user.rank || 'Member', color: 'text-slate-950 dark:text-white', kicker: 'Rank' },
            ].map((card) => (
              <div key={card.label} className="dashboard-metric min-w-0 p-4 sm:p-5 md:p-6">
                <div className="relative z-10 min-w-0">
                  <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-white/35 sm:text-[10px] sm:tracking-[0.34em]">
                    {card.kicker}
                  </div>
                  <label className="mt-3 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-white/45 sm:mt-4 sm:text-xs sm:tracking-[0.28em]">
                    {card.label}
                  </label>
                  <div className={`mt-3 w-full font-mono tabular-nums whitespace-nowrap text-[min(1.5rem,4.8vw)] font-black uppercase leading-[1.08] tracking-[-0.05em] ${card.color}`}>
                    {typeof card.val === 'number'
                      ? new Intl.NumberFormat('vi-VN').format(card.val)
                      : card.val}
                    {typeof card.val === 'number' ? ' đ' : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="dashboard-quick-strip p-4 md:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-[9px] font-black uppercase tracking-[0.24em] text-slate-400 dark:text-white/35 sm:text-[10px] sm:tracking-[0.34em]">Feature Board</div>
                <h2 className="mt-2 text-xl font-black uppercase tracking-[-0.028em] text-slate-950 dark:text-white sm:text-2xl">
                  Dịch vụ nổi bật
                </h2>
              </div>
              <div className="grid w-full grid-cols-1 gap-3 min-[430px]:grid-cols-2 md:w-auto md:grid-cols-4">
                {[
                  { label: 'Balance', value: new Intl.NumberFormat('vi-VN').format(user.balance), icon: Wallet },
                  { label: 'Total Deposit', value: new Intl.NumberFormat('vi-VN').format(depositStats.totalDeposit), icon: Sparkles },
                  { label: 'Service Blocks', value: String(services.length), icon: Layers3 },
                  { label: 'Support', value: '24/7', icon: Headset },
                ].map((item) => (
                  <div key={item.label} className="min-w-0 rounded-[1.2rem] border border-slate-200/80 bg-white/72 px-4 py-3 dark:border-white/8 dark:bg-white/[0.04]">
                    <div className="flex items-center gap-2 text-slate-400 dark:text-white/35">
                      <item.icon className="h-3.5 w-3.5" />
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em]">{item.label}</span>
                    </div>
                    <div className="mt-2 w-full font-mono tabular-nums whitespace-nowrap text-[min(1.125rem,4.2vw)] font-black leading-[1.08] tracking-[-0.04em] text-slate-950 dark:text-white">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {services.map((service) => (
              <HomeServiceCard
                key={`${service.key}-${service.index}`}
                service={service}
                className="dashboard-service-card h-full"
              />
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
