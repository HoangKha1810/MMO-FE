"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import clsx from "clsx";
import { ThemeToggleButton } from "@vps/components/ui/theme-toggle";
import { getStoredSession, subscribeSession } from "@vps/lib/api";
import { siteConfig } from "@vps/lib/site";

export function SiteHeader({
  brandName = "TRUNGTAMMMO.VN",
  supportLink,
}: {
  brandName?: string;
  supportLink?: string;
}) {
  const pathname = usePathname();
  const session = useSyncExternalStore(
    subscribeSession,
    getStoredSession,
    () => null,
  );
  const navItems = session
    ? [
        { href: "/vps", label: "Trang chủ" },
        { href: "/vps/gioi-thieu", label: "Giới thiệu" },
        { href: "/vps/dashboard", label: "Bảng điều khiển" },
      ]
    : [
        { href: "/vps", label: "Trang chủ" },
        { href: "/vps/gioi-thieu", label: "Giới thiệu" },
        { href: "/vps/auth", label: "Tài khoản" },
        { href: "/vps/dashboard", label: "Bảng điều khiển" },
      ];

  const resolvedSupportLink =
    supportLink &&
    supportLink.trim() &&
    !/t\.me\/your_support|telegram/i.test(supportLink.trim())
      ? supportLink
      : siteConfig.supportUrl;

  return (
    <header className="sticky top-0 z-50 px-3 pt-3 md:px-5 md:pt-4 xl:px-6">
      <div className="site-header-panel flex w-full flex-col gap-3 rounded-[28px] border border-white/10 bg-[color:color-mix(in_oklab,var(--background)_76%,transparent)] px-3 py-3 shadow-[0_24px_60px_rgba(2,8,23,0.18)] backdrop-blur-2xl xl:flex-row xl:items-center xl:justify-between xl:gap-4 xl:px-4">
        <div className="flex min-w-0 items-center justify-between gap-3 xl:flex-1">
          <Link href="/vps" className="flex min-w-0 shrink items-center gap-3 sm:gap-4">
            <div className="brand-logo-gif-shell overflow-hidden rounded-2xl border border-white/10 bg-[var(--background)] px-3 py-2 shadow-[0_16px_36px_rgba(15,23,42,0.08)] backdrop-blur">
              <Image
                src={siteConfig.splashLogoPath}
                alt={brandName}
                width={700}
                height={203}
                unoptimized
                loading="eager"
                className="brand-logo-gif h-9 w-auto object-contain sm:h-11 md:h-12"
              />
            </div>
            <div className="min-w-0">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.34em] text-[var(--muted)]">
                Hệ thống VPS tự động
              </p>
              <p className="mt-1 truncate text-base font-semibold text-[var(--foreground)] sm:text-lg lg:text-xl">
                {brandName}
              </p>
            </div>
          </Link>
        </div>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-end">
          <nav className="flex min-w-0 items-center gap-2 overflow-x-auto rounded-full border border-white/10 bg-white/5 p-1 [scrollbar-width:none] xl:max-w-none">
            {navItems.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold transition-all duration-300",
                    isActive
                      ? "bg-white text-slate-950 shadow-[0_10px_30px_rgba(255,255,255,0.28)]"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {session ? (
            <div className="grid grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)] items-center gap-2 sm:gap-3 xl:flex xl:flex-wrap xl:items-center xl:justify-end">
              {resolvedSupportLink ? (
                <a
                  href={resolvedSupportLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0066ff,#4f7cf3_60%,#7aa0ff)] px-4 text-sm font-semibold text-white shadow-[0_18px_44px_rgba(0,102,255,0.22)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_52px_rgba(0,102,255,0.28)] sm:h-12 sm:px-5 xl:h-11"
                >
                  Hỗ trợ
                </a>
              ) : null}

              <ThemeToggleButton className="justify-self-center sm:h-12 sm:w-12 xl:h-11 xl:w-11" />

              <Link
                href="/vps/dashboard"
                className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-[color:color-mix(in_oklab,var(--background)_68%,white_10%)] px-4 text-sm font-semibold text-[var(--foreground)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#0066ff]/30 hover:text-white sm:h-12 sm:px-5 xl:h-11"
              >
                Vào bảng điều khiển
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:gap-3 xl:flex-row xl:flex-wrap xl:items-center xl:justify-end">
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_3rem] items-center gap-2 sm:gap-3 xl:flex xl:items-center">
                <Link
                  href="/vps/auth"
                  className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 text-sm font-semibold text-[var(--foreground)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/10 sm:h-12 sm:px-5 xl:h-11"
                >
                  Đăng nhập
                </Link>

                {resolvedSupportLink ? (
                  <a
                    href={resolvedSupportLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0066ff,#4f7cf3_60%,#7aa0ff)] px-4 text-sm font-semibold text-white shadow-[0_18px_44px_rgba(0,102,255,0.22)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_52px_rgba(0,102,255,0.28)] sm:h-12 sm:px-5 xl:h-11"
                  >
                    Hỗ trợ
                  </a>
                ) : (
                  <div />
                )}

                <ThemeToggleButton className="justify-self-center sm:h-12 sm:w-12 xl:h-11 xl:w-11" />
              </div>

              <Link
                href="/vps/auth"
                className="inline-flex h-11 w-full items-center justify-center rounded-full border border-white/10 bg-[color:color-mix(in_oklab,var(--background)_68%,white_10%)] px-4 text-sm font-semibold text-[var(--foreground)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#0066ff]/30 hover:text-white sm:h-12 sm:px-5 xl:h-11 xl:w-auto"
              >
                Tạo tài khoản
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
