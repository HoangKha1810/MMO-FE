'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Award,
  BarChart3,
  Briefcase,
  CheckCircle2,
  Cloud,
  CreditCard,
  ExternalLink,
  EyeOff,
  Flag,
  FolderOpen,
  Gamepad2,
  History,
  Key,
  Landmark,
  Layers,
  Layout,
  LayoutDashboard,
  LayoutGrid,
  Link2,
  ListVideo,
  Menu,
  Megaphone,
  Moon,
  Package,
  Percent,
  Search,
  Settings,
  ShieldAlert,
  ShoppingBag,
  ShoppingCart,
  Sun,
  Terminal,
  Users,
  Wallet,
  X,
  Bot,
  Headset,
} from 'lucide-react';
import type { AdminSessionUser } from '@/lib/admin-auth';
import { startThemeSwitchAnimation } from '@/lib/theme-switch-animation';
import { cn } from '@/lib/utils';
import { NotificationBell } from '@/components/layout/notification-bell';
import { BrandForestWordmark } from '@/components/ui/brand-forest-wordmark';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: 'blue' | 'red' | 'emerald' | 'amber';
};

type NavSection = {
  title: string;
  accent?: 'slate' | 'blue' | 'amber' | 'rose';
  items: NavItem[];
};

const adminNavSections: NavSection[] = [
  {
    title: 'Tổng quan',
    accent: 'slate',
    items: [
      { href: '/admin/dashboard', label: 'Trang chủ', icon: LayoutDashboard },
      { href: '/admin/activity-logs', label: 'Nhật ký hoạt động', icon: History },
      { href: '/admin/accounting', label: 'Đơn hàng SMM', icon: BarChart3 },
      { href: '/admin/accounting/extra', label: 'Kế toán ALL', icon: BarChart3, accent: 'blue' },
      { href: '/admin/smm/orders', label: 'Tracking SMM', icon: ShoppingBag },
    ],
  },
  {
    title: 'Người dùng',
    accent: 'slate',
    items: [
      { href: '/admin/users', label: 'Quản lý thành viên', icon: Users },
      { href: '/admin/security/check-ip', label: 'Kiểm tra IP', icon: Search },
      { href: '/admin/security', label: 'Bảo mật & IP Ban', icon: ShieldAlert, accent: 'red' },
    ],
  },
  {
    title: 'Dịch vụ SMM Pro',
    accent: 'blue',
    items: [
      { href: '/admin/smm/providers', label: 'Nguồn SMM', icon: Link2 },
      { href: '/admin/smm/services', label: 'Cấu Hình Dịch Vụ SMM', icon: Layers },
      { href: '/admin/smm/orders', label: 'Đơn SMM', icon: ShoppingBag },
      { href: '/admin/pricing', label: 'Bảng giá', icon: Percent },
    ],
  },
  {
    title: 'Dịch vụ Auto MXH',
    accent: 'blue',
    items: [
      { href: '/admin/automxh/categories', label: 'Danh mục Auto MXH', icon: FolderOpen },
      { href: '/admin/automxh/products', label: 'Dịch vụ Auto MXH', icon: ListVideo },
      { href: '/admin/automxh/orders', label: 'Quản Lý Đơn Hàng Auto MXH', icon: ShoppingCart },
    ],
  },
  {
    title: 'Tài nguyên MMO',
    accent: 'blue',
    items: [
      { href: '/admin/resources/products', label: 'Quản lý Sản phẩm MMO', icon: Package },
      { href: '/admin/resources/categories', label: 'Quản lý Danh mục', icon: LayoutGrid },
      { href: '/admin/resources/sales', label: 'Lịch sử Bán hàng', icon: History },
      { href: '/admin/resources/mmo-api', label: 'Quản lí API', icon: Terminal },
    ],
  },
  {
    title: 'Dịch vụ Proxy',
    accent: 'blue',
    items: [
      { href: '/admin/proxy', label: 'Cấu hình Proxy Cloud', icon: Cloud },
    ],
  },
  {
    title: 'Dịch vụ Thẻ',
    accent: 'amber',
    items: [
      { href: '/admin/card', label: 'Bảng điều khiển Thẻ', icon: LayoutGrid },
      { href: '/admin/card/history', label: 'Lịch sử giao dịch', icon: History },
      { href: '/admin/card/rates', label: 'Cấu hình giá/CK', icon: Percent },
      { href: '/admin/card/api', label: 'Cấu hình API', icon: Key },
    ],
  },
  {
    title: 'Thương mại',
    accent: 'rose',
    items: [
      { href: '/admin/game-market', label: 'Chợ tài khoản Game', icon: Gamepad2 },
      { href: '/admin/orders', label: 'Đơn hàng hệ thống', icon: ShoppingCart },
      { href: '/admin/deposits', label: 'Lịch sử nạp tiền', icon: Wallet },
      { href: '/admin/accounting/bank-api-logs', label: 'Lịch sử Bank API', icon: Landmark },
    ],
  },
  {
    title: 'Cộng đồng',
    accent: 'slate',
    items: [
      { href: '/admin/forum/categories', label: 'Cấu trúc Chuyên mục', icon: Layers },
      { href: '/admin/forum/forums', label: 'Danh sách các Box', icon: LayoutGrid },
      { href: '/admin/forum/badges', label: 'Huy hiệu & Cấp bậc', icon: Award },
      { href: '/admin/forum/reports', label: 'Xử lý Báo cáo', icon: Flag },
      { href: '/admin/forum/approvals', label: 'Duyệt Forum', icon: CheckCircle2, accent: 'emerald' },
      { href: '/admin/find-job', label: 'Find Job MMO', icon: Briefcase, accent: 'emerald' },
      { href: '/admin/forum/members', label: 'Tra cứu Thành viên', icon: Users },
      { href: '/admin/forum/hidden', label: 'Nội dung đã ẩn', icon: EyeOff },
      { href: '/admin/forum/settings', label: 'Cấu hình Diễn đàn', icon: Settings },
      { href: '/admin/forum/ads', label: 'Quảng cáo (Banner)', icon: Megaphone },
    ],
  },
  {
    title: 'Hệ thống',
    accent: 'slate',
    items: [
      { href: '/admin/settings/interface', label: 'Cấu hình Giao diện', icon: Layout },
      { href: '/admin/settings', label: 'Cài đặt chung', icon: Settings },
      { href: '/admin/support-tiktok', label: 'Support TikTok', icon: Headset },
      { href: '/admin/ai', label: 'Trợ lý Admin AI', icon: Bot },
    ],
  },
];

