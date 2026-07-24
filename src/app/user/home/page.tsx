import { redirect } from 'next/navigation';
import { getVerifiedSessionUserId } from '@/lib/session-cookie';
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Layers3,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { HomeServiceCard } from '@/components/modules/home-service-card';
import { UserApikeyCard } from '@/components/user/user-apikey-card';
import { buildAccessPageUrl } from '@/lib/access-page';
import { ensureBlueTickTables, isBlueTickEntitlementActive } from '@/lib/blue-tick';
import { db } from '@/lib/db';
import {
  buildLegacyAssetUrl,
  getHomeServiceGrid,
  getLegacySetting,
  getLegacySettingsMap,
  getSidebarServiceCatalog,
} from '@/lib/legacy-settings';
import { toNumber } from '@/lib/utils';

interface DepositStatsRow {
  total_deposit: number | string | bigint | null;
  monthly_deposit: number | string | bigint | null;
}

function normalizeHomeServiceTitle(service: ReturnType<typeof getHomeServiceGrid>[number]) {
  if (service.href === '/user/automxh' || service.key === '2') {
    return 'AUTO MẠNG XÃ HỘI';
  }

  if (service.href === '/user/automxh-api' || service.key === 'automxh_api') {
    return 'ĐẤU API';
  }

  return service.title;
}

function normalizeHomeServiceDesc(service: ReturnType<typeof getHomeServiceGrid>[number]) {
  if (service.href === '/vps' || service.key === '12') {
    return 'VPS tốc độ cao, bảo mật, an toàn';
  }

  if (service.href === '/user/automxh-api' || service.key === 'automxh_api') {
    return 'Tích hợp API AutoMXH, SMM và Game';
  }

  return service.desc;
}

async function getUser(userId: number) {
  try {
    await ensureBlueTickTables();

    const user = await db.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        fullname: true,
        avatar: true,
        balance: true,
        game_balance: true,
        rank: true,
        role: true,
        is_blue_tick: true,
        blue_tick_expiry: true,
      },
    });

    if (!user) {
      return null;
    }

    return {
      ...user,
      avatar: buildLegacyAssetUrl(user.avatar) || undefined,
      balance: toNumber(user.balance, 0),
      game_balance: toNumber(user.game_balance, 0),
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

    const rows = await db.$queryRawUnsafe<DepositStatsRow[]>(
      `
        SELECT
          COALESCE(SUM(CASE
            WHEN type = 'deposit' AND status = 'success' THEN amount
            ELSE 0
          END), 0) AS total_deposit,
          COALESCE(SUM(CASE
            WHEN type = 'deposit' AND status = 'success' AND created_at >= ?
              THEN amount
            ELSE 0
          END), 0) AS monthly_deposit
        FROM transactions
        WHERE user_id = ?
      `,
      monthStart,
      userId
    );
    const stats = rows[0];

    return {
      totalDeposit: toNumber(stats?.total_deposit, 0),
      monthlyDeposit: toNumber(stats?.monthly_deposit, 0),
    };
  } catch {
    return {
      totalDeposit: 0,
      monthlyDeposit: 0,
    };
  }
}

