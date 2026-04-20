'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  Briefcase,
  ChevronDown,
  Cloud,
  CreditCard,
  FileText,
  Gamepad2,
  Globe,
  GraduationCap,
  Grid3x3,
  Headset,
  History,
  Home,
  Layers3,
  LogOut,
  Menu,
  MessageSquare,
  MessageCircle,
  Moon,
  Monitor,
  Music,
  Package,
  Plus,
  Search,
  Send,
  Server,
  Shield,
  ShieldCheck,
  ShoppingCart,
  Sun,
  ThumbsUp,
  UserCircle2,
  Wallet,
  Video,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { startPageTransition } from '@/components/layout/navigation-effects';
import { useSessionUser, type SessionUser } from '@/hooks/use-session-user';
import type { LegacyServiceItem } from '@/lib/legacy-settings';

const mainLinks = [
  { href: '/user/home', label: 'Trang Chủ', icon: Grid3x3 },
  { href: '/user/deposit', label: 'Nạp Tiền Hệ Thống', icon: Wallet },
  { href: '/user/statistics', label: 'Thông Tin Tài Khoản', icon: BarChart3 },
  { href: '/user/history', label: 'Lịch sử giao dịch All', icon: Layers3 },
  { href: '/user/forum', label: 'Forum MMO', icon: MessageSquare },
  { href: '/user/social/inbox', label: 'Tin Nhắn', icon: MessageCircle },
  { href: '/user/find-job', label: 'Find Job MMO', icon: Briefcase },
  { href: '/user/seller/dashboard', label: 'Seller Center', icon: Package },
];

const supportLinks = [
  { href: '/', label: 'Giới Thiệu' },
  { href: '/terms', label: 'Chính Sách Dịch Vụ' },
  { href: '/privacy', label: 'Chính Sách Hệ Thống' },
];

const connectionLinks = [
  { href: '/user/statistics', label: 'Cấp Bậc Thành Viên' },
  { href: '/user/smm', label: 'Tài Liệu API' },
];

const serviceIconMap = {
  'thumbs-up': ThumbsUp,
  zap: Zap,
  package: Package,
  bot: Bot,
  'gamepad-2': Gamepad2,
  'credit-card': CreditCard,
  'message-square': MessageSquare,
  briefcase: Briefcase,
  'book-open': BookOpen,
  headset: Headset,
  cloud: Cloud,
  'shopping-cart': ShoppingCart,
  monitor: Monitor,
  server: Server,
  'shield-check': ShieldCheck,
  wrench: Wrench,
  'graduation-cap': GraduationCap,
  video: Video,
  facebook: Globe,
  'message-circle': MessageCircle,
  music: Music,
  send: Send,
} as const;

const smmPlatformLinks = [
  { href: '/user/smm#platform-Facebook', label: 'Facebook', icon: Globe, color: 'text-blue-500' },
  { href: '/user/smm#platform-TikTok', label: 'TikTok', icon: Music, color: 'text-slate-500 dark:text-slate-300' },
  { href: '/user/smm#platform-Instagram', label: 'Instagram', icon: MessageCircle, color: 'text-pink-500' },
  { href: '/user/smm#platform-YouTube', label: 'YouTube', icon: Video, color: 'text-red-500' },
  { href: '/user/smm#platform-Telegram', label: 'Telegram', icon: Send, color: 'text-sky-500' },
  { href: '/user/smm#platform-Shopee', label: 'Shopee', icon: ShoppingCart, color: 'text-orange-500' },
  { href: '/user/smm#platform-Threads', label: 'Threads', icon: MessageCircle, color: 'text-slate-500' },
];

const autoMxhPlatformLinks = [
  { href: '/user/automxh', label: 'Facebook', icon: Globe, color: 'text-blue-500' },
  { href: '/user/automxh', label: 'INSTAGRAM', icon: MessageCircle, color: 'text-pink-500' },
  { href: '/user/automxh', label: 'TikTok', icon: Music, color: 'text-slate-500 dark:text-slate-300' },
  { href: '/user/automxh', label: 'X TWITTER', icon: MessageCircle, color: 'text-slate-500 dark:text-slate-300' },
  { href: '/user/automxh', label: 'YOUTUBE', icon: Video, color: 'text-red-500' },
];

const utilityLinks = [
  { href: '/user/profile', label: '2FA Live Tool', icon: Shield },
  { href: '/user/smm', label: 'GET UID FB', icon: Globe },
];

