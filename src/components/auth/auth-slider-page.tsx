'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { animate, remove, stagger } from 'animejs';
import { useTheme } from 'next-themes';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Chrome,
  DatabaseZap,
  Home,
  LayoutDashboard,
  MessageCircle,
  Moon,
  ServerCog,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Sun,
  WalletCards,
  X,
} from 'lucide-react';
import { BrandForestWordmark } from '@/components/ui/brand-forest-wordmark';
import { FlipButton } from '@/components/ui/flip-button';
import { startPageTransition } from '@/components/layout/navigation-effects';
import { clearSessionUserCache } from '@/hooks/use-session-user';
import { siteName, siteShortName } from '@/lib/seo';
import { startThemeSwitchAnimation } from '@/lib/theme-switch-animation';
import { cn } from '@/lib/utils';

type AuthTab = 'login' | 'register';

interface AuthSliderPageProps {
  initialTab?: AuthTab;
}

interface BlockedIpState {
  ip: string;
  message: string;
}

const SUPPORT_URL = 'https://t.me/kaizxabc';

const authSignals = [
  { icon: DatabaseZap, label: 'Quản lý dữ liệu người dùng' },
  { icon: WalletCards, label: 'Theo dõi số dư và giao dịch' },
  { icon: LayoutDashboard, label: 'Đi vào bảng điều khiển ngay' },
];

const loginHighlights = [
  'Đăng nhập xong là vào thẳng khu user để dùng dịch vụ.',
  'Theo dõi đơn, số dư và hỗ trợ trên cùng một hệ thống.',
];

const registerHighlights = [
  'Tạo tài khoản mới để bắt đầu dùng toàn bộ dịch vụ MMO.',
  'Sau khi đăng ký, hệ thống gửi mã xác thực email để kích hoạt tài khoản.',
];

