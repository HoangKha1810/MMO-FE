'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import {
  Award,
  BarChart3,
  BookOpen,
  Bot,
  Briefcase,
  ChevronDown,
  Cloud,
  Code2,
  Cpu,
  CreditCard,
  CircleCheck,
  FileText,
  Gamepad2,
  Globe,
  Globe2,
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
  Siren,
  ShoppingCart,
  Shuffle,
  Sun,
  ThumbsUp,
  UserCircle2,
  Wallet,
  Video,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { cn, slugify } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { BrandForestWordmark } from '@/components/ui/brand-forest-wordmark';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { startPageTransition } from '@/components/layout/navigation-effects';
import { NotificationBell } from '@/components/layout/notification-bell';
import { clearSessionUserCache, useSessionUser, type SessionUser } from '@/hooks/use-session-user';
import { BLUE_TICK_BADGE_SRC } from '@/lib/blue-tick-constants';
import { readJsonResponse } from '@/lib/client-api';
import type { LegacyServiceItem } from '@/lib/legacy-settings';
import { startThemeSwitchAnimation } from '@/lib/theme-switch-animation';
import { useWalletBalance } from '@/components/layout/wallet-balance-context';

const mainLinks = [
  { href: '/user/home', label: 'Trang Chủ', icon: Grid3x3 },
  { href: '/user/chatbot', label: 'Trợ Lý AI', icon: Bot },
  { href: '/user/deposit', label: 'Nạp Tiền Hệ Thống', icon: Wallet },
  { href: '/user/statistics', label: 'Thông Tin Tài Khoản', icon: BarChart3 },
  { href: '/user/history', label: 'Lịch sử giao dịch All', icon: Layers3 },
  { href: '/user/orders', label: 'Đơn Hàng', icon: ShoppingCart },
  { href: '/user/proxy', label: 'Proxy Cloud', icon: Cloud },
  { href: '/user/forum', label: 'Forum MMO', icon: MessageSquare },
  { href: '/user/social/inbox', label: 'Tin Nhắn', icon: MessageCircle },
  { href: '/user/find-job', label: 'Find Job MMO', icon: Briefcase },
  { href: '/user/seller/dashboard', label: 'Kênh người đăng', icon: Package },
];

const supportLinks = [
  { href: '/', label: 'Giới Thiệu' },
  { href: '/terms', label: 'Chính Sách Dịch Vụ' },
  { href: '/privacy', label: 'Chính Sách Hệ Thống' },
];

const connectionLinks = [
  { href: '/rank', label: 'Cấp Bậc Thành Viên' },
  { href: '/user/blue-tick', label: 'Tick Xanh' },
  { href: '/api', label: 'Tài Liệu API' },
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
  'code-2': Code2,
  headset: Headset,
  cloud: Cloud,
  cpu: Cpu,
  'shopping-cart': ShoppingCart,
  monitor: Monitor,
  server: Server,
  'shield-check': ShieldCheck,
  wrench: Wrench,
  'graduation-cap': GraduationCap,
  video: Video,
  facebook: Globe,
  'globe-2': Globe2,
  'message-circle': MessageCircle,
  music: Music,
  send: Send,
  shuffle: Shuffle,
} as const;

const smmPlatformLinks: Array<{ href: string; label: string; icon: typeof Globe; color: string; gif?: string }> = [
  { href: '/user/smm?platform=Facebook', label: 'Facebook', icon: Globe, color: 'text-blue-500', gif: 'facebook_gif.gif' },
  { href: '/user/smm?platform=TikTok', label: 'TikTok', icon: Music, color: 'text-slate-500 dark:text-slate-300', gif: 'tiktok_gif.gif' },
  { href: '/user/smm?platform=Instagram', label: 'Instagram', icon: MessageCircle, color: 'text-pink-500', gif: 'ig_gif.gif' },
  { href: '/user/smm?platform=YouTube', label: 'YouTube', icon: Video, color: 'text-red-500', gif: 'youtube_gif.gif' },
  { href: '/user/smm?platform=Telegram', label: 'Telegram', icon: Send, color: 'text-sky-500' },
  { href: '/user/smm?platform=Shopee', label: 'Shopee', icon: ShoppingCart, color: 'text-orange-500' },
  { href: '/user/smm?platform=Threads', label: 'Threads', icon: MessageCircle, color: 'text-slate-500' },
];

export type SidebarSmmServiceLike = {
  id?: number;
  service?: number;
  name?: string;
  category?: string;
  platform?: string;
  price_per_1k_vnd?: number;
};

export type SidebarSmmCategory = {
  category: string;
  cleanName: string;
  count: number;
  minPrice: number;
};