export default async function HomePage() {
  const userId = await getVerifiedSessionUserId();

  if (!userId) {
    redirect(buildAccessPageUrl({
      reason: 'login-required',
      area: 'user',
      next: '/user/home',
    }));
  }

  const [settings, user, depositStats] = await Promise.all([
    getLegacySettingsMap(),
    getUser(userId),
    getDepositStats(userId),
  ]);

  if (!user) {
    redirect(buildAccessPageUrl({
      reason: 'login-required',
      area: 'user',
      next: '/user/home',
    }));
  }

  const services = getHomeServiceGrid(settings).map((service, index) => ({
    ...service,
    title: normalizeHomeServiceTitle(service),
    desc: normalizeHomeServiceDesc(service),
    index: index + 1,
  }));
  const sidebarServices = getSidebarServiceCatalog(settings);
  const welcomeTitle = getLegacySetting(settings, 'home_welcome_title', 'Chào mừng trở lại,');
  const quickLaunch = services.filter((service) => !service.maintenance).slice(0, 3);
  const totalServiceModules = services.length + sidebarServices.length;
  const activeServiceModules = services.filter((service) => !service.maintenance).length;

  return (
    <AppShell
      user={{
        id: user.id,
        username: user.username,
        email: user.email,
        balance: user.balance,
        game_balance: user.game_balance,
        rank: user.rank || 'Member',
        role: String(user.role || 'member'),
        avatar: user.avatar || undefined,
        is_blue_tick: isBlueTickEntitlementActive(user.is_blue_tick, user.blue_tick_expiry),
        blue_tick_expiry: user.blue_tick_expiry ? user.blue_tick_expiry.toISOString() : null,
      }}
      sidebarServices={sidebarServices}
    >
      <div className="space-y-6 sm:space-y-8">
        <section className="dashboard-hero group min-w-0 p-4 sm:p-7 md:p-8">
          <div className="relative z-10 space-y-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="min-w-0 max-w-4xl">
                <div className="mb-4 inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 sm:px-3.5 sm:py-2">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  <span className="text-[9px] font-black uppercase tracking-[0.24em] text-emerald-500 dark:text-emerald-400 sm:text-[10px] sm:tracking-[0.34em]">
                    Hệ thống dịch vụ trực tuyến
                  </span>
                </div>
                <h1 className="max-w-4xl break-words text-3xl font-black uppercase leading-[1.16] tracking-[-0.02em] text-slate-950 dark:text-white sm:text-4xl md:text-5xl">
                  Trung tâm dịch vụ MMO
                </h1>
                <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-slate-600 dark:text-white/58">
                  Chọn nhanh SMM, Auto Mạng Xã Hội, tài nguyên MMO, proxy, VPS GPU AI, game account và các module hỗ trợ trong một màn hình tập trung.
                </p>
              </div>

              <div className="grid w-full grid-cols-2 gap-3 sm:min-w-[420px] xl:w-auto">
                {[
                  { label: 'Module', value: String(totalServiceModules), icon: Layers3, tone: 'text-brand-blue' },
                  { label: 'Đang mở', value: String(activeServiceModules), icon: CheckCircle2, tone: 'text-emerald-500' },
                  { label: 'Tốc độ cao', value: '12ms', icon: Clock3, tone: 'text-amber-500' },
                  { label: 'Bảo hành', value: '30 ngày', icon: Sparkles, tone: 'text-cyan-500' },
                ].map((item) => (
                  <div key={item.label} className="min-w-0 rounded-[1.15rem] border border-slate-200/80 bg-white/72 px-4 py-3 backdrop-blur-sm dark:border-white/8 dark:bg-white/[0.04]">
                    <div className="flex items-center gap-2 text-slate-400 dark:text-white/35">
                      <item.icon className={`h-3.5 w-3.5 ${item.tone}`} />
                      <span className="truncate text-[9px] font-black uppercase tracking-[0.22em]">{item.label}</span>
                    </div>
                    <div className="mt-2 truncate text-lg font-black uppercase tracking-[-0.03em] text-slate-950 dark:text-white">
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {services.map((service) => (
                <HomeServiceCard
                  key={`${service.key}-${service.index}`}
                  service={service}
                  className="dashboard-service-card home-service-card-compact h-full"
                />
              ))}
            </div>
          </div>
        </section>

        <section className="dashboard-quick-strip p-4 md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.24em] text-slate-400 dark:text-white/35 sm:text-[10px] sm:tracking-[0.34em]">
                Quick Launch
              </div>
              <h2 className="mt-2 text-xl font-black uppercase tracking-[-0.028em] text-slate-950 dark:text-white sm:text-2xl">
                Lối vào nhanh
              </h2>
            </div>
            <div className="grid w-full grid-cols-1 gap-3 md:w-auto md:min-w-[520px] md:grid-cols-3">
              {quickLaunch.map((item) => (
                <a
                  key={item.key}
                  href={item.maintenance ? 'javascript:void(0)' : item.href}
                  target={item.external && !item.maintenance ? '_blank' : undefined}
                  rel={item.external && !item.maintenance ? 'noreferrer' : undefined}
                  className={`flex min-w-0 items-center justify-between gap-3 rounded-[1rem] border px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] transition-all sm:text-xs sm:tracking-[0.2em] ${
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
        </section>

        <UserApikeyCard />

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="dashboard-quick-strip p-4 md:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="text-[9px] font-black uppercase tracking-[0.24em] text-slate-400 dark:text-white/35 sm:text-[10px] sm:tracking-[0.34em]">
                  {welcomeTitle}
                </div>
                <h2 className="mt-2 truncate text-2xl font-black uppercase tracking-[-0.03em] text-slate-950 dark:text-white">
                  {user.username}
                </h2>
              </div>
              <div className="grid w-full grid-cols-1 gap-3 min-[430px]:grid-cols-2 lg:w-auto lg:grid-cols-4">
                {[
                  { label: 'Ví chính', value: new Intl.NumberFormat('vi-VN').format(user.balance), icon: Wallet, tone: 'text-brand-blue' },
                  { label: 'Ví game', value: new Intl.NumberFormat('vi-VN').format(user.game_balance || 0), icon: Wallet, tone: 'text-emerald-500' },
                  { label: 'Tổng nạp', value: new Intl.NumberFormat('vi-VN').format(depositStats.totalDeposit), icon: Sparkles, tone: 'text-amber-500' },
                  { label: 'Cấp bậc', value: user.rank || 'Member', icon: TrendingUp, tone: 'text-cyan-500' },
                ].map((item) => (
                  <div key={item.label} className="min-w-0 rounded-[1.2rem] border border-slate-200/80 bg-white/72 px-4 py-3 dark:border-white/8 dark:bg-white/[0.04]">
                    <div className="flex items-center gap-2 text-slate-400 dark:text-white/35">
                      <item.icon className={`h-3.5 w-3.5 ${item.tone}`} />
                      <span className="truncate text-[9px] font-black uppercase tracking-[0.2em] sm:tracking-[0.28em]">{item.label}</span>
                    </div>
                    <div className="mt-2 truncate font-mono text-[min(1.125rem,4.2vw)] font-black leading-[1.08] tracking-[-0.04em] text-slate-950 dark:text-white">
                      {item.value}
                      {item.label.includes('Ví') || item.label === 'Tổng nạp' ? <span className="ml-1 text-[0.7em]">đ</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mmo-activity-panel">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="mmo-eyebrow">Live board</div>
                <h2 className="mt-1 text-base font-black uppercase text-white">Trạng thái hệ thống</h2>
              </div>
              <span className="mmo-badge mmo-badge-green">Stable</span>
            </div>
            <div className="mt-4 space-y-3">
              {[
                { icon: CheckCircle2, title: 'Nạp tiền tự động', desc: 'QR / VietQR sẵn sàng', tone: 'green' },
                { icon: Clock3, title: 'Đơn hàng đang chạy', desc: `${quickLaunch.length + services.length} cụm dịch vụ mở`, tone: 'blue' },
                { icon: TrendingUp, title: 'Tăng trưởng hôm nay', desc: '+12.8% lưu lượng xử lý', tone: 'amber' },
              ].map((item) => (
                <div key={item.title} className="mmo-activity-row">
                  <span className={`mmo-activity-icon mmo-activity-${item.tone}`}>
                    <item.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-black uppercase text-white">{item.title}</div>
                    <div className="mt-0.5 truncate text-[11px] font-bold text-slate-400">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
