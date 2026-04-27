import Link from 'next/link';
import {
  ArrowRight,
  Compass,
  Home,
  LayoutDashboard,
  LockKeyhole,
  LogIn,
  ShieldAlert,
  UserRound,
} from 'lucide-react';
import { SessionSwitchButton } from '@/components/auth/session-switch-button';

type RawParams = Record<string, string | string[] | undefined>;

function pickParam(params: RawParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? String(value[0] || '') : String(value || '');
}

function resolveScenario(params: RawParams) {
  const reason = pickParam(params, 'reason');
  const area = pickParam(params, 'area');
  const role = pickParam(params, 'role');
  const next = pickParam(params, 'next');
  const service = pickParam(params, 'service');
  const isAdmin = role === 'admin';

  if (reason === 'service-alias') {
    return {
      reason,
      badge: 'Smart Redirect',
      title: `${service || 'Đường dẫn này'} không nằm ở đây nữa`,
      description: `Bạn vừa mở một đường dẫn rút gọn hoặc đường dẫn cũ. Mình đã giữ lại một trang trung gian để bạn chọn đúng nơi cần tới thay vì rơi thẳng vào 404.`,
      accent: 'from-violet-500/18 via-sky-500/12 to-transparent',
      border: 'border-violet-500/20',
      icon: Compass,
      hints: [
        next ? `Đích đúng của module này là ${next}.` : 'Đường dẫn này cần được điều hướng sang module đúng.',
        role ? 'Phiên hiện tại vẫn còn hoạt động, bạn có thể đi tiếp ngay.' : 'Nếu chưa đăng nhập, hãy dùng nút vào cổng phù hợp trước.',
      ],
      area,
      role,
      next,
      isAdmin,
      service,
    };
  }

  if (reason === 'admin-only') {
    return {
      reason,
      badge: 'Admin Only',
      title: 'Khu vực này chỉ dành cho admin',
      description: 'Tài khoản hiện tại không có quyền quản trị. Bạn có thể quay về khu người dùng hoặc đổi sang tài khoản admin khác để tiếp tục.',
      accent: 'from-rose-500/22 via-orange-500/12 to-transparent',
      border: 'border-rose-500/20',
      icon: ShieldAlert,
      hints: [
        'Bạn đang chạm vào một route quản trị có yêu cầu role admin.',
        'Nếu cần đổi tài khoản, có thể dùng nút chuyển tài khoản bên dưới.',
      ],
      area,
      role,
      next,
      isAdmin,
      service,
    };
  }

  if (reason === 'login-required') {
    const target = area === 'admin' ? 'khu admin' : 'khu người dùng';
    return {
      reason,
      badge: 'Session Required',
      title: 'Bạn cần đăng nhập để tiếp tục',
      description: `Route bạn vừa mở thuộc ${target}, nên hệ thống đưa bạn về trang điều hướng để vào đúng cổng thay vì ném thẳng về form login.`,
      accent: 'from-sky-500/22 via-cyan-500/12 to-transparent',
      border: 'border-sky-500/20',
      icon: LockKeyhole,
      hints: [
        'Nếu chỉ muốn xem tổng quan, bạn có thể quay về trang chủ.',
        'Nếu bạn đang vào khu admin, hãy dùng cổng đăng nhập admin riêng.',
      ],
      area,
      role,
      next,
      isAdmin,
      service,
    };
  }

  return {
    reason: 'already-authenticated' as const,
    badge: 'Already Signed In',
    title: 'Bạn đã đăng nhập rồi',
    description: 'Bạn đang ở khu xác thực trong khi phiên đăng nhập vẫn còn hoạt động. Dưới đây là các lối đi nhanh để quay về đúng khu vực làm việc.',
    accent: 'from-emerald-500/20 via-blue-500/12 to-transparent',
    border: 'border-emerald-500/20',
    icon: Compass,
    hints: [
      'Không cần đăng nhập lại nếu bạn chỉ vào nhầm /auth.',
      'Nếu muốn đổi tài khoản, hãy dùng nút chuyển tài khoản để logout an toàn trước khi vào cổng khác.',
    ],
    area,
    role,
    next,
    isAdmin,
    service,
  };
}