export type SidebarSmmSection = {
  platform: string;
  total: number;
  categories: SidebarSmmCategory[];
};

const smmPlatformTags: Record<string, string[]> = {
  Facebook: ['facebook', '[fb]', ' fb ', 'fb '],
  TikTok: ['tiktok', 'tik tok', '[tt]'],
  Instagram: ['instagram', '[ig]'],
  YouTube: ['youtube', '[yt]'],
  Telegram: ['telegram', '[tg]'],
  Shopee: ['shopee', '[sp]'],
  Threads: ['threads', '[threads]'],
};

const autoMxhPlatformLinks: Array<{ href: string; label: string; icon: typeof Globe; color: string; gif?: string }> = [
  { href: '/user/automxh?platform=facebook', label: 'Facebook', icon: Globe, color: 'text-blue-500', gif: 'facebook_gif.gif' },
  { href: '/user/automxh?platform=instagram', label: 'INSTAGRAM', icon: MessageCircle, color: 'text-pink-500', gif: 'ig_gif.gif' },
  { href: '/user/automxh?platform=tiktok', label: 'TikTok', icon: Music, color: 'text-slate-500 dark:text-slate-300', gif: 'tiktok_gif.gif' },
  { href: '/user/automxh?platform=x-twitter', label: 'X TWITTER', icon: MessageCircle, color: 'text-slate-500 dark:text-slate-300', gif: 'tw_gif.gif' },
  { href: '/user/automxh?platform=youtube', label: 'YOUTUBE', icon: Video, color: 'text-red-500', gif: 'youtube_gif.gif' },
];

const utilityLinks = [
  { href: '/two_factor_live', label: '2FA Live Tool', icon: Shield },
  { href: '/get_uid_fb', label: 'GET UID FB', icon: Globe },
];

const quickActionLinks = [
  { href: '/rank', label: 'Bảo mật', icon: ShieldCheck },
  { href: '/two_factor_live', label: '2FA', icon: Shield },
  { href: '/api', label: 'API', icon: Cpu },
];

interface AppShellProps {
  children: React.ReactNode;
  user?: SessionUser;
  isAdmin?: boolean;
  sidebarServices?: LegacyServiceItem[];
  smmSidebarSections?: SidebarSmmSection[];
  smmSidebarLoading?: boolean;
  fullHeight?: boolean;
}

const SIDEBAR_SERVICES_CACHE_TTL_MS = 5 * 60 * 1000;
const SMM_SIDEBAR_CACHE_TTL_MS = 2 * 60 * 1000;
const SIDEBAR_SERVICES_CACHE_KEY = 'app_shell_sidebar_services_v2';
const SMM_SIDEBAR_CACHE_KEY = 'app_shell_smm_sidebar_v1';

let sidebarServicesCache:
  | {
      expiresAt: number;
      data: LegacyServiceItem[];
    }
  | null = null;

let smmSidebarSectionsCache:
  | {
      expiresAt: number;
      data: SidebarSmmSection[];
    }
  | null = null;

function readSessionCache<T>(key: string) {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { expiresAt?: number; data?: T };
    if (!parsed?.expiresAt || parsed.expiresAt <= Date.now() || parsed.data === undefined) {
      window.sessionStorage.removeItem(key);
      return null;
    }

    return parsed.data;
  } catch {
    return null;
  }
}

function writeSessionCache<T>(key: string, ttlMs: number, data: T) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(
      key,
      JSON.stringify({
        expiresAt: Date.now() + ttlMs,
        data,
      })
    );
  } catch {}
}

function getCachedSidebarServices() {
  if (sidebarServicesCache && sidebarServicesCache.expiresAt > Date.now()) {
    return sidebarServicesCache.data;
  }

  const cached = readSessionCache<LegacyServiceItem[]>(SIDEBAR_SERVICES_CACHE_KEY);
  if (cached?.length) {
    setCachedSidebarServices(cached);
    return cached;
  }

  return null;
}

function setCachedSidebarServices(data: LegacyServiceItem[]) {
  sidebarServicesCache = {
    expiresAt: Date.now() + SIDEBAR_SERVICES_CACHE_TTL_MS,
    data,
  };
  writeSessionCache(SIDEBAR_SERVICES_CACHE_KEY, SIDEBAR_SERVICES_CACHE_TTL_MS, data);
}

function getCachedSmmSidebarSections() {
  if (smmSidebarSectionsCache && smmSidebarSectionsCache.expiresAt > Date.now()) {
    return smmSidebarSectionsCache.data;
  }

  const cached = readSessionCache<SidebarSmmSection[]>(SMM_SIDEBAR_CACHE_KEY);
  if (cached?.length) {
    setCachedSmmSidebarSections(cached);
    return cached;
  }

  return null;
}