function accentHeading(accent?: NavSection['accent']) {
  switch (accent) {
    case 'blue':
      return 'text-brand-blue';
    case 'amber':
      return 'text-amber-500';
    case 'rose':
      return 'text-rose-500';
    default:
      return 'text-slate-500';
  }
}

function accentLink(item: NavItem, active: boolean) {
  if (active) {
    return 'border border-brand-blue/20 bg-brand-blue/10 text-brand-blue font-bold shadow-[0_18px_36px_-28px_rgba(37,99,235,0.45)] dark:border-brand-blue/25 dark:bg-brand-blue/12 dark:text-blue-300';
  }

  if (item.accent === 'red') {
    return 'text-slate-500 hover:bg-red-500/6 hover:text-red-500 dark:text-slate-400 dark:hover:bg-red-500/5 dark:hover:text-red-400';
  }

  if (item.accent === 'emerald') {
    return 'text-slate-500 hover:bg-emerald-500/6 hover:text-emerald-600 dark:text-slate-400 dark:hover:bg-emerald-500/5 dark:hover:text-emerald-500';
  }

  if (item.accent === 'amber') {
    return 'text-slate-500 hover:bg-amber-500/6 hover:text-amber-600 dark:text-slate-400 dark:hover:bg-amber-500/5 dark:hover:text-amber-500';
  }

  return 'text-slate-500 hover:bg-slate-900/[0.03] hover:text-brand-blue dark:text-slate-400 dark:hover:bg-white/5';
}

