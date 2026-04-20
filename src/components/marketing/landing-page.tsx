'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import {
  ArrowDownRight,
  ArrowRight,
  Activity,
  BarChart3,
  Check,
  Clock3,
  Cpu,
  CreditCard,
  Facebook,
  Gamepad2,
  Instagram,
  Menu,
  MessageCircle,
  Minus,
  Moon,
  Package,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Share2,
  ShoppingCart,
  Sparkles,
  Sun,
  ThumbsUp,
  Twitter,
  Users,
  Wallet,
  Youtube,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const partnerLogos = [
  { label: 'FACEBOOK', icon: Facebook, color: 'text-[#1877F2]' },
  { label: 'INSTAGRAM', icon: Instagram, color: 'text-[#E4405F]' },
  { label: 'TWITTER', icon: Twitter, color: 'text-[#1DA1F2]' },
  { label: 'YOUTUBE', icon: Youtube, color: 'text-[#FF0000]' },
  { label: 'TELEGRAM', icon: Send, color: 'text-[#229ED9]' },
];

const services = [
  {
    title: 'Tăng Tương Tác',
    desc: 'Dịch vụ mạng xã hội chuyên nghiệp',
    href: '/auth/login',
    icon: ThumbsUp,
    gradient: 'from-blue-500 to-blue-600',
    glow: 'shadow-blue-500/20',
    badge: 'HOT',
  },
  {
    title: 'Auto MXH',
    desc: 'Tự động hoá - Tối ưu thu nhập',
    href: '/auth/login',
    icon: Zap,
    gradient: 'from-violet-500 to-indigo-600',
    glow: 'shadow-violet-500/20',
    badge: 'NEW',
  },
  {
    title: 'Tài Nguyên',
    desc: 'Nguồn tài nguyên MMO chất lượng',
    href: '/auth/login',
    icon: Package,
    gradient: 'from-emerald-500 to-teal-600',
    glow: 'shadow-emerald-500/20',
    badge: null,
  },
  {
    title: 'Chợ MMO',
    desc: 'Giao dịch nhanh - An toàn tuyệt đối',
    href: '/auth/login',
    icon: ShoppingCart,
    gradient: 'from-blue-600 to-cyan-500',
    glow: 'shadow-cyan-500/20',
    badge: null,
  },
  {
    title: 'Forum MMO',
    desc: 'Kết nối cộng đồng kiếm tiền',
    href: '/auth/login',
    icon: Users,
    gradient: 'from-sky-500 to-blue-500',
    glow: 'shadow-sky-500/20',
    badge: null,
  },
  {
    title: 'Mua Bán Game',
    desc: 'Giao dịch game uy tín',
    href: '/auth/login',
    icon: Gamepad2,
    gradient: 'from-purple-500 to-violet-600',
    glow: 'shadow-purple-500/20',
    badge: null,
  },
  {
    title: 'Đổi Thẻ',
    desc: 'Thanh toán nhanh - Phí thấp',
    href: '/auth/login',
    icon: CreditCard,
    gradient: 'from-amber-500 to-orange-500',
    glow: 'shadow-amber-500/20',
    badge: null,
  },
  {
    title: 'Chia Sẻ',
    desc: 'Kiến thức MMO thực chiến',
    href: '/auth/login',
    icon: Share2,
    gradient: 'from-slate-600 to-slate-700',
    glow: 'shadow-slate-500/20',
    badge: null,
  },
];

const reasons = [
  {
    title: 'Tốc độ xử lý ưu việt',
    description:
      'Hệ thống được tối ưu hóa ở mức mã nguồn, đảm bảo mọi đơn hàng được khởi tạo ngay lập tức mà không gặp bất kỳ độ trễ nào.',
    icon: Zap,
    gradient: 'from-blue-500 to-indigo-600',
    accent: 'text-blue-500',
  },
  {
    title: 'Bảo mật chuẩn Enterprise',
    description:
      'Dữ liệu của bạn được mã hóa và bảo vệ bởi các lớp bảo mật đa tầng, cam kết an toàn tuyệt đối cho tài sản và thông tin cá nhân.',
    icon: ShieldCheck,
    gradient: 'from-violet-500 to-purple-600',
    accent: 'text-violet-500',
  },
  {
    title: 'Tối ưu cho Reseller',
    description:
      'Hệ thống API mạnh mẽ, tài liệu hướng dẫn chi tiết giúp các nhà phát triển và đại lý tích hợp nhanh chóng vào hệ thống riêng.',
    icon: Cpu,
    gradient: 'from-emerald-500 to-teal-600',
    accent: 'text-emerald-500',
  },
];

