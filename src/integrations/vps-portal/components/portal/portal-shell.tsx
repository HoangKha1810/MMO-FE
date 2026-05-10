"use client";

import type { ComponentType, ReactNode } from "react";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  CreditCard,
  House,
  LogOut,
  ReceiptText,
  ServerCog,
  WalletCards,
} from "lucide-react";
import { ThemeToggle } from "@vps/components/ui/theme-toggle";
import { clearSession, formatCurrency } from "@vps/lib/api";
import { getUserInitial } from "@vps/lib/portal";
import { siteConfig } from "@vps/lib/site";
import { User } from "@vps/lib/types";

type PortalShellProps = {
  user: User;
  pageTitle: string;
  breadcrumb?: string;
  pageDescription?: string;
  notificationCount?: number;
  children: ReactNode;
};

type PortalNavItem = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  external?: boolean;
  children?: Array<{
    label: string;
    href: string;
  }>;
};

const portalNavigation: PortalNavItem[] = [
  {
    label: "Trang chủ",
    href: "/vps/dashboard",
    icon: House,
  },
  {
    label: "Đăng ký dịch vụ",
    href: "/vps/dashboard/services",
    icon: CreditCard,
    children: [
      {
        label: "Cloud VPS",
        href: "/vps/dashboard/services",
      },
    ],
  },
  {
    label: "Quản lý dịch vụ",
    href: "/vps/dashboard/vps",
    icon: ServerCog,
    children: [
      {
        label: "VPS đang sử dụng",
        href: "/vps/dashboard/vps",
      },
    ],
  },
  {
    label: "Danh sách đơn hàng",
    href: "/vps/dashboard/orders",
    icon: ReceiptText,
  },
  {
    label: "Nạp tiền",
    href: siteConfig.depositUrl,
    icon: WalletCards,
    external: true,
  },
  {
    label: "Lịch sử thanh toán",
    href: "/vps/dashboard/payments",
    icon: ReceiptText,
  },
];

function isItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function UserAvatar({
  user,
  className,
}: {
  user: User;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const displayName = user.fullname || user.username;
  const avatarSrc = user.avatar;

  if (!avatarSrc || failedSrc === avatarSrc) {
    return (
      <span className={clsx("flex h-full w-full items-center justify-center", className)}>
        {getUserInitial(displayName)}
      </span>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      key={avatarSrc}
      src={avatarSrc}
      alt={displayName}
      className={className}
      onError={() => setFailedSrc(avatarSrc)}
    />
  );
}

export function PortalShell({
  user,
  pageTitle,
  breadcrumb,
  pageDescription,
  notificationCount = 0,
  children,
}: PortalShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="portal-shell">
      <aside className="portal-sidebar">
        <div className="portal-sidebar-inner">
          <Link href="/vps" className="portal-brand-card">
            <Image
              src={siteConfig.splashLogoPath}
              alt={siteConfig.name}
              width={700}
              height={203}
              unoptimized
              loading="eager"
              className="h-12 w-auto object-contain md:h-16"
            />
          </Link>

          <nav className="grid gap-3 sm:grid-cols-2 xl:block xl:space-y-3">
            {portalNavigation.map((item) => {
              const isActive =
                isItemActive(pathname, item.href) ||
                Boolean(item.children?.some((child) => isItemActive(pathname, child.href)));

              const Icon = item.icon;

              return (
                <div
                  key={item.label}
                  className={clsx("portal-nav-group", isActive && "portal-nav-group-active")}
                >
                  {item.external ? (
                    <a
                      href={item.href}
                      className={clsx("portal-nav-link", isActive && "portal-nav-link-active")}
                    >
                      <span className="portal-nav-icon">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span>{item.label}</span>
                    </a>
                  ) : (
                    <Link
                      href={item.href}
                      className={clsx("portal-nav-link", isActive && "portal-nav-link-active")}
                    >
                      <span className="portal-nav-icon">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span>{item.label}</span>
                      {item.children ? (
                        <ChevronDown
                          className={clsx(
                            "ml-auto h-4 w-4 transition-transform duration-300",
                            isActive && "rotate-180",
                          )}
                        />
                      ) : null}
                    </Link>
                  )}

                  {item.children && isActive ? (
                    <div className="portal-subnav">
                      {item.children.map((child) => {
                        const isChildActive = isItemActive(pathname, child.href);

                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={clsx(
                              "portal-subnav-link",
                              isChildActive && "portal-subnav-link-active",
                            )}
                          >
                            <span className="h-2.5 w-2.5 rounded-full bg-[#356dff]" />
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>

          <div className="portal-sidebar-footer">
            <button
              type="button"
              className="ghost-button w-full"
              onClick={() => {
                clearSession();
                router.push("/vps/auth");
              }}
            >
              <LogOut className="h-4 w-4" />
              Đăng xuất
            </button>
          </div>
        </div>
      </aside>

      <div className="portal-main">
        <header className="portal-topbar">
          <div className="min-w-0 flex-1">
            <p className="portal-kicker">Cổng người dùng</p>
            <h2 className="portal-topbar-title">{pageTitle}</h2>
          </div>

          <div className="portal-topbar-actions">
            <ThemeToggle />
            <button type="button" className="portal-icon-button" aria-label="Thông báo">
              <Bell className="h-4 w-4" />
              {notificationCount > 0 ? (
                <span className="portal-notification-badge">{notificationCount}</span>
              ) : null}
            </button>

            <div className="portal-balance-pill">
              <div className="text-right">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
                  Số dư
                </p>
                <p className="mt-1 text-base font-semibold text-[var(--foreground)]">
                  {formatCurrency(user.balance)}
                </p>
              </div>

              <div className="portal-avatar">
                <UserAvatar user={user} className="h-full w-full object-cover" />
              </div>
            </div>
          </div>
        </header>

        <main className="portal-content">
          <div className="portal-page-heading">
            <div>
              <h1 className="portal-page-title">{pageTitle}</h1>
              {pageDescription ? (
                <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                  {pageDescription}
                </p>
              ) : null}
            </div>

            <div className="portal-breadcrumb">
              <House className="h-4 w-4" />
              <ChevronRight className="h-4 w-4 text-[var(--muted)]" />
              <span>{breadcrumb ?? pageTitle}</span>
            </div>
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}

export function PortalAuthFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="portal-auth-card">
        <p className="portal-kicker">Phiên đăng nhập</p>
        <h1 className="mt-4 text-3xl font-semibold text-[var(--foreground)]">
          Bạn cần đăng nhập để vào khu quản lý VPS
        </h1>
        <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
          Hãy đăng nhập lại để xem VPS đang sử dụng, lịch sử thanh toán và tiếp tục mua
          dịch vụ.
        </p>
        <Link href="/vps/auth" className="action-button mt-6">
          Đi tới trang đăng nhập
        </Link>
      </div>
    </div>
  );
}
