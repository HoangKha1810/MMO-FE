'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  BarChart3,
  BadgeDollarSign,
  ChevronRight,
  CreditCard,
  Database,
  FileText,
  Headset,
  LayoutDashboard,
  Package,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  ShoppingCart,
  Moon,
  Sun,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NotificationBell } from '@/components/layout/notification-bell';

const adminNavItems = [
  {
    section: 'Tổng quan',
    items: [
      { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/admin/orders', label: 'Đơn Hàng', icon: ShoppingCart },
      { href: '/admin/deposits', label: 'Nạp Tiền', icon: Wallet },
    ],
  },
  {
    section: 'Dịch vụ',
    items: [
      { href: '/admin/pricing', label: 'Bảng Giá', icon: BadgeDollarSign },
      { href: '/admin/smm', label: 'SMM Dịch vụ', icon: Zap },
      { href: '/admin/automxh', label: 'Auto MXH', icon: Zap },
      { href: '/admin/resources', label: 'Tài nguyên MMO', icon: Package },
      { href: '/admin/card', label: 'Thẻ Cào', icon: CreditCard },
      { href: '/admin/game-market', label: 'Game Market', icon: ShoppingCart },
      { href: '/admin/find-job', label: 'Find Job', icon: FileText },
      { href: '/admin/support-tiktok', label: 'Support TikTok', icon: Headset },
    ],
  },
  {
    section: 'Cộng đồng',
    items: [
      { href: '/admin/forum', label: 'Diễn Đàn', icon: FileText },
      { href: '/admin/users', label: 'Người Dùng', icon: Users },
    ],
  },
  {
    section: 'Hệ thống',
    items: [
      { href: '/admin/accounting', label: 'Kế Toán', icon: BarChart3 },
      { href: '/admin/settings', label: 'Cài Đặt', icon: Settings },
      { href: '/admin/security', label: 'Bảo Mật', icon: Shield },
      { href: '/admin/ip-blocks', label: 'Chặn IP', icon: ShieldAlert },
      { href: '/admin/activity-logs', label: 'Nhật ký', icon: Database },
    ],
  },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [themePulse, setThemePulse] = useState<'light' | 'dark' | null>(null);
  const themeTimerRef = useRef<number | null>(null);
  const { resolvedTheme, setTheme } = useTheme();
  const pathname = usePathname();
  const isDark = mounted ? resolvedTheme === 'dark' : true;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    return () => {
      if (themeTimerRef.current) {
        window.clearTimeout(themeTimerRef.current);
      }
    };
  }, []);

  function handleThemeToggle() {
    if (!mounted) {
      return;
    }

    const nextTheme = isDark ? 'light' : 'dark';
    setThemePulse(nextTheme);
    document.documentElement.classList.add('theme-switching');
    document.documentElement.style.colorScheme = nextTheme;
    setTheme(nextTheme);

    if (themeTimerRef.current) {
      window.clearTimeout(themeTimerRef.current);
    }

    themeTimerRef.current = window.setTimeout(() => {
      document.documentElement.classList.remove('theme-switching');
      setThemePulse(null);
    }, 380);
  }

  return (
    <div className="site-shell flex min-h-screen text-slate-900 dark:text-white">
      {themePulse ? <div className={cn('theme-transition-overlay', themePulse === 'dark' ? 'theme-transition-overlay-dark' : 'theme-transition-overlay-light')} /> : null}
      <aside
        className={cn(
          'surface-panel-strong fixed inset-y-0 left-0 z-50 flex w-64 flex-col transition-transform duration-300 lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center gap-3 border-b border-slate-200/60 p-6 dark:border-white/10">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-blue to-blue-400 text-lg font-black text-white">
            M
          </div>
          <div>
            <div className="text-sm font-black uppercase text-slate-900 dark:text-white">Admin Panel</div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">TRUNGTAMMMO</div>
          </div>
        </div>

        <nav className="custom-scrollbar flex-1 space-y-6 overflow-y-auto p-4">
          {adminNavItems.map((group) => (
            <div key={group.section}>
              <div className="mb-3 px-3 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                {group.section}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'nav-link-shell interactive-lift flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-all',
                        isActive
                          ? 'nav-link-active'
                          : 'nav-link-idle'
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-4 dark:border-white/10">
          <Link
            href="/user/home"
            className="nav-link-shell nav-link-idle interactive-lift flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-all"
          >
            <ChevronRight className="h-4 w-4 rotate-180" />
            Quay lại trang chính
          </Link>
        </div>
      </aside>

      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Đóng menu admin"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="surface-panel sticky top-0 z-30 mx-4 mt-4 flex h-16 items-center justify-between gap-4 rounded-[1.35rem] px-4 lg:mx-6 lg:px-6">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="surface-chip rounded-xl p-2 transition-all hover:-translate-y-0.5 lg:hidden"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" x2="20" y1="12" y2="12" />
              <line x1="4" x2="20" y1="6" y2="6" />
              <line x1="4" x2="20" y1="18" y2="18" />
            </svg>
          </button>

          <div className="relative hidden max-w-md flex-1 md:block">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm nhanh..."
              className="field-elevated h-10 w-full rounded-xl pl-11 pr-4 text-xs font-bold outline-none transition-all dark:text-white dark:placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleThemeToggle}
              className="theme-switch-shell border border-slate-200/80 bg-white/80 shadow-[0_14px_40px_-24px_rgba(37,99,235,0.26)] dark:border-white/10 dark:bg-white/[0.04]"
              data-mode={mounted && isDark ? 'dark' : 'light'}
              aria-label="Toggle theme"
            >
              <Sun className="theme-switch-icon theme-switch-icon-sun h-3.5 w-3.5 text-amber-500" />
              <Moon className="theme-switch-icon theme-switch-icon-moon h-3.5 w-3.5 text-slate-500 dark:text-slate-300" />
              <span className={cn('theme-switch-thumb', mounted && isDark ? 'translate-x-[2.5rem]' : 'translate-x-0')}>
                {mounted && isDark ? <Moon className="theme-switch-thumb-icon h-3.5 w-3.5 text-white" /> : <Sun className="theme-switch-thumb-icon h-3.5 w-3.5 text-white" />}
              </span>
            </button>
            <NotificationBell className="h-10 w-10 shadow-[0_14px_40px_-24px_rgba(37,99,235,0.26)]" />
            <Link
              href="/user/home"
              className="btn-kinetic rounded-xl bg-[linear-gradient(135deg,#2563eb_0%,#1d4ed8_48%,#0ea5e9_100%)] px-4 py-2 text-xs font-bold uppercase text-white transition-all hover:-translate-y-0.5"
            >
              Trang chủ
            </Link>
          </div>
        </header>

        <main className="page-stack flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