const faqItems = [
  {
    question: 'Làm sao để nạp tiền vào hệ thống?',
    answer:
      'Bạn có thể nạp tiền tự động qua chuyển khoản ngân hàng hoặc ví điện tử. Hệ thống sẽ cộng tiền tự động vào tài khoản sau khi nhận giao dịch hợp lệ.',
  },
  {
    question: 'Dịch vụ có bảo hành không?',
    answer:
      'Các dịch vụ có gắn nhãn bảo hành sẽ được bù hoặc hoàn theo chính sách. Hệ thống giữ lịch sử rõ ràng để kiểm tra và hỗ trợ xử lý nhanh.',
  },
];

export function LandingPage() {
  const { resolvedTheme, setTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [themePulse, setThemePulse] = useState<'light' | 'dark' | null>(null);
  const themeTimerRef = useRef<number | null>(null);
  const repeatedPartners = useMemo(() => [...partnerLogos, ...partnerLogos], []);
  const isDark = mounted ? resolvedTheme === 'dark' : true;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !resolvedTheme) {
      return;
    }

    document.documentElement.style.colorScheme = resolvedTheme === 'dark' ? 'dark' : 'light';
  }, [mounted, resolvedTheme]);

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

  return (
    <main className="relative bg-white dark:bg-[#04080f] overflow-x-hidden">
      {themePulse ? <div className={cn('theme-transition-overlay', themePulse === 'dark' ? 'theme-transition-overlay-dark' : 'theme-transition-overlay-light')} /> : null}

      {/* ─── NAVBAR ─── */}
      <nav
        className={`fixed left-0 right-0 top-0 z-50 transition-all duration-500 ${
          scrolled
            ? 'border-b border-slate-200/70 bg-white/80 py-3 backdrop-blur-2xl dark:border-white/[0.06] dark:bg-[#04080f]/80'
            : 'py-5'
        }`}
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex items-center justify-between">

            {/* Logo */}
            <Link href="/" className="group flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center">
                <div className="absolute inset-0 rounded-xl bg-brand-blue/20 blur-lg opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <img
                  src="/logo.gif"
                  alt="Logo"
                  className="relative z-10 h-10 w-auto grayscale transition-all duration-500 group-hover:grayscale-0"
                />
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-900 dark:text-white">
                  TRUNGTAMMMO
                </span>
                <span className="mt-0.5 text-[8px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600">
                  Hệ sinh thái MMO
                </span>
              </div>
            </Link>

            {/* Desktop nav links */}
            <div className="hidden items-center gap-8 lg:flex">
              {[
                { href: '#features', label: 'Hệ sinh thái' },
                { href: '#services', label: 'Dịch vụ' },
                { href: '#stats', label: 'Tài nguyên' },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="group relative text-[10px] font-black uppercase tracking-[0.28em] text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                >
                  {item.label}
                  <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-brand-blue transition-all duration-300 group-hover:w-full" />
                </a>
              ))}
              <Link
                href="/user/forum"
                className="group relative text-[10px] font-black uppercase tracking-[0.28em] text-brand-blue transition-colors hover:text-indigo-600"
              >
                Diễn đàn
                <span className="absolute -bottom-0.5 left-0 h-px w-full scale-x-100 bg-current transition-transform" />
              </Link>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              {/* Theme toggle */}
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

              <div className="hidden h-4 w-px bg-slate-200 dark:bg-white/10 sm:block" />

              <Link
                href="/auth/login"
                className="hidden text-[10px] font-black uppercase tracking-widest text-slate-500 transition-colors hover:text-slate-900 sm:inline-flex dark:text-slate-400 dark:hover:text-white"
              >
                Đăng nhập
              </Link>

              <Link
                href="/auth/register"
                className="relative overflow-hidden rounded-xl bg-brand-blue px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-brand-blue/30 transition-all hover:shadow-brand-blue/50 hover:-translate-y-0.5 active:translate-y-0"
              >
                <span className="relative z-10">Đăng ký</span>
                <span className="absolute inset-0 animate-shimmer" />
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ─── HERO SECTION ─── */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden pt-24">

        {/* Background layers */}
        <div className="pointer-events-none absolute inset-0 hero-grid opacity-100" />
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[5%] top-[15%] h-[50vw] w-[50vw] max-w-[700px] max-h-[700px] rounded-full bg-blue-600/8 blur-[130px] animate-float" />
          <div className="absolute bottom-[5%] right-[5%] h-[40vw] w-[40vw] max-w-[600px] max-h-[600px] rounded-full bg-indigo-500/8 blur-[110px] animate-float-reverse" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[30vw] w-[30vw] max-w-[400px] max-h-[400px] rounded-full bg-brand-blue/5 blur-[100px] animate-float-slow" />
        </div>

        {/* Radial mask */}
        <div className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_50%,transparent_90%)]" />

        <div className="relative z-10 mx-auto max-w-7xl px-5 text-center">
          <div className="mx-auto max-w-5xl space-y-10">

            {/* Badge */}
            <div className="inline-flex animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
              <div className="tag-pill">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                TRUNGTAMMMO.VN
                <Sparkles className="h-2.5 w-2.5 text-amber-500" />
              </div>
            </div>

            {/* Heading */}
            <h1
              className="animate-fade-in-up text-[clamp(48px,9vw,108px)] font-black uppercase leading-[0.88] tracking-[-0.04em] text-slate-900 dark:text-white"
              style={{ animationDelay: '0.12s' }}
            >
              THAY ĐỔI CÁCH{' '}
              <br className="hidden sm:block" />
              <span className="bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 bg-clip-text text-transparent [filter:drop-shadow(0_0_40px_rgba(99,102,241,0.35))]">
                BẠN LÀM MMO
              </span>
            </h1>

            {/* Subtext */}
            <p
              className="animate-fade-in-up mx-auto max-w-2xl text-base font-medium leading-relaxed text-slate-500 md:text-[17px] dark:text-slate-400"
              style={{ animationDelay: '0.2s' }}
            >
              Hệ thống hạ tầng tự động hóa tối ưu cho người làm Marketing Online. Kết nối mọi dịch vụ thành một quy trình khép kín, an toàn và cực kỳ nhanh chóng.
            </p>

            {/* CTAs */}
            <div
              className="animate-fade-in-up flex flex-col items-center justify-center gap-4 pt-4 sm:flex-row"
              style={{ animationDelay: '0.28s' }}
            >
              <Link
                href="/auth/register"
                className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-10 py-4 shadow-2xl shadow-blue-600/30 transition-all hover:-translate-y-1 hover:shadow-blue-600/50 active:translate-y-0 sm:w-auto"
              >
                <span className="relative z-10 text-xs font-black uppercase tracking-[0.28em] text-white">
                  Bắt đầu ngay — Miễn phí
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-blue-500 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              </Link>

              <a
                href="#services"
                className="group flex w-full items-center justify-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-10 py-4 text-[11px] font-black uppercase tracking-[0.28em] text-slate-700 transition-all hover:border-brand-blue/40 hover:text-brand-blue sm:w-auto dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:text-white"
              >
                Khám phá dịch vụ
                <ArrowDownRight className="h-4 w-4 transition-transform duration-300 group-hover:rotate-45" />
              </a>
            </div>

            {/* Stats bar */}
            <div
              className="animate-fade-in-up mt-6 grid grid-cols-2 gap-6 border-t border-slate-100 pt-12 md:gap-0 lg:grid-cols-4 dark:border-white/[0.06]"
              style={{ animationDelay: '0.36s' }}
            >
              {[
                { value: '1.2M+', label: 'GIAO DỊCH', accent: '' },
                { value: '12ms',  label: 'TỐC ĐỘ XỬ LÝ', accent: 'text-brand-blue' },
                { value: '50K+',  label: 'KHÁCH HÀNG', accent: '' },
                { value: '24/7',  label: 'HỖ TRỢ ONLINE', accent: '' },
              ].map((item, i) => (
                <div key={item.label} className={`space-y-2 text-left ${i > 0 ? 'md:border-l md:border-slate-100 md:pl-8 dark:md:border-white/[0.06]' : ''}`}>
                  <div className={`text-3xl font-black tracking-tighter text-slate-900 dark:text-white ${item.accent}`}>
                    {item.value}
                  </div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── CORE SYSTEM SECTION ─── */}
      <section className="relative overflow-hidden bg-slate-50 py-24 md:py-36 dark:bg-[#07101e]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/4 top-0 h-[500px] w-[500px] -translate-y-1/2 rounded-full bg-brand-blue/6 blur-[150px] animate-pulse-slow" />
          <div className="absolute bottom-0 right-1/4 h-[400px] w-[400px] translate-y-1/2 rounded-full bg-indigo-500/6 blur-[130px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex flex-col items-center gap-20 lg:flex-row">

            {/* Left text */}
            <div className="w-full space-y-10 lg:w-1/2">
              <div className="space-y-6">
                <div className="tag-pill">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
                  </span>
                  Hệ thống lõi thông minh
                </div>

                <h2 className="text-[clamp(38px,6vw,76px)] font-black uppercase leading-[0.9] tracking-tighter text-slate-900 dark:text-white">
                  VẬN HÀNH{' '}
                  <span className="bg-gradient-to-r from-brand-blue to-violet-500 bg-clip-text text-transparent">
                    TỰ ĐỘNG HÓA
                  </span>
                </h2>

                <p className="max-w-lg text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                  Chúng tôi không chỉ cung cấp dịch vụ, chúng tôi xây dựng một hạ tầng kỹ thuật vững chắc giúp bạn tối ưu hóa công việc MMO mỗi ngày. Mọi thao tác đều được xử lý bởi trí tuệ nhân tạo và hệ thống máy chủ mạnh mẽ.
                </p>
              </div>

              <div className="space-y-5">
                {[
                  { value: '0.12s', label: 'Tốc độ phản hồi trung bình', pct: 68, color: 'bg-brand-blue' },
                  { value: '100%', label: 'Khả năng mở rộng tự động',   pct: 100, color: 'bg-violet-500' },
                ].map((item) => (
                  <div key={item.label} className="space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{item.label}</span>
                      <span className="text-2xl font-black text-slate-900 dark:text-white">{item.value}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                      <div
                        className={`h-full rounded-full ${item.color}`}
                        style={{ width: `${item.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <a href="#services" className="group inline-flex items-center gap-4">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-900 underline underline-offset-4 decoration-slate-200 transition-all group-hover:decoration-brand-blue dark:text-white dark:decoration-white/20">
                  Khám phá công nghệ
                </span>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 transition-all group-hover:translate-x-1 group-hover:bg-brand-blue group-hover:text-white dark:bg-white/[0.06]">
                  <ArrowRight className="h-4 w-4" />
                </div>
              </a>
            </div>

            {/* Right — visual orb */}
            <div className="relative flex h-[480px] w-full items-center justify-center lg:w-1/2">
              {/* Orbit rings */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="aspect-square w-[320px] rounded-full border border-dashed border-slate-200/60 animate-[spin_70s_linear_infinite] md:w-[460px] dark:border-white/[0.08]" />
                <div className="absolute aspect-square w-[220px] rounded-full border border-slate-200/40 animate-[spin_45s_linear_reverse_infinite] md:w-[360px] dark:border-white/[0.05]" />
                <div className="absolute aspect-square w-[140px] rounded-full border border-slate-200/30 animate-[spin_25s_linear_infinite] md:w-[240px] dark:border-white/[0.04]" />
              </div>

              {/* Core orb */}
              <div className="relative z-10 flex h-52 w-52 items-center justify-center md:h-64 md:w-64">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500/25 to-indigo-600/25 blur-[60px] animate-pulse-slow" />
                <div className="relative z-10 flex h-36 w-36 items-center justify-center md:h-44 md:w-44">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 opacity-90 shadow-[0_0_60px_rgba(37,99,235,0.5)]" />
                  <svg viewBox="0 0 100 100" className="relative z-10 h-16 w-16 text-white">
                    <circle cx="50" cy="50" r="18" fill="currentColor" opacity="0.9" />
                    <circle cx="50" cy="20" r="5" fill="currentColor" opacity="0.5" />
                    <circle cx="80" cy="65" r="4" fill="currentColor" opacity="0.5" />
                    <circle cx="20" cy="65" r="4" fill="currentColor" opacity="0.5" />
                    <line x1="50" y1="32" x2="50" y2="25" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
                    <line x1="63" y1="57" x2="75" y2="63" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
                    <line x1="37" y1="57" x2="25" y2="63" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
                  </svg>
                </div>

                {/* Floating badges */}
                <div className="glass-card absolute -right-12 -top-10 rounded-2xl px-4 py-3 shadow-xl dark:shadow-black/30">
                  <div className="text-[7px] font-black uppercase tracking-widest text-slate-400">HOẠT ĐỘNG</div>
                  <div className="text-lg font-black text-slate-900 dark:text-white">316</div>
                </div>
                <div className="glass-card absolute -bottom-6 -left-14 rounded-2xl px-4 py-3 shadow-xl dark:shadow-black/30">
                  <div className="text-[7px] font-black uppercase tracking-widest text-brand-blue">ỔN ĐỊNH</div>
                  <div className="text-lg font-black text-slate-900 dark:text-white">99.98%</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ─── PARTNERS / ACTIVITY SECTION ─── */}
      <section className="relative border-y border-slate-100 bg-white py-16 dark:border-white/[0.05] dark:bg-[#04080f]">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex flex-col gap-12 lg:flex-row lg:items-stretch">

            {/* Partner logos marquee */}
            <div className="flex w-full flex-col justify-center space-y-6 lg:w-1/2">
              <div className="space-y-1">
                <span className="text-[9px] font-black uppercase tracking-[0.4em] text-brand-blue">
                  Official Partners
                </span>
                <h3 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
                  KẾT NỐI VỚI CÁC NỀN TẢNG LỚN
                </h3>
              </div>

              <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]">
                <div className="flex items-center gap-14 whitespace-nowrap py-3 animate-scroll-left">
                  {repeatedPartners.map((item, index) => (
                    <div key={`${item.label}-${index}`} className="flex cursor-default items-center gap-2.5 opacity-35 grayscale transition-all hover:opacity-100 hover:grayscale-0">
                      <item.icon className={`h-7 w-7 ${item.color}`} />
                      <span className="text-lg font-black text-slate-400 dark:text-slate-500">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Activity feed */}
            <div className="relative w-full lg:w-1/2">
              <div className="absolute -inset-4 rounded-[2.5rem] bg-gradient-to-br from-brand-blue/5 to-violet-500/5 blur-2xl" />
              <div className="relative h-full overflow-hidden rounded-3xl border border-slate-100 bg-slate-50/80 p-7 backdrop-blur-sm dark:border-white/[0.05] dark:bg-[#0c1529]/60">
                <div className="mb-7 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-blue/10 text-brand-blue">
                      <Activity className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-tight text-slate-900 dark:text-white">
                        HOẠT ĐỘNG HỆ THỐNG
                      </h4>
                      <p className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-widest text-emerald-500">
                        <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                        Tất cả hệ thống hoạt động
                      </p>
                    </div>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[9px] font-black text-slate-400 dark:border-white/10 dark:bg-white/5">
                    LIVE
                  </div>
                </div>

                <div className="space-y-3">
                  {[
                    {
                      icon: ShoppingCart,
                      iconBg: 'from-blue-500 to-indigo-600',
                      text: 'User ***882 vừa đặt mua FB Like PRO',
                      meta: '12 giây trước',
                      status: 'THÀNH CÔNG',
                      ref: '#SUBFB4892',
                      muted: false,
                    },
                    {
                      icon: Wallet,
                      iconBg: 'from-emerald-500 to-teal-600',
                      text: 'User ***104 nạp 2,000,000đ',
                      meta: '1 phút trước qua ATM',
                      status: 'THÀNH CÔNG',
                      ref: '#TECHCOMBANK',
                      muted: true,
                    },
                  ].map((item) => (
                    <div
                      key={item.text}
                      className={`group flex items-center justify-between rounded-2xl border border-slate-200/60 bg-white/80 p-4 shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-brand-blue/30 hover:shadow-md dark:border-white/[0.07] dark:bg-[#111d36]/80 ${item.muted ? 'opacity-55' : ''}`}
                    >
                      <div className="flex items-center gap-3.5">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${item.iconBg} text-white shadow-md`}>
                          <item.icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase text-slate-900 dark:text-white">{item.text}</p>
                          <p className="text-[8px] font-bold uppercase tracking-tighter text-slate-400">{item.meta}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="block text-[9px] font-black uppercase text-brand-blue">{item.status}</span>
                        <span className="block text-[8px] font-bold text-slate-300 dark:text-slate-600">{item.ref}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 rounded-b-3xl bg-gradient-to-t from-slate-50 to-transparent dark:from-[#0c1529]" />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ─── WHY US SECTION ─── */}
      <section id="features" className="relative overflow-hidden bg-white py-24 md:py-36 dark:bg-[#04080f]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-blue/4 blur-[180px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid grid-cols-1 items-center gap-20 lg:grid-cols-2">

            {/* Left */}
            <div className="space-y-10">
              <div className="space-y-5">
                <div className="tag-pill">Professional Standards</div>
                <h2 className="text-[clamp(36px,5vw,68px)] font-black uppercase leading-[0.92] tracking-tighter text-slate-900 dark:text-white">
                  TẠI SAO CHỌN{' '}
                  <span className="bg-gradient-to-r from-brand-blue to-violet-600 bg-clip-text text-transparent">
                    TRUNGTAMMMO?
                  </span>
                </h2>
              </div>

              <div className="space-y-5">
                {reasons.map((reason, i) => (
                  <div
                    key={reason.title}
                    className="group flex gap-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all duration-300 hover:border-transparent hover:shadow-xl hover:-translate-y-0.5 dark:border-white/[0.06] dark:bg-[#0c1529]/80"
                    style={{ transitionDelay: `${i * 50}ms` }}
                  >
                    <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${reason.gradient} text-white shadow-lg`}>
                      <reason.icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className={`text-base font-black uppercase tracking-tight text-slate-900 dark:text-white`}>
                        {reason.title}
                      </h3>
                      <p className="text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                        {reason.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — dashboard preview */}
            <div className="relative">
              <div className="absolute -inset-8 rounded-full bg-gradient-to-br from-brand-blue/8 to-violet-500/8 blur-[100px] animate-pulse-slow" />
              <div className="relative overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white p-10 shadow-2xl dark:border-white/[0.07] dark:bg-[#0c1529]">
                {/* Window chrome */}
                <div className="mb-8 flex items-center justify-between">
                  <div className="flex gap-2">
                    <div className="h-3 w-3 rounded-full bg-red-400/50" />
                    <div className="h-3 w-3 rounded-full bg-amber-400/50" />
                    <div className="h-3 w-3 rounded-full bg-emerald-400/50" />
                  </div>
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-[8px] font-black uppercase tracking-widest text-slate-400 dark:bg-white/5">
                    Reseller Panel v4
                  </div>
                </div>

                {/* Preview rows */}
                <div className="space-y-3">
                  {[
                    { icon: Check, width: 'w-32', tail: 'w-12', opacity: '', color: 'bg-blue-500/10 text-blue-500' },
                    { icon: Clock3, width: 'w-48', tail: 'w-8', opacity: 'opacity-55', color: 'bg-violet-500/10 text-violet-500' },
                    { icon: BarChart3, width: 'w-40', tail: '', opacity: 'opacity-35', color: 'bg-emerald-500/10 text-emerald-500' },
                  ].map((item, index) => (
                    <div
                      key={index}
                      className={`flex h-12 w-full items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-5 dark:border-white/[0.05] dark:bg-white/[0.03] ${item.opacity}`}
                    >
                      <div className={`flex h-6 w-6 items-center justify-center rounded-lg ${item.color}`}>
                        <item.icon className="h-3 w-3" />
                      </div>
                      <div className={`h-2 rounded-full bg-slate-200 dark:bg-slate-700 ${item.width}`} />
                      {item.tail ? <div className={`ml-auto h-2 rounded-full bg-emerald-400/30 ${item.tail}`} /> : null}
                    </div>
                  ))}
                </div>

                {/* User avatars */}
                <div className="mt-10 flex items-center gap-5">
                  <div className="flex -space-x-3">
                    {['bg-blue-500', 'bg-violet-500', 'bg-indigo-400'].map((c, i) => (
                      <div key={i} className={`h-9 w-9 rounded-full border-4 border-white dark:border-[#0c1529] ${c}`} />
                    ))}
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-tight text-slate-900 dark:text-white">
                      Cùng 50K+ đại lý
                    </div>
                    <div className="mt-0.5 text-[8px] font-bold uppercase tracking-widest text-slate-400">
                      Sử dụng hệ thống API
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ─── SERVICES SECTION ─── */}
      <section id="services" className="relative bg-slate-50 py-24 md:py-36 dark:bg-[#07101e]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-0 top-0 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-blue/5 blur-[120px]" />
          <div className="absolute bottom-0 right-0 h-[400px] w-[400px] translate-x-1/2 translate-y-1/2 rounded-full bg-violet-500/5 blur-[120px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mx-auto mb-20 max-w-3xl space-y-4 text-center">
            <div className="tag-pill mx-auto">Unified Solutions</div>
            <h2 className="text-[clamp(34px,5vw,62px)] font-black uppercase leading-none tracking-tighter text-slate-900 dark:text-white">
              DỊCH VỤ NỔI BẬT
            </h2>
            <p className="mx-auto max-w-lg text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
              Tất cả công cụ cần thiết để bứt phá doanh số trên nền tảng số, quy tụ trong một hệ sinh thái duy nhất.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((service, i) => (
              <Link
                key={service.title}
                href={service.href}
                className="group relative block overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-8 shadow-sm transition-all duration-400 hover:-translate-y-2 hover:border-transparent hover:shadow-2xl dark:border-white/[0.06] dark:bg-[#0c1529]"
                style={{ transitionDelay: `${i * 30}ms` }}
              >
                {/* Hover glow */}
                <div className={`absolute -inset-px rounded-3xl bg-gradient-to-br ${service.gradient} opacity-0 transition-opacity duration-500 group-hover:opacity-10`} />

                <div className="relative z-10 space-y-6">
                  {/* Icon */}
                  <div className={`relative inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${service.gradient} shadow-lg ${service.glow}`}>
                    <service.icon className="h-6 w-6 text-white" />
                    {service.badge ? (
                      <span className="absolute -right-2 -top-2 rounded-full bg-rose-500 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-widest text-white shadow-md">
                        {service.badge}
                      </span>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 transition-colors group-hover:text-brand-blue dark:text-white">
                      {service.title}
                    </h3>
                    <p className="text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                      {service.desc}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400 transition-colors group-hover:text-brand-blue">
                    Xem thêm
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ SECTION ─── */}
      <section className="bg-white py-24 md:py-36 dark:bg-[#04080f]">
        <div className="mx-auto max-w-3xl px-5 sm:px-8">
          <div className="mb-20 space-y-4 text-center">
            <div className="tag-pill mx-auto">Support System</div>
            <h2 className="text-[clamp(30px,5vw,58px)] font-black uppercase leading-none tracking-tighter text-slate-900 dark:text-white">
              CÂU HỎI THƯỜNG GẶP
            </h2>
          </div>

          <div className="space-y-4">
            {faqItems.map((item, index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={item.question}
                  className={`overflow-hidden rounded-2xl border transition-all duration-400 ${
                    isOpen
                      ? 'border-brand-blue/40 bg-blue-50/50 shadow-lg shadow-brand-blue/10 dark:bg-blue-900/10 dark:border-brand-blue/30'
                      : 'border-slate-200 bg-white hover:border-slate-300 dark:border-white/[0.07] dark:bg-[#0c1529]'
                  }`}
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? -1 : index)}
                    className="flex w-full items-center justify-between px-8 py-7 text-left"
                  >
                    <span className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">
                      {item.question}
                    </span>
                    <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border transition-all duration-300 ${
                      isOpen
                        ? 'border-brand-blue/30 bg-brand-blue text-white rotate-180'
                        : 'border-slate-200 dark:border-white/10'
                    }`}>
                      {isOpen ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    </div>
                  </button>
                  {isOpen ? (
                    <div className="px-8 pb-7 text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                      {item.answer}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── CTA BANNER ─── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 py-24">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[10%] top-[10%] h-[300px] w-[300px] rounded-full bg-white/10 blur-[80px] animate-float" />
          <div className="absolute bottom-[10%] right-[10%] h-[250px] w-[250px] rounded-full bg-white/10 blur-[70px] animate-float-reverse" />
          <div className="absolute inset-0 bg-[radial-gradient(#ffffff12_1px,transparent_1px)] [background-size:32px_32px]" />
        </div>
        <div className="relative z-10 mx-auto max-w-4xl px-5 text-center">
          <h2 className="mb-6 text-[clamp(28px,5vw,56px)] font-black uppercase leading-tight tracking-tighter text-white">
            SẴN SÀNG BẮT ĐẦU <br className="hidden sm:block" />
            HÀNH TRÌNH MMO?
          </h2>
          <p className="mb-10 text-sm font-medium leading-relaxed text-blue-100">
            Tham gia cùng hơn 50,000+ thành viên đang kiếm tiền online với TRUNGTAMMMO.VN mỗi ngày.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/auth/register"
              className="group relative overflow-hidden rounded-2xl bg-white px-10 py-4 text-[11px] font-black uppercase tracking-[0.25em] text-blue-600 shadow-xl shadow-black/20 transition-all hover:-translate-y-0.5 hover:shadow-2xl active:translate-y-0"
            >
              <span className="relative z-10">Đăng ký Miễn phí</span>
            </Link>
            <Link
              href="/auth/login"
              className="rounded-2xl border border-white/25 bg-white/10 px-10 py-4 text-[11px] font-black uppercase tracking-[0.25em] text-white backdrop-blur-sm transition-all hover:bg-white/20"
            >
              Đăng nhập
            </Link>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="border-t border-slate-100 bg-white py-14 dark:border-white/[0.05] dark:bg-[#04080f]">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex flex-col items-center justify-between gap-10 lg:flex-row">

            <div className="flex flex-col items-center gap-3 lg:items-start">
              <Link href="/" className="flex items-center gap-3">
                <img src="/logo.gif" alt="TRUNGTAMMMO" className="h-8 w-auto opacity-70 grayscale" />
                <span className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">
                  TRUNGTAMMMO
                </span>
              </Link>
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                Unified Automated Ecosystem © 2025
              </p>
            </div>

            <div className="flex items-center gap-8">
              {[
                { href: '/terms',   label: 'Điều khoản' },
                { href: '/privacy', label: 'Bảo mật' },
                { href: '/about',   label: 'Liên hệ' },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-[9px] font-black uppercase tracking-widest text-slate-400 transition-colors hover:text-brand-blue"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </footer>

    </main>
  );
}