function setCachedSmmSidebarSections(data: SidebarSmmSection[]) {
  smmSidebarSectionsCache = {
    expiresAt: Date.now() + SMM_SIDEBAR_CACHE_TTL_MS,
    data,
  };
  writeSessionCache(SMM_SIDEBAR_CACHE_KEY, SMM_SIDEBAR_CACHE_TTL_MS, data);
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.floor(amount || 0));
}

function BlueTickBadge({ className }: { className?: string }) {
  return (
    <img
      src={BLUE_TICK_BADGE_SRC}
      alt="Tick xanh"
      className={cn('pointer-events-none select-none object-contain drop-shadow-[0_8px_16px_rgba(56,189,248,0.42)]', className)}
      draggable={false}
    />
  );
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
    proxy: 'Proxy Cloud',
    'vps-gpu': 'VPS GPU AI',
    card: 'Đổi Thẻ',
    deposit: 'Nạp Tiền',
    'support-tiktok': 'Support TikTok',
    'kenh-tiktok': 'Kênh TikTok',
    'meta-support': 'Auto kích nút Meta',
    forum: 'Forum MMO',
    'game-market': 'Trao Đổi Game',
    'game-accounts': 'Thuê tài khoản game 99 năm',
    'random-game-accounts': 'Random thuê tài khoản game 99 năm',
    'vibe-code': 'Vibe Code',
    'web-service': 'Web con MMO và Build Website',
    press: 'Lên báo',
    'find-job': 'Find Job MMO',
    history: 'Lịch Sử',
    statistics: 'Thông Tin Tài Khoản',
    profile: 'Hồ Sơ',
    'blue-tick': 'Tick Xanh',
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
    'nav-link-shell interactive-lift group flex items-center rounded-[0.85rem] px-3 py-2.5 text-sm font-bold transition-all duration-200',
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

function cleanSmmCategoryName(category: string) {
  return category.replace(/\[.*?\]\s*/g, '').replace(/\s+/g, ' ').trim() || category;
}

function isSidebarServiceInPlatform(service: SidebarSmmServiceLike, platform: string) {
  const haystack = ` ${service.platform || ''} ${service.category || ''} ${service.name || ''} `.toLowerCase();
  const tags = smmPlatformTags[platform] || [platform.toLowerCase()];
  return tags.some((tag) => haystack.includes(tag.toLowerCase()));
}

export function buildSidebarSmmSections(services: SidebarSmmServiceLike[]): SidebarSmmSection[] {
  return smmPlatformLinks.map((platform) => {
    const platformServices = services.filter((service) => isSidebarServiceInPlatform(service, platform.label));
    const categories = new Map<string, { count: number; minPrice: number }>();

    for (const service of platformServices) {
      const category = String(service.category || service.name || '').trim();
      if (!category) continue;

      const current = categories.get(category) || { count: 0, minPrice: Number.POSITIVE_INFINITY };
      current.count += 1;
      const price = Number(service.price_per_1k_vnd || 0);
      if (price > 0) {
        current.minPrice = Math.min(current.minPrice, price);
      }
      categories.set(category, current);
    }

    return {
      platform: platform.label,
      total: platformServices.length,
      categories: Array.from(categories.entries())
        .map(([category, meta]) => ({
          category,
          cleanName: cleanSmmCategoryName(category),
          count: meta.count,
          minPrice: Number.isFinite(meta.minPrice) ? meta.minPrice : 0,
        }))
        .sort((a, b) => b.count - a.count || a.cleanName.localeCompare(b.cleanName, 'vi'))
        .slice(0, 12),
    };
  });
}

export function AppShell({
  children,
  user,
  isAdmin = false,
  sidebarServices,
  smmSidebarSections: prefetchedSmmSidebarSections,
  smmSidebarLoading: prefetchedSmmSidebarLoading,
  fullHeight = false,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { balance: liveBalance, gameBalance: liveGameBalance, pulse, pulseScope, soundTick } = useWalletBalance();
  const currentUser = useSessionUser(user);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [forumSearch, setForumSearch] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  const [resolvedSidebarServices, setResolvedSidebarServices] = useState<LegacyServiceItem[]>(sidebarServices || []);
  const [smmSidebarSections, setSmmSidebarSections] = useState<SidebarSmmSection[]>(prefetchedSmmSidebarSections || []);
  const [smmSidebarLoadingState, setSmmSidebarLoadingState] = useState(false);
  const [openSmmPlatform, setOpenSmmPlatform] = useState('');
  const [loggingOut, setLoggingOut] = useState(false);
  const [supportOpen, setSupportOpen] = useState(
    pathname === '/terms' || pathname === '/privacy' || pathname === '/'
  );
  const [connectionOpen, setConnectionOpen] = useState(
    pathname === '/user/statistics' || pathname === '/user/smm' || pathname === '/user/blue-tick'
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!soundTick || typeof window === 'undefined') return;
    try {
      const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return;
      const ctx = new AudioCtor();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.value = pulse === 'up' ? 920 : 540;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.03, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.13);
      void ctx.close().catch(() => undefined);
    } catch {
      // ignore audio limitations
    }
  }, [pulse, soundTick]);

  useEffect(() => {
    if (sidebarServices?.length) {
      setResolvedSidebarServices(sidebarServices);
      setCachedSidebarServices(sidebarServices);
      return;
    }

    if (isAdmin) {
      setResolvedSidebarServices([]);
      return;
    }

    const cachedServices = getCachedSidebarServices();
    if (cachedServices?.length) {
      setResolvedSidebarServices(cachedServices);
      return;
    }

    let active = true;

    async function loadSidebarServices() {
      try {
        const response = await fetch('/api/ui/services');
        if (!response.ok) {
          return;
        }

        const payload = await readJsonResponse(response, 'Không tải được danh mục sidebar');
        if (active && Array.isArray(payload.sidebar)) {
          setResolvedSidebarServices(payload.sidebar);
          setCachedSidebarServices(payload.sidebar);
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

  const isDark = mounted ? resolvedTheme === 'dark' : true;
  const isHome = pathname === '/user/home';
  const isSmmArea = pathname.startsWith('/user/smm');
  const isAutoMxhArea = pathname.startsWith('/user/automxh');
  const forceDarkShell = false;
  const effectiveIsDark = forceDarkShell || isDark;
  const activeSmmPlatform = mounted && typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('platform') || ''
    : '';
  const breadcrumbs = useMemo(() => formatBreadcrumb(pathname), [pathname]);
  const smmSidebarLoading = prefetchedSmmSidebarLoading ?? smmSidebarLoadingState;

  useEffect(() => {
    if (prefetchedSmmSidebarSections !== undefined) {
      setSmmSidebarSections(prefetchedSmmSidebarSections);
      if (prefetchedSmmSidebarSections.length > 0) {
        setCachedSmmSidebarSections(prefetchedSmmSidebarSections);
      }
    }
  }, [prefetchedSmmSidebarSections]);

  useEffect(() => {
    if (pathname.startsWith('/terms') || pathname.startsWith('/privacy') || pathname === '/') {
      setSupportOpen(true);
    }

    if (pathname.startsWith('/user/statistics') || pathname.startsWith('/user/smm')) {
      setConnectionOpen(true);
    }
  }, [pathname]);

  useEffect(() => {
    if (
      prefetchedSmmSidebarSections !== undefined ||
      !isSmmArea ||
      isAdmin ||
      smmSidebarSections.length > 0 ||
      smmSidebarLoadingState
    ) {
      return;
    }

    const cachedSections = getCachedSmmSidebarSections();
    if (cachedSections?.length) {
      setSmmSidebarSections(cachedSections);
      return;
    }

    let active = true;
    setSmmSidebarLoadingState(true);

    async function loadSmmSidebarServices() {
      try {
        const response = await fetch('/api/smm/services');
        const payload = await readJsonResponse(response, 'Không tải được danh mục SMM');
        const services = Array.isArray(payload.data) ? payload.data as SidebarSmmServiceLike[] : [];
        if (active) {
          const nextSections = buildSidebarSmmSections(services);
          setSmmSidebarSections(nextSections);
          setCachedSmmSidebarSections(nextSections);
        }
      } catch {
        if (active) {
          setSmmSidebarSections([]);
        }
      } finally {
        if (active) {
          setSmmSidebarLoadingState(false);
        }
      }
    }

    void loadSmmSidebarServices();

    return () => {
      active = false;
    };
  }, [isAdmin, isSmmArea, prefetchedSmmSidebarSections, smmSidebarLoadingState, smmSidebarSections.length]);

  useEffect(() => {
    if (!isSmmArea || !activeSmmPlatform) {
      return;
    }

    const matchedPlatform = smmPlatformLinks.find(
      (item) => item.label.toLowerCase() === activeSmmPlatform.toLowerCase()
    );
    if (matchedPlatform) {
      setOpenSmmPlatform(matchedPlatform.label);
    }
  }, [activeSmmPlatform, isSmmArea]);

  useEffect(() => {
    if (!forceDarkShell || typeof document === 'undefined') {
      return;
    }

    const root = document.documentElement;
    const hadDark = root.classList.contains('dark');
    const hadLight = root.classList.contains('light');

    root.classList.add('dark');
    root.classList.remove('light');

    return () => {
      root.classList.toggle('dark', hadDark);
      root.classList.toggle('light', hadLight);
    };
  }, [forceDarkShell]);

  function handleThemeToggle(event: React.MouseEvent<HTMLButtonElement>) {
    if (!mounted) {
      return;
    }

    if (forceDarkShell) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      return;
    }

    const nextTheme = isDark ? 'light' : 'dark';
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
    document.documentElement.classList.toggle('light', nextTheme === 'light');
    startThemeSwitchAnimation({
      currentTheme: isDark ? 'dark' : 'light',
      nextTheme,
      setTheme,
      source: event.currentTarget,
    });
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
      clearSessionUserCache();
      startPageTransition();
      router.push('/auth/login');
      router.refresh();
      setSidebarOpen(false);
      setLoggingOut(false);
    }
  }

  function handleBrandHomeClick(event: MouseEvent<HTMLAnchorElement>) {
    const homeHref = isAdmin ? '/admin/dashboard' : '/user/home';
    setSidebarOpen(false);
    startPageTransition();
    if (pathname !== homeHref) {
      event.preventDefault();
      router.push(homeHref);
    }
  }

  return (
    <div className={cn('site-shell h-dvh overflow-hidden', !isAdmin && 'mmo-app-shell', forceDarkShell && 'dark mmo-force-dark')}>
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
          'shell-sidebar-frame fixed inset-y-0 left-0 z-50 h-dvh overflow-hidden transition-[width,transform,box-shadow] duration-300 lg:sticky lg:top-0 lg:w-[296px] lg:shrink-0 lg:translate-x-0',
            sidebarOpen
              ? 'w-[min(88vw,296px)] translate-x-0 shadow-2xl shadow-black/20 sm:w-[296px]'
              : 'w-0 -translate-x-full lg:w-[296px]'
          )}
        >
          <div className="relative flex h-full flex-col overflow-hidden px-3 py-3">

            {/* Sidebar header */}
            <div className="relative z-10">
              <div className="shell-brand-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={isAdmin ? '/admin/dashboard' : '/user/home'}
                    onClick={handleBrandHomeClick}
                    className="min-w-0 flex-1"
                  >
                    <img
                      src="/logo.gif"
                      alt="TRUNGTAMMMO.VN Logo"
                      className="h-14 w-auto object-contain"
                    />
                    <div className="mt-2">
                      <BrandForestWordmark className="text-[0.74rem] text-slate-900 dark:text-white" />
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
            <nav id="sidebar-nav" className="relative z-10 mt-3 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2 custom-scrollbar">
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
                  <div className="space-y-1">
                    {smmPlatformLinks.map((item) => {
                      const section = smmSidebarSections.find((entry) => entry.platform === item.label);
                      const isPlatformOpen = openSmmPlatform === item.label;
                      const active = activeSmmPlatform.toLowerCase() === item.label.toLowerCase();

                      return (
                        <div key={item.label}>
                          <button
                            type="button"
                            onClick={() => setOpenSmmPlatform((current) => current === item.label ? '' : item.label)}
                            className={getNavLinkClass(active, 'w-full justify-between')}
                          >
                            <div className="flex min-w-0 items-center space-x-3">
                              {item.gif ? (
                                <img
                                  src={`/assets/images/gif/${item.gif}`}
                                  alt=""
                                  className="h-4 w-4 shrink-0 rounded-full object-cover"
                                />
                              ) : (
                                <item.icon className={cn('h-4 w-4 shrink-0', item.color)} />
                              )}
                              <span className="truncate whitespace-nowrap text-sm font-bold">{item.label}</span>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {section?.total ? (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black text-slate-400 dark:bg-white/5">
                                  {section.total}
                                </span>
                              ) : null}
                              <ChevronDown
                                className={cn(
                                  'h-3.5 w-3.5 text-slate-400 transition-transform duration-200',
                                  isPlatformOpen ? 'rotate-180' : '-rotate-90'
                                )}
                              />
                            </div>
                          </button>

                          {isPlatformOpen ? (
                            <div className="ml-5 mt-1 space-y-1 border-l border-slate-200 pb-2 pl-3 dark:border-white/[0.06]">
                              <Link
                                href={item.href}
                                className={cn(
                                  'flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-xs font-black transition-all',
                                  active
                                    ? 'bg-brand-blue text-white shadow-sm shadow-brand-blue/20'
                                    : 'bg-slate-100/80 text-slate-600 hover:bg-brand-blue/10 hover:text-brand-blue dark:bg-white/[0.04] dark:text-slate-200'
                                )}
                              >
                                <span className="truncate">Tất cả {item.label}</span>
                                <span className="text-[10px] opacity-70">{section?.categories.length || 0} mục</span>
                              </Link>

                              {smmSidebarLoading && !section ? (
                                <div className="rounded-xl px-3 py-2 text-[11px] font-bold text-slate-400">
                                  Đang tải dịch vụ con...
                                </div>
                              ) : section?.categories.length ? (
                                section.categories.map((category) => (
                                  <Link
                                    key={category.category}
                                    href={`/user/smm/order/${slugify(category.category)}`}
                                    className="group/sub flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 transition-all hover:bg-white hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.05] dark:hover:text-white"
                                  >
                                    <span className="truncate">{category.cleanName}</span>
                                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black text-slate-400 group-hover/sub:bg-brand-blue/10 group-hover/sub:text-brand-blue dark:bg-white/5">
                                      {category.count}
                                    </span>
                                  </Link>
                                ))
                              ) : (
                                <div className="rounded-xl px-3 py-2 text-[11px] font-bold text-slate-400">
                                  Chưa có dịch vụ con đang active
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
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
                        {item.gif ? (
                          <img src={`/assets/images/gif/${item.gif}`} alt="" className="h-4 w-4 shrink-0 rounded-full object-cover" />
                        ) : (
                          <item.icon className={cn('h-4 w-4 shrink-0', item.color)} />
                        )}
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
                    <div className="relative h-11 w-11 shrink-0">
                      <Avatar className="h-11 w-11 rounded-2xl border border-slate-200 dark:border-white/10">
                        <AvatarImage src={currentUser.data.avatar} />
                        <AvatarFallback className="rounded-2xl bg-gradient-to-br from-brand-blue to-indigo-500 text-[11px] font-black text-white">
                          {currentUser.data.username.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {currentUser.data.is_blue_tick ? (
                        <BlueTickBadge className="absolute -right-1 -top-1 h-5 w-5" />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-1.5 text-sm font-black uppercase tracking-[-0.03em] text-slate-900 dark:text-white">
                        <span className="truncate">
                        {currentUser.data.username}
                        </span>
                      </div>
                      <div className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                        {currentUser.data.rank || 'Member'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 rounded-[1rem] border border-slate-200/80 bg-slate-50/80 px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Số dư khả dụng</div>
                    <div className={cn(
                      'mt-1 font-mono tabular-nums whitespace-nowrap text-[clamp(0.95rem,3.8vw,1.125rem)] font-black leading-none text-brand-blue transition-all duration-500',
                      pulseScope === 'balance' && pulse === 'down' && 'scale-[1.04] text-rose-500',
                      pulseScope === 'balance' && pulse === 'up' && 'scale-[1.04] text-emerald-500'
                    )}>
                      {formatCurrency((liveBalance ?? currentUser.data.balance))} đ
                    </div>
                    <div className="mt-2 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Ví game</div>
                    <div className={cn(
                      'mt-1 font-mono tabular-nums whitespace-nowrap text-sm font-black leading-none text-emerald-500 transition-all duration-500',
                      pulseScope === 'gameBalance' && pulse === 'down' && 'scale-[1.04] text-rose-500',
                      pulseScope === 'gameBalance' && pulse === 'up' && 'scale-[1.04] text-emerald-500'
                    )}>
                      {formatCurrency((liveGameBalance ?? currentUser.data.game_balance) || 0)} đ
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
        <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-x-hidden lg:pl-1">

          {/* Top header */}
          <header className="shell-topbar sticky top-0 z-40 mx-2 mt-2 flex shrink-0 items-center justify-between gap-2 px-2.5 py-2.5 sm:mx-3 sm:mt-3 sm:gap-3 sm:px-4 sm:py-3 md:mx-5 md:px-5">

            {/* Left: menu + search */}
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen((open) => !open)}
                className="surface-chip group flex h-9 w-9 items-center justify-center rounded-xl transition-all hover:-translate-y-0.5 lg:hidden"
              >
                <Menu className="h-4 w-4 text-slate-600 dark:text-white/70" />
              </button>

              <Link
                href={isAdmin ? '/admin/dashboard' : '/user/home'}
                onClick={handleBrandHomeClick}
                aria-label="TRUNGTAMMMO.VN"
                className="ml-auto flex min-w-0 items-center justify-end pr-1 lg:hidden"
              >
                <img
                  src="/logo.gif"
                  alt="TRUNGTAMMMO.VN"
                  className="h-9 max-w-[52vw] object-contain drop-shadow-[0_10px_22px_rgba(37,99,235,0.28)]"
                />
              </Link>

              <div className="hidden max-w-3xl flex-1 items-center gap-3 lg:flex">
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
            <div className="shell-toolbar-cluster custom-scrollbar hidden max-w-[calc(100dvw-5.5rem)] min-w-0 shrink-0 items-center gap-1 overflow-x-auto overscroll-x-contain p-1 sm:flex sm:max-w-none sm:gap-3 sm:overflow-visible sm:p-1.5">
              {/* Wallet balance */}
              <Link
                href="/user/deposit"
                className="interactive-lift relative hidden min-w-[162px] items-center gap-2.5 rounded-[1rem] border border-slate-200/80 bg-white/80 px-3 py-2.5 sm:flex lg:min-w-[260px] dark:border-white/8 dark:bg-white/[0.04]"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-blue text-white shadow-md shadow-brand-blue/25">
                  <Wallet className="h-3.5 w-3.5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] font-bold uppercase leading-none tracking-[0.16em] text-slate-400 dark:text-white/35">
                    Số dư
                  </span>
                  <span className={cn(
                    'mt-0.5 whitespace-nowrap font-mono tabular-nums text-[clamp(0.95rem,2.4vw,1rem)] font-black leading-none text-slate-900 transition-all duration-500 dark:text-white',
                    pulseScope === 'balance' && pulse === 'down' && 'scale-[1.06] text-rose-500',
                    pulseScope === 'balance' && pulse === 'up' && 'scale-[1.06] text-emerald-500'
                  )}>
                    {formatCurrency((liveBalance ?? currentUser.data?.balance) || 0)}
                    <span className="ml-0.5 text-xs font-bold text-slate-400 dark:text-white/35">đ</span>
                  </span>
                </div>
                <div className="hidden border-l border-slate-200/80 pl-3 lg:flex lg:flex-col dark:border-white/10">
                  <span className="text-[8px] font-bold uppercase leading-none tracking-[0.16em] text-slate-400 dark:text-white/35">
                    Ví game
                  </span>
                  <span className={cn(
                    'mt-0.5 whitespace-nowrap font-mono tabular-nums text-[0.9rem] font-black leading-none text-emerald-500 transition-all duration-500',
                    pulseScope === 'gameBalance' && pulse === 'down' && 'scale-[1.06] text-rose-500',
                    pulseScope === 'gameBalance' && pulse === 'up' && 'scale-[1.06] text-emerald-500'
                  )}>
                    {formatCurrency((liveGameBalance ?? currentUser.data?.game_balance) || 0)}
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
                className="group flex h-9 items-center gap-1 rounded-xl border border-slate-200/80 bg-white/80 px-2 transition-all hover:-translate-y-0.5 sm:gap-1.5 sm:px-2.5 dark:border-white/8 dark:bg-white/[0.04]"
              >
                <Globe className="h-3.5 w-3.5 text-slate-400 group-hover:text-brand-blue dark:text-white/45" />
                <span className="hidden text-[10px] font-black uppercase tracking-[0.18em] text-slate-600 min-[390px]:inline dark:text-white/75">VI</span>
              </button>

              {/* Notifications */}
              <NotificationBell />

              {/* Theme toggle desktop */}
              <button
                type="button"
                onClick={handleThemeToggle}
                className="theme-switch-shell group border border-slate-200/80 bg-white/80 transition-all hover:-translate-y-0.5 dark:border-white/8 dark:bg-white/[0.04]"
                data-mode={mounted && effectiveIsDark ? 'dark' : 'light'}
                aria-label="Toggle theme"
              >
                <Sun className="theme-switch-icon theme-switch-icon-sun h-3.5 w-3.5 text-amber-500" />
                <Moon className="theme-switch-icon theme-switch-icon-moon h-3.5 w-3.5 text-slate-500 dark:text-slate-300" />
                <span className={cn('theme-switch-thumb', mounted && effectiveIsDark ? 'translate-x-[2.5rem]' : 'translate-x-0')}>
                  {mounted && effectiveIsDark ? <Moon className="theme-switch-thumb-icon h-3.5 w-3.5 text-white" /> : <Sun className="theme-switch-thumb-icon h-3.5 w-3.5 text-white" />}
                </span>
              </button>

              {/* User avatar / dropdown */}
              {currentUser.data ? (
                <div className="relative">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="relative flex items-center rounded-xl border border-slate-200/80 bg-white/80 p-1 transition-all hover:-translate-y-0.5 dark:border-white/8 dark:bg-white/[0.04]">
                        <div className="relative rounded-xl bg-gradient-to-br from-brand-blue to-indigo-500 shadow-md shadow-brand-blue/25">
                          <Avatar className="h-8 w-8 rounded-xl">
                            <AvatarImage src={currentUser.data.avatar} />
                            <AvatarFallback className="rounded-xl bg-transparent text-[11px] font-black text-white">
                              {currentUser.data.username.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          {currentUser.data.is_blue_tick ? (
                            <BlueTickBadge className="absolute -right-1.5 -top-1.5 h-[18px] w-[18px] min-h-4 min-w-4" />
                          ) : null}
                        </div>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="mt-2 w-60 rounded-2xl border-slate-200/80 p-3 shadow-xl dark:border-white/[0.08]">
                      <div className="mb-2 border-b border-slate-100 px-2 pb-3 dark:border-white/[0.06]">
                        <div className="mb-0.5 text-[8px] font-black uppercase tracking-widest text-slate-400">
                          Signed in as
                        </div>
                        <div className="flex min-w-0 items-center gap-1.5 text-sm font-black text-brand-blue">
                          <span className="truncate">{currentUser.data.username}</span>
                          {currentUser.data.is_blue_tick ? (
                            <BlueTickBadge className="h-4 w-4 shrink-0" />
                          ) : null}
                        </div>
                        <div className="mt-1 text-[10px] font-bold text-slate-500">
                          Số dư:{' '}
                          <span className={cn(
                            'whitespace-nowrap font-mono tabular-nums font-black text-brand-blue transition-all duration-500',
                            pulseScope === 'balance' && pulse === 'down' && 'text-rose-500',
                            pulseScope === 'balance' && pulse === 'up' && 'text-emerald-500'
                          )}>
                            {formatCurrency((liveBalance ?? currentUser.data.balance))}đ
                          </span>
                        </div>
                        <div className="mt-1 text-[10px] font-bold text-slate-500">
                          Ví game:{' '}
                          <span className={cn(
                            'whitespace-nowrap font-mono tabular-nums font-black text-emerald-500 transition-all duration-500',
                            pulseScope === 'gameBalance' && pulse === 'down' && 'text-rose-500',
                            pulseScope === 'gameBalance' && pulse === 'up' && 'text-emerald-500'
                          )}>
                            {formatCurrency((liveGameBalance ?? currentUser.data.game_balance) || 0)}đ
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
                      <DropdownMenuItem asChild>
                        <Link href="/user/blue-tick" className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-slate-600 dark:text-slate-400">
                          <Award className="h-4 w-4" />
                          <span className="text-xs font-black uppercase">Tick xanh</span>
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
          {!isAdmin ? (
            <div className="mx-2 mt-2 hidden shrink-0 gap-2 sm:mx-3 sm:mt-3 sm:grid md:mx-5 xl:grid-cols-[minmax(0,1fr)_auto]">
              <div className="mmo-status-strip min-w-0">
                <div className="mmo-status-token">
                  <CircleCheck className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Online</span>
                  <strong>99.9%</strong>
                </div>
                <div className="mmo-status-token">
                  <Zap className="h-3.5 w-3.5 text-amber-400" />
                  <span>Tốc độ cao</span>
                  <strong>12ms</strong>
                </div>
                <div className="mmo-status-token">
                  <Siren className="h-3.5 w-3.5 text-sky-400" />
                  <span>Bảo hành</span>
                  <strong>30 ngày</strong>
                </div>
              </div>
              <div className="mmo-shortcuts">
                {quickActionLinks.map((item) => (
                  <Link key={item.href} href={item.href} className="mmo-shortcut-btn" title={item.label}>
                    <item.icon className="h-3.5 w-3.5" />
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          <div className="shell-breadcrumb mx-2 mt-2 hidden shrink-0 px-3 py-2.5 sm:mx-3 sm:mt-3 sm:block sm:px-5 sm:py-3 md:mx-5 md:px-6">
            <nav className="relative z-10 flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1 text-[8px] font-black uppercase tracking-[0.28em] text-slate-400 custom-scrollbar dark:text-white/35 sm:text-[9px] sm:tracking-[0.34em]">
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
          <main className={cn('page-stack relative min-h-0 flex-1 overflow-x-hidden', fullHeight ? 'overflow-hidden' : 'overflow-y-auto custom-scrollbar')}>
            <div className={cn('w-full max-w-full', fullHeight ? 'h-full' : 'px-2.5 py-5 sm:px-3 sm:py-6 md:px-5 md:py-8 xl:px-6')}>{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