function getCurrentPageLabel(pathname: string) {
  const allItems = adminNavSections.flatMap((section) => section.items);
  const current = allItems
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];

  if (current) {
    return current.label;
  }

  const label = pathname.split('/').filter(Boolean).slice(-1)[0] || 'Dashboard';
  return label.replace(/-/g, ' ');
}

function initials(username: string) {
  return String(username || 'AD')
    .trim()
    .slice(0, 2)
    .toUpperCase();
}

export function AdminShell({
  children,
  user,
  branding,
}: {
  children: React.ReactNode;
  user: AdminSessionUser;
  branding: { siteName: string; siteLogo: string | null };
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const pathname = usePathname();
  const sidebarNavRef = useRef<HTMLElement | null>(null);
  const isDark = mounted ? resolvedTheme === 'dark' : true;
  const isFullscreenWorkspace = pathname === '/admin/ai';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const nav = sidebarNavRef.current;
    if (!nav) return;

    const saved = window.localStorage.getItem('adminSidebarScrollPos');
    if (saved) {
      nav.scrollTop = Number(saved) || 0;
    }

    const handleScroll = () => {
      window.localStorage.setItem('adminSidebarScrollPos', String(nav.scrollTop));
    };

    nav.addEventListener('scroll', handleScroll);
    return () => nav.removeEventListener('scroll', handleScroll);
  }, []);

  const currentPageLabel = useMemo(() => getCurrentPageLabel(pathname), [pathname]);

  function handleThemeToggle(event: React.MouseEvent<HTMLButtonElement>) {
    if (!mounted) {
      return;
    }

    const nextTheme = isDark ? 'light' : 'dark';
    startThemeSwitchAnimation({
      currentTheme: isDark ? 'dark' : 'light',
      nextTheme,
      setTheme,
      source: event.currentTarget,
    });
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-300 font-sans text-slate-950 antialiased dark:bg-[#0b0f1a] dark:text-white">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-slate-300 dark:hidden">
          <div className="absolute left-0 top-0 h-[600px] w-full bg-gradient-to-b from-slate-400/10 to-transparent" />
        </div>
        <div className="absolute inset-0 hidden bg-[#0b0f1a] dark:block">
          <div className="absolute left-0 top-0 h-[600px] w-full bg-gradient-to-b from-brand-blue/5 to-transparent" />
        </div>
      </div>

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 h-screen w-64 shrink-0 border-r border-slate-200 bg-[#f8fbff] [background-image:linear-gradient(180deg,#f8fbff_0%,#eef4ff_52%,#e7effd_100%)] text-slate-700 shadow-[24px_0_70px_-48px_rgba(15,23,42,0.22)] transition-all duration-300 dark:border-white/5 dark:bg-[#0b1220] dark:[background-image:linear-gradient(180deg,#101828_0%,#0d1626_52%,#0a111d_100%)] dark:text-slate-300 dark:shadow-none lg:static',
          sidebarOpen ? 'translate-x-0 lg:ml-0' : '-translate-x-full lg:-ml-64'
        )}
      >
        <div className="flex h-full flex-col overflow-hidden">
          <div className="flex h-20 items-center justify-between border-b border-slate-200/80 px-6 dark:border-white/5">
            <div className="min-w-0 flex items-center gap-3">
              {branding.siteLogo ? (
                <img src={branding.siteLogo} alt={branding.siteName} className="h-16 w-auto object-contain" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-blue to-blue-400 text-lg font-black text-white">
                  {initials(branding.siteName)}
                </div>
              )}
              <div className="min-w-0">
                <div className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                  Administration
                </div>
                <BrandForestWordmark
                  text={String(branding.siteName || 'TRUNGTAMMMO').replace(/\.vn$/i, '')}
                  className="mt-1 text-[0.72rem] text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-900/[0.04] hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white lg:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav
            id="admin-sidebar-nav"
            ref={sidebarNavRef}
            className="custom-scrollbar flex-1 space-y-1.5 overflow-y-auto p-5"
          >
            {adminNavSections.map((section) => (
              <div key={section.title}>
                <div
                  className={cn(
                    'px-4 pb-2 pt-4 text-[10px] font-black uppercase tracking-[0.2em]',
                    accentHeading(section.accent)
                  )}
                >
                  {section.title}
                </div>
                {section.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'group flex items-center space-x-3 rounded-lg px-4 py-3 transition-all',
                        accentLink(item, active)
                      )}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span className="truncate text-sm font-bold">{item.label}</span>
                      {item.accent === 'red' ? (
                        <span className="ml-auto rounded-full bg-red-500/10 px-1.5 py-0.5 text-[9px] font-black leading-none text-red-500 dark:text-red-400">
                          NEW
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="shrink-0 border-t border-slate-200/80 p-5 dark:border-white/5">
            <Link
              href="/user/home"
              className="flex w-full items-center justify-center rounded-lg bg-brand-blue px-4 py-3 text-xs font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-brand-blue/20 transition-all hover:bg-blue-600"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Về trang chủ
            </Link>
          </div>
        </div>
      </aside>

      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Đóng sidebar admin"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden bg-white dark:bg-black">
        <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white/80 px-6 backdrop-blur-md dark:border-white/5 dark:bg-slate-900/80">
          <div className="flex items-center space-x-6">
            <button
              type="button"
              onClick={() => setSidebarOpen((current) => !current)}
              className="rounded-xl bg-slate-100 p-2.5 outline-none transition-all hover:bg-brand-blue/10 hover:text-brand-blue dark:bg-white/5"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden md:block">
              <div className="mb-1 text-[9px] font-black uppercase leading-none tracking-widest text-slate-400">
                ADMINISTRATION
              </div>
              <div className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">
                {currentPageLabel}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-5">
            <button
              type="button"
              onClick={handleThemeToggle}
              className="rounded-xl bg-slate-100 p-2.5 outline-none transition-all hover:text-brand-blue dark:bg-white/5"
            >
              {mounted && isDark ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4 text-slate-500" />
              )}
            </button>

            <NotificationBell className="h-10 w-10 rounded-xl shadow-none" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="relative flex items-center space-x-3 rounded-xl p-1 outline-none transition-all hover:bg-slate-50 dark:hover:bg-white/5"
                >
                  <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-tr from-brand-blue to-blue-400 font-bold text-white shadow-lg shadow-brand-blue/20">
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.username} className="h-full w-full object-cover" />
                    ) : (
                      initials(user.username)
                    )}
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="mt-4 w-64 rounded-2xl p-4">
                <div className="mb-2 border-b border-slate-100 px-3 py-2 dark:border-white/5">
                  <div className="mb-1 text-[9px] font-black uppercase leading-none tracking-widest text-slate-400">
                    Administrator
                  </div>
                  <div className="flex items-center gap-1 text-sm font-bold text-brand-blue">
                    <span className="truncate">{user.username}</span>
                    {user.isBlueTick ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : null}
                  </div>
                  <div className="mt-1 truncate text-[11px] font-semibold text-slate-400">{user.email}</div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a
                    href="/api/auth/logout"
                    className="flex items-center gap-3 rounded-xl bg-red-50 px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-red-600 transition-all hover:bg-red-600 hover:text-white dark:bg-red-500/10 dark:text-red-400"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Đăng xuất
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main
          className={cn(
            'relative flex-1 overflow-x-hidden bg-white dark:bg-black',
            isFullscreenWorkspace ? 'overflow-hidden' : 'custom-scrollbar overflow-y-auto'
          )}
        >
          <div className={cn('w-full', isFullscreenWorkspace ? 'h-full px-4 py-4 md:px-6 md:py-6' : 'px-4 py-10 md:px-6')}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