interface AppShellProps {
  children: React.ReactNode;
  user?: SessionUser;
  isAdmin?: boolean;
  sidebarServices?: LegacyServiceItem[];
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.floor(amount || 0));
}

function isPathActive(pathname: string, href: string) {
  if (href === '/') {
    return pathname === '/';
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function formatBreadcrumb(pathname: string) {
  const labels: Record<string, string> = {
    user: 'User',
    admin: 'Admin',
    home: 'Trang Chủ',
    smm: 'Tăng Tương Tác',
    automxh: 'Auto MXH',
    resources: 'Tài Nguyên',
    card: 'Đổi Thẻ',
    deposit: 'Nạp Tiền',
    'support-tiktok': 'Support TikTok',
    forum: 'Forum MMO',
    'game-market': 'Mua Bán Game',
    'find-job': 'Find Job MMO',
    history: 'Lịch Sử',
    statistics: 'Thông Tin Tài Khoản',
    profile: 'Hồ Sơ',
    cart: 'Giỏ Hàng',
    terms: 'Chính Sách Dịch Vụ',
    privacy: 'Chính Sách Hệ Thống',
  };

  return pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => labels[segment] || segment.replace(/-/g, ' '));
}

function getNavLinkClass(active: boolean, extraClassName?: string) {
  return cn(
    'nav-link-shell interactive-lift group flex items-center rounded-[1rem] px-3 py-2.5 text-sm font-bold transition-all duration-200',
    active ? 'nav-link-active' : 'nav-link-idle',
    extraClassName
  );
}

function getSubLinkClass(active: boolean) {
  return cn(
    'block truncate whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-bold transition-all',
    active
      ? 'bg-[rgba(37,99,235,0.08)] text-brand-blue dark:bg-[rgba(37,99,235,0.12)]'
      : 'text-slate-400 hover:bg-white/70 hover:text-slate-700 dark:hover:bg-white/[0.04] dark:hover:text-white/70'
  );
}

export function AppShell({ children, user, isAdmin = false, sidebarServices }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const currentUser = useSessionUser(user);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [forumSearch, setForumSearch] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  const [resolvedSidebarServices, setResolvedSidebarServices] = useState<LegacyServiceItem[]>(sidebarServices || []);
  const [themePulse, setThemePulse] = useState<'light' | 'dark' | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [supportOpen, setSupportOpen] = useState(
    pathname === '/terms' || pathname === '/privacy' || pathname === '/'
  );
  const [connectionOpen, setConnectionOpen] = useState(
    pathname === '/user/statistics' || pathname === '/user/smm'
  );
  const themeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    return () => {
      if (themeTimerRef.current) {
        window.clearTimeout(themeTimerRef.current);
      }
      document.documentElement.classList.remove('theme-switching');
    };
  }, []);

  useEffect(() => {
    if (!mounted || !resolvedTheme) {
      return;
    }

    const isDarkTheme = resolvedTheme === 'dark';
    document.documentElement.classList.toggle('dark', isDarkTheme);
    document.documentElement.style.colorScheme = isDarkTheme ? 'dark' : 'light';
  }, [mounted, resolvedTheme]);

  useEffect(() => {
    if (sidebarServices?.length) {
      setResolvedSidebarServices(sidebarServices);
      return;
    }

    if (isAdmin) {
      setResolvedSidebarServices([]);
      return;
    }

    let active = true;

    async function loadSidebarServices() {
      try {
        const response = await fetch('/api/ui/services', { cache: 'no-store' });
        if (!response.ok) {
          return;
        }

        const payload = await response.json();
        if (active && Array.isArray(payload.sidebar)) {
          setResolvedSidebarServices(payload.sidebar);
        }
      } catch {
        if (active) {
          setResolvedSidebarServices([]);
        }
      }
    }

    void loadSidebarServices();

    return () => {
      active = false;
    };
  }, [isAdmin, sidebarServices]);

  useEffect(() => {
    if (pathname.startsWith('/terms') || pathname.startsWith('/privacy') || pathname === '/') {
      setSupportOpen(true);
    }

    if (pathname.startsWith('/user/statistics') || pathname.startsWith('/user/smm')) {
      setConnectionOpen(true);
    }
  }, [pathname]);

  const isDark = mounted ? resolvedTheme === 'dark' : true;
  const isHome = pathname === '/user/home';
  const isSmmArea = pathname.startsWith('/user/smm');
  const isAutoMxhArea = pathname.startsWith('/user/automxh');
  const breadcrumbs = useMemo(() => formatBreadcrumb(pathname), [pathname]);

  function handleThemeToggle() {
    if (!mounted) {
      return;
    }

    const nextTheme = isDark ? 'light' : 'dark';
    setThemePulse(nextTheme);
    document.documentElement.classList.add('theme-switching');
    document.documentElement.style.colorScheme = nextTheme;

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setTheme(nextTheme);
      });
    });

    if (themeTimerRef.current) {
      window.clearTimeout(themeTimerRef.current);
    }

    themeTimerRef.current = window.setTimeout(() => {
      document.documentElement.classList.remove('theme-switching');
      setThemePulse(null);
    }, 680);
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>, target: 'forum' | 'service') {
    event.preventDefault();

    const keyword = (target === 'forum' ? forumSearch : serviceSearch).trim();
    const destination = target === 'forum' ? '/user/forum' : '/user/smm';

    startPageTransition();
    router.push(keyword ? `${destination}?search=${encodeURIComponent(keyword)}` : destination);
  }

  async function handleLogout() {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);

    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      startPageTransition();
      router.push('/auth/login');
      router.refresh();
      setSidebarOpen(false);
      setLoggingOut(false);
    }
  }

  return (
    <div className="site-shell h-dvh overflow-hidden">
      {themePulse ? <div className={cn('theme-transition-overlay', themePulse === 'dark' ? 'theme-transition-overlay-dark' : 'theme-transition-overlay-light')} /> : null}
      <div className="flex h-dvh overflow-hidden">

        {/* Backdrop overlay */}
        {sidebarOpen ? (
          <button
            type="button"
            aria-label="Close sidebar"
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        {/* ─── SIDEBAR ─── */}
        <aside
          className={cn(
            'shell-sidebar-frame fixed inset-y-0 left-0 z-50 h-dvh w-[286px] shrink-0 transition-all duration-300 lg:sticky lg:top-0 lg:translate-x-0',
            sidebarOpen ? 'translate-x-0 shadow-2xl shadow-black/20' : '-translate-x-full'
          )}
        >
          <div className="relative flex h-full flex-col overflow-hidden px-3 py-3">

            {/* Sidebar header */}
            <div className="relative z-10">
              <div className="shell-brand-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link href={isAdmin ? '/admin/dashboard' : '/user/home'} className="min-w-0 flex-1">
                    <img
                      src="/logo.gif"
                      alt="TRUNGTAMMMO.VN Logo"
                      className="h-14 w-auto object-contain"
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="tag-pill">control deck</span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.22em] text-emerald-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        online
                      </span>
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(false)}
                    className="surface-chip rounded-xl p-2 text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-white lg:hidden"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Nav items */}
            <nav id="sidebar-nav" className="relative z-10 mt-3 flex-1 overflow-y-auto px-2 pb-2 custom-scrollbar">
              <div className="px-3 pb-2 pt-4 text-[9px] font-black uppercase tracking-[0.32em] text-slate-400/70 dark:text-white/25">
                Trang Chính
              </div>

              {mainLinks.map((item) => {
                const active = isPathActive(pathname, item.href);
                return (
                  <Link key={item.href} href={item.href} className={getNavLinkClass(active, 'space-x-3')}>
                    <item.icon className={cn('h-4 w-4 shrink-0', active ? 'text-brand-blue' : 'text-slate-400 group-hover:text-slate-600 dark:text-white/30 dark:group-hover:text-white/60')} />
                    <span className="truncate whitespace-nowrap">{item.label}</span>
                  </Link>
                );
              })}

              {/* Support accordion */}
              <div className="mt-1">
                <button
                  type="button"
                  onClick={() => setSupportOpen((open) => !open)}
                  className={getNavLinkClass(false, 'w-full justify-between')}
                >
                  <div className="flex min-w-0 items-center space-x-3">
                    <FileText className="h-4 w-4 shrink-0 text-slate-400 dark:text-white/30" />
                    <span className="truncate whitespace-nowrap text-sm font-bold">Chính Sách & Hỗ Trợ</span>
                  </div>
                  <ChevronDown
                    className={cn('h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200', supportOpen && 'rotate-180')}
                  />
                </button>
                {supportOpen ? (
                  <div className="ml-3 mt-1 space-y-1 border-l border-slate-200 pl-3 dark:border-white/[0.06]">
                    {supportLinks.map((item) => (
                      <Link
                        key={item.label}
                        href={item.href}
                        className={getSubLinkClass(isPathActive(pathname, item.href))}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Connection accordion */}
              <div className="mt-1">
                <button
                  type="button"
                  onClick={() => setConnectionOpen((open) => !open)}
                  className={getNavLinkClass(false, 'w-full justify-between')}
                >
                  <div className="flex min-w-0 items-center space-x-3">
                    <Award className="h-4 w-4 shrink-0 text-slate-400 dark:text-white/30" />
                    <span className="truncate whitespace-nowrap text-sm font-bold">Kết Nối & Cấp Bậc</span>
                  </div>
                  <ChevronDown
                    className={cn(
                      'h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-200',
                      connectionOpen && 'rotate-180'
                    )}
                  />
                </button>
                {connectionOpen ? (
                  <div className="ml-3 mt-1 space-y-1 border-l border-slate-200 pl-3 dark:border-white/[0.06]">
                    {connectionLinks.map((item) => (
                      <Link
                        key={item.label}
                        href={item.href}
                        className={getSubLinkClass(isPathActive(pathname, item.href))}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* SMM platform links */}
              {!isAdmin && isSmmArea ? (
                <>
                  <div className="px-3 pb-2 pt-6 text-[9px] font-black uppercase tracking-[0.32em] text-slate-400/70 dark:text-white/25">
                    Dịch Vụ SMM
                  </div>
                  {smmPlatformLinks.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      className={getNavLinkClass(false, 'justify-between')}
                    >
                      <div className="flex min-w-0 items-center space-x-3">
                        <item.icon className={cn('h-4 w-4 shrink-0', item.color)} />
                        <span className="truncate whitespace-nowrap text-sm font-bold">{item.label}</span>
                      </div>
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 rotate-[-90deg] opacity-40" />
                    </Link>
                  ))}
                </>
              ) : null}

              {/* Auto MXH platform links */}
              {!isAdmin && isAutoMxhArea ? (
                <>
                  <div className="px-3 pb-2 pt-6 text-[9px] font-black uppercase tracking-[0.32em] text-slate-400/70 dark:text-white/25">
                    Dịch Vụ Auto MXH
                  </div>
                  {autoMxhPlatformLinks.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      className={getNavLinkClass(false, 'justify-between')}
                    >
                      <div className="flex min-w-0 items-center space-x-3">
                        <item.icon className={cn('h-4 w-4 shrink-0', item.color)} />
                        <span className="truncate whitespace-nowrap text-sm font-bold">{item.label}</span>
                      </div>
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 rotate-[-90deg] opacity-40" />
                    </Link>
                  ))}
                </>
              ) : null}

              {/* Utility links */}
              {!isAdmin && (isSmmArea || isAutoMxhArea) ? (
                <>
                  <div className="px-3 pb-2 pt-6 text-[9px] font-black uppercase tracking-[0.32em] text-slate-400/70 dark:text-white/25">
                    Tiện Ích
                  </div>
                  {utilityLinks.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      className={getNavLinkClass(false, 'space-x-3')}
                    >
                      <item.icon className="h-4 w-4 shrink-0 text-slate-400 dark:text-white/30" />
                      <span className="truncate whitespace-nowrap text-sm font-bold">{item.label}</span>
                    </Link>
                  ))}
                </>
              ) : null}

              {/* Featured services */}
              {!isAdmin && isHome && resolvedSidebarServices.length > 0 ? (
                <>
                  <div className="px-3 pb-2 pt-6 text-[9px] font-black uppercase tracking-[0.32em] text-slate-400/70 dark:text-white/25">
                    Dịch Vụ Nổi Bật
                  </div>

                  {resolvedSidebarServices.map((item) => {
                    const Icon = serviceIconMap[item.iconKey as keyof typeof serviceIconMap] || Package;
                    const isExternal = item.external || /^https?:\/\//i.test(item.href);
                    const isDisabled = item.maintenance || item.href === '#';
                    const active = !isExternal && !isDisabled && isPathActive(pathname, item.href);

                    const className = cn(
                      'nav-link-shell interactive-lift group flex items-center space-x-3 rounded-[1rem] px-3 py-2.5 transition-all text-sm font-bold',
                      isDisabled
                        ? 'cursor-not-allowed opacity-40 text-slate-400 dark:text-white/25'
                        : '',
                      active
                        ? 'nav-link-active'
                        : 'nav-link-idle'
                    );

                    const content = (
                      <>
                        <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-brand-blue' : item.textColor)} />
                        <span className="truncate whitespace-nowrap">{item.title}</span>
                      </>
                    );

                    if (isDisabled) {
                      return (
                        <div key={item.key} className={className}>
                          {content}
                        </div>
                      );
                    }

                    if (isExternal) {
                      return (
                        <a
                          key={item.key}
                          href={item.href}
                          target="_blank"
                          rel="noreferrer"
                          className={className}
                        >
                          {content}
                        </a>
                      );
                    }

                    return (
                      <Link key={item.key} href={item.href} className={className}>
                        {content}
                      </Link>
                    );
                  })}
                </>
              ) : null}
            </nav>

            {/* Sidebar footer — logout/login */}
            <div className="relative z-10 mt-3 space-y-3 px-2 pb-2">
              {currentUser.data ? (
                <div className="surface-panel rounded-[1.45rem] p-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-11 w-11 rounded-2xl border border-slate-200 dark:border-white/10">
                      <AvatarImage src={currentUser.data.avatar} />
                      <AvatarFallback className="rounded-2xl bg-gradient-to-br from-brand-blue to-indigo-500 text-[11px] font-black text-white">
                        {currentUser.data.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black uppercase tracking-[-0.03em] text-slate-900 dark:text-white">
                        {currentUser.data.username}
                      </div>
                      <div className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                        {currentUser.data.rank || 'Member'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 rounded-[1rem] border border-slate-200/80 bg-slate-50/80 px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Số dư khả dụng</div>
                    <div className="mt-1 font-mono text-lg font-black text-brand-blue">
                      {formatCurrency(currentUser.data.balance)} đ
                    </div>
                  </div>
                </div>
              ) : null}

              {currentUser.data ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="btn-kinetic flex items-center justify-center gap-2.5 rounded-[1.15rem] bg-[linear-gradient(135deg,rgba(239,68,68,0.14),rgba(190,24,93,0.14))] px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-red-500 transition-all hover:-translate-y-0.5 hover:bg-red-500 hover:text-white dark:bg-red-500/[0.08] dark:text-red-400 dark:hover:bg-red-500 dark:hover:text-white"
                >
                  <LogOut className="h-4 w-4" />
                  {loggingOut ? 'Đang thoát...' : 'Đăng Xuất'}
                </button>
              ) : (
                <Link
                  href="/auth/login"
                  className="btn-kinetic flex items-center justify-center gap-2.5 rounded-[1rem] bg-[linear-gradient(135deg,#2563eb_0%,#1d4ed8_48%,#0ea5e9_100%)] px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white transition-all hover:-translate-y-0.5"
                >
                  Đăng Nhập
                </Link>
              )}
            </div>
          </div>
        </aside>

        {/* ─── MAIN CONTENT AREA ─── */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:pl-1">

          {/* Top header */}
          <header className="shell-topbar sticky top-0 z-40 mx-3 mt-3 flex shrink-0 items-center justify-between gap-3 px-4 py-3 md:mx-5 md:px-5">

            {/* Left: menu + search */}
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen((open) => !open)}
                className="surface-chip group flex h-9 w-9 items-center justify-center rounded-xl transition-all hover:-translate-y-0.5 lg:hidden"
              >
                <Menu className="h-4 w-4 text-slate-600 dark:text-white/70" />
              </button>

              <div className="hidden max-w-3xl flex-1 items-center gap-3 lg:flex">
                <div className="shell-toolbar-cluster hidden items-center gap-2 rounded-[1.1rem] px-3 py-2 xl:flex">
                  <span className="text-[9px] font-black uppercase tracking-[0.34em] text-slate-400 dark:text-white/35">workspace</span>
                </div>
                {/* Forum search */}
                <form className="group relative hidden flex-1 lg:block" onSubmit={(event) => submitSearch(event, 'forum')}>
                  <MessageSquare className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-brand-blue" />
                  <input
                    type="text"
                    value={forumSearch}
                    onChange={(event) => setForumSearch(event.target.value)}
                    placeholder="Tìm MMO, Forum..."
                    className="h-11 w-full rounded-[1.05rem] border border-slate-200/80 bg-white/80 pl-10 pr-10 text-xs font-bold text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-brand-blue/30 focus:bg-white dark:border-white/8 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/30 dark:focus:bg-white/[0.07]"
                  />
                  <button
                    type="submit"
                    aria-label="Tìm trong forum"
                    className="absolute inset-y-1.5 right-1.5 flex w-8 items-center justify-center rounded-[0.8rem] bg-slate-100 text-slate-500 transition-all hover:bg-brand-blue hover:text-white dark:bg-white/[0.04] dark:text-white/50"
                  >
                    <Search className="h-3 w-3" />
                  </button>
                </form>

                {/* Service search */}
                <form className="group relative flex-1" onSubmit={(event) => submitSearch(event, 'service')}>
                  <div className="flex h-11 items-center rounded-[1.05rem] border border-slate-200/80 bg-white/80 px-3.5 transition-all group-focus-within:border-brand-blue/30 group-focus-within:bg-white dark:border-white/8 dark:bg-white/[0.04] dark:group-focus-within:bg-white/[0.07]">
                    <Search className="h-3.5 w-3.5 text-slate-400 transition-colors group-focus-within:text-brand-blue dark:text-white/40" />
                    <input
                      type="text"
                      value={serviceSearch}
                      onChange={(event) => setServiceSearch(event.target.value)}
                      placeholder="Tìm kiếm dịch vụ ... (#6K)"
                      className="ml-3 w-full bg-transparent text-xs font-bold text-slate-800 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-white/30"
                    />
                  </div>
                </form>
              </div>
            </div>

            {/* Right: wallet, tools, avatar */}
            <div className="shell-toolbar-cluster flex shrink-0 items-center gap-2 p-1.5 sm:gap-3">

              {/* Wallet balance */}
              <Link
                href="/user/deposit"
                className="interactive-lift relative hidden min-w-[162px] items-center gap-2.5 rounded-[1rem] border border-slate-200/80 bg-white/80 px-3 py-2.5 sm:flex dark:border-white/8 dark:bg-white/[0.04]"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-blue text-white shadow-md shadow-brand-blue/25">
                  <Wallet className="h-3.5 w-3.5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] font-bold uppercase leading-none tracking-[0.16em] text-slate-400 dark:text-white/35">
                    Số dư
                  </span>
                  <span className="mt-0.5 text-sm font-black text-slate-900 dark:text-white">
                    {formatCurrency(currentUser.data?.balance || 0)}
                    <span className="ml-0.5 text-xs font-bold text-slate-400 dark:text-white/35">đ</span>
                  </span>
                </div>
                <div className="ml-auto flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors hover:bg-brand-blue hover:text-white dark:bg-white/8 dark:text-white/50">
                  <Plus className="h-3 w-3" />
                </div>
              </Link>

              {/* Language */}
              <button
                type="button"
                onClick={() => toast.info('Hệ thống hiện đang sử dụng tiếng Việt.')}
                className="group flex h-9 items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/80 px-2.5 transition-all hover:-translate-y-0.5 dark:border-white/8 dark:bg-white/[0.04]"
              >
                <Globe className="h-3.5 w-3.5 text-slate-400 group-hover:text-brand-blue dark:text-white/45" />
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-600 dark:text-white/75">VI</span>
              </button>

              {/* Cart */}
              <Link
                href="/user/cart"
                className="group flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white/80 transition-all hover:-translate-y-0.5 dark:border-white/8 dark:bg-white/[0.04]"
              >
                <ShoppingCart className="h-4 w-4 text-slate-400 group-hover:text-brand-blue dark:text-white/45" />
              </Link>

              {/* Theme toggle */}
              <button
                type="button"
                onClick={handleThemeToggle}
                className="theme-switch-shell group border border-slate-200/80 bg-white/80 transition-all hover:-translate-y-0.5 dark:border-white/8 dark:bg-white/[0.04]"
                data-mode={mounted && isDark ? 'dark' : 'light'}
                aria-label="Toggle theme"
              >
                <Sun className="theme-switch-icon theme-switch-icon-sun h-3.5 w-3.5 text-amber-500" />
                <Moon className="theme-switch-icon theme-switch-icon-moon h-3.5 w-3.5 text-slate-500 dark:text-slate-300" />
                <span className={cn('theme-switch-thumb', mounted && isDark ? 'translate-x-[2.5rem]' : 'translate-x-0')}>
                  {mounted && isDark ? <Moon className="theme-switch-thumb-icon h-3.5 w-3.5 text-white" /> : <Sun className="theme-switch-thumb-icon h-3.5 w-3.5 text-white" />}
                </span>
              </button>

              {/* AI button */}
              <a
                href="https://ai.trungtammmo.vn/"
                target="_blank"
                rel="noreferrer"
                className="btn-kinetic flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-white shadow-md shadow-cyan-500/25 transition-all hover:-translate-y-0.5 hover:shadow-cyan-500/40"
              >
                <Bot className="h-4 w-4" />
              </a>

              {/* User avatar / dropdown */}
              {currentUser.data ? (
                <div className="relative">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="relative flex items-center rounded-xl border border-slate-200/80 bg-white/80 p-1 transition-all hover:-translate-y-0.5 dark:border-white/8 dark:bg-white/[0.04]">
                        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-brand-blue to-indigo-500 shadow-md shadow-brand-blue/25">
                          <Avatar className="h-8 w-8 rounded-xl">
                            <AvatarImage src={currentUser.data.avatar} />
                            <AvatarFallback className="rounded-xl bg-transparent text-[11px] font-black text-white">
                              {currentUser.data.username.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="mt-2 w-60 rounded-2xl border-slate-200/80 p-3 shadow-xl dark:border-white/[0.08]">
                      <div className="mb-2 border-b border-slate-100 px-2 pb-3 dark:border-white/[0.06]">
                        <div className="mb-0.5 text-[8px] font-black uppercase tracking-widest text-slate-400">
                          Signed in as
                        </div>
                        <div className="truncate text-sm font-black text-brand-blue">
                          {currentUser.data.username}
                        </div>
                        <div className="mt-1 text-[10px] font-bold text-slate-500">
                          Số dư:{' '}
                          <span className="font-black text-brand-blue">
                            {formatCurrency(currentUser.data.balance)}đ
                          </span>
                        </div>
                      </div>

                      <DropdownMenuItem asChild>
                        <Link href="/user/profile" className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-slate-600 dark:text-slate-400">
                          <UserCircle2 className="h-4 w-4" />
                          <span className="text-xs font-black uppercase">Hồ sơ</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/user/statistics" className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-slate-600 dark:text-slate-400">
                          <BarChart3 className="h-4 w-4" />
                          <span className="text-xs font-black uppercase">Thống kê</span>
                        </Link>
                      </DropdownMenuItem>
                      {currentUser.data.role === 'admin' ? (
                        <DropdownMenuItem asChild>
                          <Link href="/admin/dashboard" className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-slate-600 dark:text-slate-400">
                            <Shield className="h-4 w-4" />
                            <span className="text-xs font-black uppercase">Admin Panel</span>
                          </Link>
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuSeparator className="my-1" />
                      <DropdownMenuItem asChild>
                        <button
                          type="button"
                          onClick={handleLogout}
                          disabled={loggingOut}
                          className="flex w-full items-center gap-3 rounded-xl bg-red-50 px-2 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-red-500 transition-all hover:bg-red-500 hover:text-white dark:bg-red-500/[0.08] dark:text-red-400"
                        >
                          <LogOut className="h-4 w-4" />
                          <span>{loggingOut ? 'Đang thoát...' : 'Đăng xuất'}</span>
                        </button>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : (
                <Link
                  href="/auth/login"
                  className="inline-flex items-center rounded-xl bg-brand-blue px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-white transition hover:bg-blue-700"
                >
                  Đăng nhập
                </Link>
              )}
            </div>
          </header>

          {/* Breadcrumb bar */}
          <div className="shell-breadcrumb mx-3 mt-3 shrink-0 px-5 py-3 md:mx-5 md:px-6">
            <nav className="relative z-10 flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.34em] text-slate-400 dark:text-white/35">
              <Link href={isAdmin ? '/admin/dashboard' : '/user/home'} className="transition-colors hover:text-brand-blue">
                Trang Chủ
              </Link>
              {breadcrumbs
                .filter((crumb) => !['User', 'Admin', 'Trang Chủ'].includes(crumb))
                .map((crumb, index) => (
                  <div key={`${crumb}-${index}`} className="flex items-center gap-2">
                    <ChevronDown className="h-3 w-3 rotate-[-90deg] opacity-30" />
                    <span className="text-slate-600 dark:text-white/75">{crumb}</span>
                  </div>
                ))}
            </nav>
          </div>

          {/* Page content */}
          <main className="page-stack relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto custom-scrollbar">
            <div className="w-full px-3 py-6 md:px-5 md:py-8 xl:px-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