export default async function AccessPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const params = await searchParams;
  const scenario = resolveScenario(params);
  const Icon = scenario.icon;
  const primaryHref = scenario.next || (scenario.area === 'admin' ? '/admin/dashboard' : scenario.area === 'auth' ? '/auth/login' : '/user/home');
  const primaryLabel = scenario.reason === 'service-alias'
    ? `Đi tới ${scenario.service || 'đúng trang'}`
    : scenario.reason === 'login-required'
      ? (scenario.area === 'admin' ? 'Vào cổng admin' : 'Vào đăng nhập')
      : scenario.reason === 'admin-only'
        ? 'Về khu người dùng'
        : 'Tiếp tục đúng khu vực';

  const quickLinks = [
    {
      href: '/',
      label: 'Trang chủ',
      note: 'Quay về landing page chính',
      icon: Home,
    },
    {
      href: '/user/home',
      label: 'Khu người dùng',
      note: 'Dashboard dành cho member',
      icon: UserRound,
    },
    ...(scenario.isAdmin
      ? [{
        href: '/admin/dashboard',
        label: 'Bảng admin',
        note: 'Vào thẳng dashboard quản trị',
        icon: LayoutDashboard,
      }]
      : []),
  ];

  return (
    <main className={`min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.16),transparent_30%),linear-gradient(180deg,#f8fbff,#eef4ff_40%,#f8fafc)] px-5 py-8 dark:bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_32%),linear-gradient(180deg,#050816,#0b1220_36%,#0f172a)]`}>
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center">
        <section className="grid w-full gap-6 lg:grid-cols-[minmax(0,1.15fr)_380px]">
          <div className="surface-panel-strong relative overflow-hidden rounded-[2rem] p-7 sm:p-9">
            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${scenario.accent}`} />
            <div className="relative z-10">
              <div className={`inline-flex items-center gap-2 rounded-full border ${scenario.border} bg-white/70 px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-slate-700 dark:bg-white/[0.05] dark:text-slate-100`}>
                <Icon className="h-4 w-4" />
                {scenario.badge}
              </div>

              <h1 className="mt-6 max-w-3xl text-4xl font-black uppercase tracking-[-0.06em] text-slate-950 dark:text-white sm:text-5xl">
                {scenario.title}
              </h1>

              <p className="mt-5 max-w-2xl text-sm font-semibold leading-8 text-slate-600 dark:text-slate-300 sm:text-[15px]">
                {scenario.description}
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="surface-card rounded-[1.5rem] p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Trạng thái</div>
                  <div className="mt-3 text-lg font-black text-slate-950 dark:text-white">
                    {scenario.role ? `Role ${scenario.role}` : 'Chưa có phiên'}
                  </div>
                </div>
                <div className="surface-card rounded-[1.5rem] p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Khu vực</div>
                  <div className="mt-3 text-lg font-black text-slate-950 dark:text-white">
                    {scenario.area || 'Điều hướng chung'}
                  </div>
                </div>
                <div className="surface-card rounded-[1.5rem] p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Đích gần nhất</div>
                  <div className="mt-3 truncate text-lg font-black text-slate-950 dark:text-white">
                    {scenario.next || 'Tự động đề xuất'}
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={primaryHref}
                  className="btn-kinetic inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#2563eb_0%,#1d4ed8_48%,#0ea5e9_100%)] px-6 py-3 text-xs font-black uppercase tracking-[0.18em] text-white"
                >
                  {scenario.reason === 'service-alias' ? <ArrowRight className="h-4 w-4" /> : <Home className="h-4 w-4" />}
                  {primaryLabel}
                </Link>

                {scenario.role ? (
                  <SessionSwitchButton
                    href={scenario.area === 'admin' ? '/auth/admin-login' : '/auth/login'}
                    label={scenario.area === 'admin' ? 'Đổi sang admin khác' : 'Đổi tài khoản'}
                    className="surface-chip rounded-full px-6 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-700 transition hover:-translate-y-0.5 dark:text-slate-100"
                  />
                ) : (
                  <Link
                    href={scenario.area === 'admin' ? '/auth/admin-login' : '/auth/login'}
                    className="surface-chip inline-flex items-center gap-2 rounded-full px-6 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-700 transition hover:-translate-y-0.5 dark:text-slate-100"
                  >
                    <LogIn className="h-4 w-4" />
                    {scenario.area === 'admin' ? 'Vào cổng admin' : 'Đăng nhập'}
                  </Link>
                )}

                <Link
                  href="/"
                  className="surface-chip inline-flex items-center gap-2 rounded-full px-6 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-700 transition hover:-translate-y-0.5 dark:text-slate-100"
                >
                  <Home className="h-4 w-4" />
                  Về trang chủ
                </Link>
              </div>
            </div>
          </div>

          <aside className="space-y-5">
            <section className="surface-panel-strong rounded-[2rem] p-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-white dark:bg-white dark:text-slate-950">
                <Compass className="h-3.5 w-3.5" />
                Điều hướng nhanh
              </div>

              <div className="mt-5 space-y-3">
                {quickLinks.map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="group flex items-center justify-between gap-3 rounded-[1.35rem] border border-slate-200/80 bg-white/72 px-4 py-4 transition hover:-translate-y-0.5 hover:border-brand-blue/25 hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-brand-blue/10 text-brand-blue">
                          <ItemIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="text-sm font-black uppercase tracking-[0.12em] text-slate-950 dark:text-white">
                            {item.label}
                          </div>
                          <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                            {item.note}
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-brand-blue" />
                    </Link>
                  );
                })}
              </div>
            </section>

            <section className="surface-panel-strong rounded-[2rem] p-6">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                Gợi ý
              </div>
              <div className="mt-4 space-y-3">
                {scenario.hints.map((hint) => (
                  <div
                    key={hint}
                    className="rounded-[1.25rem] border border-slate-200/70 bg-slate-50/80 px-4 py-3 text-xs font-semibold leading-6 text-slate-600 dark:border-white/8 dark:bg-white/[0.03] dark:text-slate-300"
                  >
                    {hint}
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
