"use client";

import {
  FormEvent,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  DatabaseZap,
  LayoutDashboard,
  ServerCog,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { SiteHeader } from "@vps/components/layout/site-header";
import {
  DEPOSIT_URL,
  getStoredSession,
  login,
  register,
  saveSession,
  subscribeSession,
} from "@vps/lib/api";
import { animate, remove, shouldReducePortalMotion, stagger } from "@vps/lib/motion";
import { siteConfig } from "@vps/lib/site";

const authSignals = [
  { icon: DatabaseZap, label: "Đọc bảng users" },
  { icon: WalletCards, label: "Thanh toán số dư" },
  { icon: LayoutDashboard, label: "Portal tập trung" },
];

const overlayHighlights = [
  "Hỗ trợ light / dark theme đồng bộ với toàn website.",
  "Vào thẳng dashboard để mua VPS và quản lý trạng thái.",
];

export default function AuthPage() {
  const router = useRouter();
  const session = useSyncExternalStore(
    subscribeSession,
    getStoredSession,
    () => null,
  );
  const [tab, setTab] = useState<"login" | "register">("login");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const submitLockRef = useRef(false);

  useEffect(() => {
    if (session) {
      router.replace(session.user.role === "admin" ? "/admin" : "/vps/dashboard");
    }
  }, [router, session]);

  useEffect(() => {
    if (session) {
      return;
    }

    if (shouldReducePortalMotion()) {
      return;
    }

    animate(".auth-orb", {
      translateY: [0, -24],
      translateX: [0, 14],
      scale: [1, 1.08],
      opacity: [0.34, 0.82],
      duration: 4300,
      ease: "inOutSine",
      alternate: true,
      loop: true,
      delay: stagger(180),
    });

    animate(".auth-slider-shell", {
      translateY: [36, 0],
      opacity: [0, 1],
      scale: [0.985, 1],
      duration: 950,
      ease: "outExpo",
    });

    animate(".auth-stage-card, .auth-overlay-panel", {
      translateY: [28, 0],
      opacity: [0, 1],
      duration: 900,
      ease: "outExpo",
      delay: stagger(110),
    });

    return () => {
      remove(".auth-orb");
      remove(".auth-slider-shell");
      remove(".auth-stage-card");
      remove(".auth-overlay-panel");
      remove(".auth-form-enter");
    };
  }, [session]);

  useEffect(() => {
    if (session) {
      return;
    }

    if (shouldReducePortalMotion()) {
      return;
    }

    remove(".auth-form-enter");
    animate(".auth-form-enter", {
      translateY: [14, 0],
      opacity: [0, 1],
      scale: [0.985, 1],
      duration: 500,
      ease: "outQuad",
      delay: stagger(60),
    });
  }, [session, tab]);

  function switchTab(nextTab: "login" | "register") {
    if (submitLockRef.current) {
      return;
    }

    setTab(nextTab);
    setMessage("");
  }

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLockRef.current) {
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);
    setMessage("");

    startTransition(async () => {
      try {
        const result = await login(
          String(form.get("identifier") ?? ""),
          String(form.get("password") ?? ""),
        );
        saveSession({ token: result.token, user: result.user });
        router.push(result.user.role === "admin" ? "/admin" : "/vps/dashboard");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Đăng nhập thất bại.");
      } finally {
        submitLockRef.current = false;
        setIsSubmitting(false);
      }
    });
  }

  async function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLockRef.current) {
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    const form = new FormData(event.currentTarget);
    setMessage("");

    startTransition(async () => {
      try {
        const result = await register({
          username: String(form.get("username") ?? ""),
          email: String(form.get("email") ?? ""),
          fullname: String(form.get("fullname") ?? ""),
          password: String(form.get("password") ?? ""),
          confirmPassword: String(form.get("confirmPassword") ?? ""),
        });
        saveSession({ token: result.token, user: result.user });
        router.push("/vps/dashboard");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Đăng ký thất bại.");
      } finally {
        submitLockRef.current = false;
        setIsSubmitting(false);
      }
    });
  }

  if (session) {
    return null;
  }

  const isRegister = tab === "register";
  const authBusy = isPending || isSubmitting;

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main className="section-shell auth-page-shell py-6 md:py-8 xl:py-10">
        <div className={`auth-slider-shell ${isRegister ? "right-panel-active" : ""}`}>
          <div className="auth-orb auth-orb-a" />
          <div className="auth-orb auth-orb-b" />
          <div className="auth-orb auth-orb-c" />

          <div className="auth-mobile-switch">
            <button
              type="button"
              onClick={() => switchTab("login")}
              className={tab === "login" ? "is-active" : ""}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => switchTab("register")}
              className={tab === "register" ? "is-active" : ""}
            >
              Đăng ký
            </button>
          </div>

          <div className="auth-slider-form-container auth-sign-up-container">
            <div className="auth-stage-card">
              <form className="auth-slider-form" onSubmit={handleRegisterSubmit}>
                <span className="auth-slider-kicker auth-form-enter">
                  <Sparkles className="h-3.5 w-3.5" />
                  Mở tài khoản VPS mới
                </span>
                <h1 className="auth-slider-title auth-form-enter">Tạo tài khoản</h1>
                <p className="auth-slider-copy auth-form-enter">
                  Đăng ký một lần để nạp số dư, đặt VPS và theo dõi dịch vụ trong dashboard.
                </p>

                <div className="auth-signal-row auth-form-enter">
                  {authSignals.map((item) => (
                    <span key={item.label} className="auth-signal-chip" title={item.label}>
                      <item.icon className="h-4 w-4" />
                      <span className="sr-only">{item.label}</span>
                    </span>
                  ))}
                </div>

                {isRegister && message ? (
                  <div className="auth-slider-message auth-form-enter">{message}</div>
                ) : null}

                <input
                  name="fullname"
                  placeholder="Họ và tên"
                  className="input-shell auth-field auth-form-enter"
                  autoComplete="name"
                  required
                />

                <div className="auth-form-grid auth-form-enter">
                  <input
                    name="username"
                    placeholder="Tên đăng nhập"
                    className="input-shell auth-field"
                    autoComplete="username"
                    required
                  />
                  <input
                    name="email"
                    type="email"
                    placeholder="Email"
                    className="input-shell auth-field"
                    autoComplete="email"
                    required
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
                  />
                  <input
                    name="confirmPassword"
                    type="password"
                    placeholder="Nhập lại mật khẩu"
                    className="input-shell auth-field"
                    autoComplete="new-password"
                    required
                  />
                </div>

                <div className="auth-slider-note auth-form-enter">
                  <ShieldCheck className="h-4 w-4" />
                  <span>
                    Nếu tài khoản chưa có, hệ thống sẽ tạo mới và đăng nhập ngay sau khi đăng ký.
                  </span>
                </div>

                <button
                  type="submit"
                  className="auth-slider-submit auth-form-enter"
                  disabled={authBusy}
                  aria-busy={authBusy}
                >
                  {authBusy ? "Đang tạo tài khoản..." : "Tạo tài khoản VPS"}
                  <ArrowRight className="h-4 w-4" />
                </button>

                <div className="auth-slider-links auth-form-enter">
                  <a href={DEPOSIT_URL} className="ghost-button">
                    <WalletCards className="h-4 w-4" />
                    Nạp số dư
                  </a>
                  <a href={siteConfig.supportUrl} target="_blank" rel="noreferrer" className="ghost-button">
                    <ServerCog className="h-4 w-4" />
                    Hỗ trợ mở tài khoản
                  </a>
                </div>
              </form>
            </div>
          </div>

          <div className="auth-slider-form-container auth-sign-in-container">
            <div className="auth-stage-card">
              <form className="auth-slider-form" onSubmit={handleLoginSubmit}>
                <span className="auth-slider-kicker auth-form-enter">
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  Cổng đăng nhập dashboard
                </span>
                <h1 className="auth-slider-title auth-form-enter">
                  Đăng nhập vào dashboard VPS
                </h1>
                <p className="auth-slider-copy auth-form-enter">
                  Quản lý số dư, đơn hàng và trạng thái VPS trong một nơi.
                </p>

                <div className="auth-signal-row auth-form-enter">
                  {authSignals.map((item) => (
                    <span key={item.label} className="auth-signal-chip" title={item.label}>
                      <item.icon className="h-4 w-4" />
                      <span className="sr-only">{item.label}</span>
                    </span>
                  ))}
                </div>

                {tab === "login" && message ? (
                  <div className="auth-slider-message auth-form-enter">{message}</div>
                ) : null}

                <input
                  name="identifier"
                  placeholder="Tên đăng nhập hoặc email"
                  className="input-shell auth-field auth-form-enter"
                  autoComplete="username"
                  required
                />
                <input
                  name="password"
                  type="password"
                  placeholder="Mật khẩu"
                  className="input-shell auth-field auth-form-enter"
                  autoComplete="current-password"
                  required
                />

                <div className="auth-slider-note auth-form-enter auth-slider-note-soft">
                  <DatabaseZap className="h-4 w-4" />
                  <span>
                    Admin vào trang quản trị, user vào portal VPS để tiếp tục sử dụng dịch vụ.
                  </span>
                </div>

                <button
                  type="submit"
                  className="auth-slider-submit auth-form-enter"
                  disabled={authBusy}
                  aria-busy={authBusy}
                >
                  {authBusy ? "Đang đăng nhập..." : "Vào bảng điều khiển"}
                  <ArrowRight className="h-4 w-4" />
                </button>

                <div className="auth-slider-links auth-form-enter">
                  <a href={DEPOSIT_URL} className="ghost-button">
                    <WalletCards className="h-4 w-4" />
                    Nạp số dư
                  </a>
                  <a href={siteConfig.supportUrl} target="_blank" rel="noreferrer" className="auth-inline-link">
                    Cần hỗ trợ đăng nhập?
                  </a>
                </div>
              </form>
            </div>
          </div>

          <div className="auth-overlay-container">
            <div className="auth-overlay">
              <div className="auth-overlay-panel auth-overlay-left">
                <span className="auth-overlay-kicker">Đã có tài khoản</span>
                <h2 className="auth-overlay-title">Quay lại dashboard VPS của anh</h2>
                <p className="auth-overlay-copy">
                  Đăng nhập để xem đơn, số dư và trạng thái VPS trong một dashboard rõ ràng.
                </p>
                <div className="auth-overlay-metric-grid">
                  {overlayHighlights.map((item) => (
                    <div key={item} className="auth-overlay-metric">
                      {item}
                    </div>
                  ))}
                </div>
                <button type="button" className="auth-overlay-button" onClick={() => switchTab("login")}>
                  Đăng nhập
                </button>
              </div>

              <div className="auth-overlay-panel auth-overlay-right">
                <span className="auth-overlay-kicker">Chưa có tài khoản</span>
                <h2 className="auth-overlay-title">Khởi tạo tài khoản để bắt đầu mua VPS</h2>
                <p className="auth-overlay-copy">
                  Mở tài khoản mới để nạp số dư, chọn gói và bắt đầu dùng VPS nhanh hơn.
                </p>
                <div className="auth-overlay-metric-grid">
                  <div className="auth-overlay-metric">Đăng ký xong có thể vào hệ thống ngay.</div>
                  <div className="auth-overlay-metric">Hợp cho MMO, website, tool và automation bot.</div>
                </div>
                <button type="button" className="auth-overlay-button" onClick={() => switchTab("register")}>
                  Tạo tài khoản
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