export function AuthSliderPage({ initialTab = 'login' }: AuthSliderPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<AuthTab>(initialTab);
  const [registeredFlash, setRegisteredFlash] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [registerError, setRegisterError] = useState('');
  const [blockedIp, setBlockedIp] = useState<BlockedIpState | null>(null);
  const [loginForm, setLoginForm] = useState({
    username: '',
    password: '',
    remember: false,
  });
  const [registerForm, setRegisterForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    fullname: '',
    agreeTerms: false,
  });

  const isDark = mounted ? resolvedTheme === 'dark' : true;
  const requestedTab = searchParams.get('tab') === 'register' ? 'register' : 'login';
  const registered = searchParams.get('registered') === 'true';
  const oauthError = searchParams.get('oauth_error') || '';
  const loginMessage = loginError || (registeredFlash ? 'Tài khoản đã được tạo. Anh có thể đăng nhập ngay bây giờ.' : '');
  const loginMessageTone = loginError ? 'warning' : 'success';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setRegisteredFlash(registered);
  }, [registered]);

  useEffect(() => {
    if (!oauthError) {
      return;
    }

    if (requestedTab === 'register') {
      setRegisterError(oauthError);
    } else {
      setLoginError(oauthError);
    }
    setRegisteredFlash(false);
  }, [oauthError, requestedTab]);

  useEffect(() => {
    setTab(requestedTab);
  }, [requestedTab]);

  useEffect(() => {
    const syncFromBrowserLocation = () => {
      const params = new URLSearchParams(window.location.search);
      const nextTab = params.get('tab') === 'register' ? 'register' : 'login';
      setTab(nextTab);
      setRegisteredFlash(params.get('registered') === 'true');
    };

    window.addEventListener('popstate', syncFromBrowserLocation);
    return () => {
      window.removeEventListener('popstate', syncFromBrowserLocation);
    };
  }, []);

  useEffect(() => {
    router.prefetch('/user/home');
    router.prefetch('/auth/2fa');
  }, [router]);

  useEffect(() => {
    animate('.auth-orb', {
      translateY: [0, -24],
      translateX: [0, 14],
      scale: [1, 1.08],
      opacity: [0.34, 0.82],
      duration: 4300,
      easing: 'inOutSine',
      direction: 'alternate',
      loop: true,
      delay: stagger(180),
    });

    animate('.auth-header-shell, .auth-slider-shell', {
      translateY: [36, 0],
      opacity: [0, 1],
      scale: [0.985, 1],
      duration: 950,
      easing: 'outExpo',
      delay: stagger(60),
    });

    animate('.auth-stage-card, .auth-overlay-panel', {
      translateY: [28, 0],
      opacity: [0, 1],
      duration: 900,
      easing: 'outExpo',
      delay: stagger(110),
    });

    return () => {
      remove('.auth-orb');
      remove('.auth-header-shell');
      remove('.auth-slider-shell');
      remove('.auth-stage-card');
      remove('.auth-overlay-panel');
      remove('.auth-form-enter');
    };
  }, []);

  useEffect(() => {
    remove('.auth-slider-form-container[data-auth-panel="active"] .auth-form-enter');
    animate('.auth-slider-form-container[data-auth-panel="active"] .auth-form-enter', {
      translateY: [14, 0],
      opacity: [0, 1],
      scale: [0.985, 1],
      duration: 500,
      easing: 'outQuad',
      delay: stagger(60),
    });
  }, [tab, loginError, registerError, registeredFlash]);

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

  function switchTab(nextTab: AuthTab) {
    setTab(nextTab);
    setLoginError('');
    setRegisterError('');
    setBlockedIp(null);
    setRegisteredFlash(false);

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (nextTab === 'register') {
        params.set('tab', 'register');
      } else {
        params.delete('tab');
      }
      params.delete('registered');
      params.delete('oauth_error');
      const nextSearch = params.toString();
      const target = nextSearch ? `/auth?${nextSearch}` : '/auth';
      const current = `${window.location.pathname}${window.location.search}`;
      if (current !== target) {
        window.history.pushState({}, '', target);
      }
    }
  }

  async function handleLoginSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setLoginError(data.message || 'Đăng nhập thất bại');
        return;
      }

      const redirect = typeof data.redirect === 'string' && data.redirect.startsWith('/')
        ? data.redirect
        : '/user/home';
      const nextHref = data.require2fa ? `/auth/2fa?next=${encodeURIComponent(redirect)}` : redirect;
      startPageTransition();
      clearSessionUserCache();
      if (typeof window !== 'undefined') {
        window.location.replace(nextHref);
        return;
      }
      router.replace(nextHref);
    } catch {
      setLoginError('Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleRegisterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRegisterError('');
    setBlockedIp(null);

    if (registerForm.password !== registerForm.confirmPassword) {
      setRegisterError('Mật khẩu xác nhận không khớp');
      return;
    }

    if (!registerForm.agreeTerms) {
      setRegisterError('Bạn cần đồng ý với điều khoản sử dụng');
      return;
    }

    setRegisterLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerForm),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        if (res.status === 403 && data.code === 'IP_BLOCKED') {
          setBlockedIp({
            ip: data.ip || 'unknown',
            message: data.message || 'Địa chỉ IP của bạn đã bị chặn. Vui lòng liên hệ admin để mở khóa.',
          });
        }

        setRegisterError(data.message || 'Đăng ký thất bại');
        return;
      }

      setRegisterForm({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        fullname: '',
        agreeTerms: false,
      });
      setRegisterError('');
      const emailQuery = encodeURIComponent(registerForm.email);
      startPageTransition();
      router.replace(`/auth/verify-email?email=${emailQuery}`);
    } catch {
      setRegisterError('Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setRegisterLoading(false);
    }
  }

  const passwordStrength = useMemo(() => {
    const pwd = registerForm.password;
    if (!pwd) {
      return 0;
    }

    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  }, [registerForm.password]);

  const strengthColor = ['', 'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-emerald-500'][passwordStrength];
  const strengthLabel = ['', 'Yếu', 'Trung bình', 'Khá mạnh', 'Mạnh'][passwordStrength];

  return (
    <div className="mmo-board min-h-screen auth-bg font-sans antialiased text-slate-300 relative overflow-x-hidden">
      {blockedIp ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/72 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-red-500/20 bg-white p-7 text-center shadow-2xl shadow-red-500/20 dark:bg-slate-950">
            <button
              type="button"
              onClick={() => setBlockedIp(null)}
              className="absolute right-4 top-4 rounded-full bg-slate-100 p-2 text-slate-500 transition-colors hover:text-slate-900 dark:bg-white/10 dark:text-slate-300"
              aria-label="Đóng cảnh báo"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-red-500/10 text-red-500">
              <ShieldAlert className="h-10 w-10" />
            </div>
            <div className="mt-5 inline-flex rounded-full bg-red-500 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-white">
              IP bị khóa
            </div>
            <h2 className="mt-4 text-2xl font-black uppercase tracking-[-0.04em] text-slate-950 dark:text-white">
              Không thể tạo thêm tài khoản
            </h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-300">
              {blockedIp.message}
            </p>
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Địa chỉ IP</div>
              <div className="mt-1 font-mono text-sm font-black text-red-500">{blockedIp.ip}</div>
            </div>
            <a
              href={SUPPORT_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-xs font-black uppercase tracking-widest text-white transition-all hover:-translate-y-0.5 hover:shadow-xl dark:bg-white dark:text-slate-950"
            >
              <MessageCircle className="h-4 w-4" />
              Liên hệ admin để mở khóa
            </a>
          </div>
        </div>
      ) : null}

      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" />

      <main className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-[92rem] flex-col px-4 py-5 sm:px-5 sm:py-6 md:px-6 xl:px-8">
        <header className="auth-header-shell relative z-20 mb-5 flex flex-col gap-3 rounded-[1.5rem] border border-sky-400/20 bg-[#071629]/88 px-4 py-4 shadow-[0_24px_60px_rgba(0,102,255,0.12)] backdrop-blur-2xl md:flex-row md:items-center md:justify-between">
          <Link href="/" className="flex min-w-0 items-center gap-4">
            <div className="surface-card rounded-[1.5rem] px-4 py-3">
              <Image src="/logo.gif" alt={siteName} width={180} height={52} unoptimized className="h-10 w-auto object-contain sm:h-12" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400 dark:text-slate-500">
                Cổng xác thực
              </div>
              <BrandForestWordmark text={siteShortName} className="mt-1 text-[0.95rem] text-slate-900 dark:text-white sm:text-[1.1rem]" />
            </div>
          </Link>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <a
              href={SUPPORT_URL}
              target="_blank"
              rel="noreferrer"
              className="ghost-button inline-flex h-11 items-center justify-center gap-2 rounded-full px-4 text-[11px] font-black uppercase tracking-[0.18em]"
            >
              <MessageCircle className="h-4 w-4" />
              Hỗ trợ
            </a>
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
            <Link
              href="/"
              className="ghost-button inline-flex h-11 items-center justify-center gap-2 rounded-full px-4 text-[11px] font-black uppercase tracking-[0.18em]"
            >
              <Home className="h-4 w-4" />
              Trang chủ
            </Link>
          </div>
        </header>

        <section className="auth-page-shell relative z-10 flex-1 py-2 md:py-4 xl:py-6">
          <div className={`auth-slider-shell ${tab === 'register' ? 'right-panel-active' : ''}`}>
            <div className="auth-orb auth-orb-a" />
            <div className="auth-orb auth-orb-b" />
            <div className="auth-orb auth-orb-c" />

            <div className="auth-mobile-switch">
              <button
                type="button"
                onClick={() => switchTab('login')}
                className={tab === 'login' ? 'is-active' : ''}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                onClick={() => switchTab('register')}
                className={tab === 'register' ? 'is-active' : ''}
              >
                Đăng ký
              </button>
            </div>

            <div
              className="auth-slider-form-container auth-sign-up-container"
              data-auth-panel={tab === 'register' ? 'active' : 'inactive'}
            >
              <div className="auth-stage-card">
                <form className="auth-slider-form" onSubmit={handleRegisterSubmit}>
                  <span className="auth-slider-kicker auth-form-enter">
                    <Sparkles className="h-3.5 w-3.5" />
                    Mở tài khoản mới
                  </span>
                  <h1 className="auth-slider-title auth-form-enter">Tạo tài khoản trung tâm MMO</h1>
                  <p className="auth-slider-copy auth-form-enter">
                    Đăng ký một lần để dùng dịch vụ, quản lý số dư và thao tác nhanh trong khu người dùng.
                  </p>

                  <div className="auth-signal-row auth-form-enter">
                    {authSignals.map((item) => (
                      <span key={item.label} className="auth-signal-chip" title={item.label}>
                        <item.icon className="h-4 w-4" />
                        <span className="sr-only">{item.label}</span>
                      </span>
                    ))}
                  </div>

                  {registerError ? (
                    <div className="auth-slider-message auth-form-enter">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{registerError}</span>
                    </div>
                  ) : null}

                  <a href="/api/auth/google/start?mode=register" className="auth-google-button auth-form-enter">
                    <Chrome className="h-4 w-4" />
                    Đăng ký với Google
                  </a>

                  <div className="auth-divider auth-form-enter">
                    <span>Hoặc đăng ký bằng email</span>
                  </div>

                  <input
                    name="fullname"
                    placeholder="Họ và tên"
                    className="input-shell auth-field auth-form-enter"
                    autoComplete="name"
                    value={registerForm.fullname}
                    onChange={(event) => setRegisterForm((current) => ({ ...current, fullname: event.target.value }))}
                  />

                  <div className="auth-form-grid auth-form-enter">
                    <input
                      name="username"
                      placeholder="Tên đăng nhập"
                      className="input-shell auth-field"
                      autoComplete="username"
                      required
                      minLength={3}
                      maxLength={50}
                      value={registerForm.username}
                      onChange={(event) => setRegisterForm((current) => ({ ...current, username: event.target.value }))}
                    />
                    <input
                      name="email"
                      type="email"
                      placeholder="Email"
                      className="input-shell auth-field"
                      autoComplete="email"
                      required
                      value={registerForm.email}
                      onChange={(event) => setRegisterForm((current) => ({ ...current, email: event.target.value }))}
                    />
                  </div>

                  <div className="auth-form-grid auth-form-enter">
                    <input
                      name="password"
                      type="password"
                      placeholder="Mật khẩu"
                      className="input-shell auth-field"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={registerForm.password}
                      onChange={(event) => setRegisterForm((current) => ({ ...current, password: event.target.value }))}
                    />
                    <input
                      name="confirmPassword"
                      type="password"
                      placeholder="Nhập lại mật khẩu"
                      className="input-shell auth-field"
                      autoComplete="new-password"
                      required
                      value={registerForm.confirmPassword}
                      onChange={(event) => setRegisterForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                    />
                  </div>

                  {registerForm.password ? (
                    <div className="auth-password-strength auth-form-enter">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((item) => (
                          <div
                            key={item}
                            className={cn(
                              'h-1 flex-1 rounded-full transition-all',
                              item <= passwordStrength ? strengthColor : 'bg-slate-200 dark:bg-white/10',
                            )}
                          />
                        ))}
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                        Độ mạnh mật khẩu: <span className="text-slate-700 dark:text-slate-200">{strengthLabel || 'Rất yếu'}</span>
                      </p>
                    </div>
                  ) : null}

                  <label className="auth-terms-row auth-form-enter">
                    <input
                      type="checkbox"
                      checked={registerForm.agreeTerms}
                      onChange={(event) => setRegisterForm((current) => ({ ...current, agreeTerms: event.target.checked }))}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 bg-white text-brand-blue focus:ring-brand-blue dark:border-white/10 dark:bg-white/5"
                    />
                    <span>
                      Tôi đồng ý với <Link href="/terms">Điều khoản dịch vụ</Link> và <Link href="/privacy">Chính sách bảo mật</Link>.
                    </span>
                  </label>

                  <FlipButton
                    type="submit"
                    size="lg"
                    disabled={registerLoading}
                    className="auth-form-enter w-full"
                    stageClassName="w-full min-w-0"
                  >
                    {registerLoading ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
                    <ArrowRight className="h-4 w-4" />
                  </FlipButton>

                  <p className="auth-oauth-note auth-form-enter">
                    Khi đăng ký bằng Google, hệ thống vẫn kiểm tra domain email, MX, IP và thiết bị để chặn email ảo/tool tự động.
                  </p>

                  <div className="auth-slider-links auth-form-enter">
                    <Link href="/" className="ghost-button">
                      <Home className="h-4 w-4" />
                      Xem trang chủ
                    </Link>
                    <a href={SUPPORT_URL} target="_blank" rel="noreferrer" className="ghost-button">
                      <ServerCog className="h-4 w-4" />
                      Hỗ trợ mở tài khoản
                    </a>
                  </div>
                </form>
              </div>
            </div>

            <div
              className="auth-slider-form-container auth-sign-in-container"
              data-auth-panel={tab === 'login' ? 'active' : 'inactive'}
            >
              <div className="auth-stage-card">
                <form className="auth-slider-form auth-login-form" onSubmit={handleLoginSubmit}>
                  <h1 className="auth-slider-title auth-form-enter">Đăng nhập</h1>
                  <p className="auth-slider-copy auth-form-enter">
                    Quản lý số dư, đơn hàng và toàn bộ dịch vụ trong một nơi.
                  </p>

                  {loginMessage ? (
                    <div
                      className={cn(
                        'auth-slider-message auth-form-enter',
                        loginMessageTone === 'success' && 'auth-slider-message-success',
                      )}
                    >
                      {loginMessageTone === 'success' ? (
                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                      ) : (
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      )}
                      <span>{loginMessage}</span>
                    </div>
                  ) : null}

                  <a href="/api/auth/google/start?mode=login" className="auth-google-button auth-form-enter">
                    <Chrome className="h-4 w-4" />
                    Đăng nhập với Google
                  </a>

                  <div className="auth-divider auth-form-enter">
                    <span>Hoặc đăng nhập bằng mật khẩu</span>
                  </div>

                  <input
                    name="identifier"
                    placeholder="Tên đăng nhập hoặc email"
                    className="input-shell auth-field auth-form-enter"
                    autoComplete="username"
                    required
                    value={loginForm.username}
                    onChange={(event) => setLoginForm((current) => ({ ...current, username: event.target.value }))}
                  />
                  <input
                    name="password"
                    type="password"
                    placeholder="Mật khẩu"
                    className="input-shell auth-field auth-form-enter"
                    autoComplete="current-password"
                    required
                    value={loginForm.password}
                    onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                  />

                  <div className="auth-login-options auth-form-enter">
                    <label className="auth-remember-row">
                      <input
                        type="checkbox"
                        checked={loginForm.remember}
                        onChange={(event) => setLoginForm((current) => ({ ...current, remember: event.target.checked }))}
                        className="h-4 w-4 rounded border-slate-300 bg-white text-brand-blue focus:ring-brand-blue dark:border-white/10 dark:bg-white/5"
                      />
                      <span>Giữ đăng nhập trên thiết bị này</span>
                    </label>
                    <Link href="/auth/forgot-password" className="auth-inline-link auth-forgot-link">
                      Quên mật khẩu?
                    </Link>
                  </div>

                  <FlipButton
                    type="submit"
                    size="lg"
                    disabled={loginLoading}
                    className="auth-form-enter w-full"
                    stageClassName="w-full min-w-0"
                  >
                    {loginLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                    <ArrowRight className="h-4 w-4" />
                  </FlipButton>

                </form>
              </div>
            </div>

            <div className="auth-overlay-container">
              <div className="auth-overlay">
                <div className="auth-overlay-panel auth-overlay-left">
                  <span className="auth-overlay-kicker">Đã có tài khoản</span>
                  <h2 className="auth-overlay-title">Quay lại khu điều khiển của anh</h2>
                  <p className="auth-overlay-copy">
                    Đăng nhập để xem số dư, lịch sử và toàn bộ dịch vụ đang sử dụng mà không phải thao tác lại từ đầu.
                  </p>
                  <div className="auth-overlay-metric-grid">
                    {loginHighlights.map((item) => (
                      <div key={item} className="auth-overlay-metric">
                        {item}
                      </div>
                    ))}
                  </div>
                  <FlipButton
                    type="button"
                    size="sm"
                    className="mt-1"
                    onClick={() => switchTab('login')}
                  >
                    Đăng nhập
                  </FlipButton>
                </div>

                <div className="auth-overlay-panel auth-overlay-right">
                  <span className="auth-overlay-kicker">Chưa có tài khoản</span>
                  <h2 className="auth-overlay-title">Khởi tạo tài khoản để bắt đầu ngay</h2>
                  <p className="auth-overlay-copy">
                    Tạo tài khoản mới để nạp tiền, dùng dịch vụ và theo dõi mọi luồng thao tác trong cùng một hệ thống.
                  </p>
                  <div className="auth-overlay-metric-grid">
                    {registerHighlights.map((item) => (
                      <div key={item} className="auth-overlay-metric">
                        {item}
                      </div>
                    ))}
                  </div>
                  <FlipButton
                    type="button"
                    size="sm"
                    className="mt-1"
                    onClick={() => switchTab('register')}
                  >
                    Tạo tài khoản
                  </FlipButton>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
