"use client";

import Link from "next/link";
import { Bell, CircleCheckBig, ShieldCheck, WalletCards } from "lucide-react";
import { PortalShell, PortalAuthFallback, UserAvatar } from "@vps/components/portal/portal-shell";
import { AutoFitText } from "@vps/components/ui/auto-fit-text";
import { GlowCard } from "@vps/components/ui/glow-card";
import { NoticeModal } from "@vps/components/ui/notice-modal";
import { usePortalSnapshot } from "@vps/hooks/use-portal-snapshot";
import { formatCurrency } from "@vps/lib/api";
import { normalizeRank } from "@vps/lib/portal";
import { siteConfig } from "@vps/lib/site";

export default function DashboardPage() {
  const { session, user, orders, loading, message, setMessage } = usePortalSnapshot();
  const currentUser = user ?? session?.user ?? null;
  const summary = orders?.summary;

  if (!currentUser) {
    return <PortalAuthFallback />;
  }

  return (
    <PortalShell
      user={currentUser}
      pageTitle="Trang chủ"
      breadcrumb="Trang chủ"
      pageDescription="Quản lý tài khoản, theo dõi số dư và xem nhanh các VPS đang hoạt động."
      notificationCount={summary?.notifications ?? 0}
    >
      <GlowCard>
        <div className="portal-hero-banner">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="portal-hero-avatar">
                <UserAvatar user={currentUser} className="h-full w-full object-cover" />
              </div>

              <div className="min-w-0">
                <AutoFitText
                  className="font-semibold leading-tight text-white"
                  maxFontSize={44}
                  minFontSize={22}
                >
                  Chào mừng trở lại, {currentUser.fullname || currentUser.username}!
                </AutoFitText>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-white/82 md:text-base">
                  Theo dõi dịch vụ đang chạy, số dư hiện có và toàn bộ thông tin tài khoản
                  của bạn trong một giao diện gọn như portal quản lý VPS.
                </p>
              </div>
            </div>

            <div className="grid w-full gap-4 sm:grid-cols-3 xl:max-w-[34rem] xl:flex-none">
              <div className="portal-hero-stat">
                <p className="portal-hero-stat-label">Số dư</p>
                <div className="portal-hero-stat-value">
                  <AutoFitText maxFontSize={30} minFontSize={14}>
                    {formatCurrency(currentUser.balance)}
                  </AutoFitText>
                </div>
              </div>
              <div className="portal-hero-stat">
                <p className="portal-hero-stat-label">Dịch vụ</p>
                <div className="portal-hero-stat-value">
                  <AutoFitText maxFontSize={30} minFontSize={14}>
                    {summary?.active_instances ?? orders?.instances.length ?? 0}
                  </AutoFitText>
                </div>
              </div>
              <div className="portal-hero-stat">
                <p className="portal-hero-stat-label">Đơn hàng</p>
                <div className="portal-hero-stat-value">
                  <AutoFitText maxFontSize={30} minFontSize={14}>
                    {summary?.total_orders ?? 0}
                  </AutoFitText>
                </div>
              </div>
            </div>
          </div>
        </div>
      </GlowCard>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr_0.92fr]">
        <GlowCard>
          <div className="portal-card">
            <div className="portal-card-heading">
              <span className="portal-card-icon">
                <CircleCheckBig className="h-4 w-4" />
              </span>
              <div>
                <h3 className="portal-card-title">Tài khoản</h3>
                <p className="portal-card-subtitle">Thông tin tài khoản và trạng thái bảo mật</p>
              </div>
            </div>

            <div className="portal-account-list">
              <div className="portal-account-row">
                <span className="portal-account-label">Họ và tên</span>
                <div className="portal-account-value">
                  <AutoFitText
                    className="font-semibold"
                    maxFontSize={17}
                    minFontSize={10}
                  >
                    {currentUser.fullname || currentUser.username}
                  </AutoFitText>
                </div>
              </div>
              <div className="portal-account-row">
                <span className="portal-account-label">Email</span>
                <div className="portal-account-value">
                  <AutoFitText
                    className="font-semibold"
                    maxFontSize={17}
                    minFontSize={10}
                  >
                    {String(currentUser.email ?? "").toLowerCase()}
                  </AutoFitText>
                </div>
              </div>
              <div className="portal-account-row">
                <span className="portal-account-label">Nhóm khách hàng</span>
                <div className="portal-account-value">
                  <AutoFitText
                    className="font-semibold"
                    maxFontSize={17}
                    minFontSize={10}
                  >
                    {normalizeRank(currentUser.rank)}
                  </AutoFitText>
                </div>
              </div>
            </div>
          </div>
        </GlowCard>

        <GlowCard>
          <div className="portal-card">
            <div className="portal-card-heading">
              <span className="portal-card-icon">
                <WalletCards className="h-4 w-4" />
              </span>
              <div>
                <h3 className="portal-card-title">Thống kê</h3>
                <p className="portal-card-subtitle">Tổng quan thanh toán và dịch vụ của bạn</p>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="portal-stat-card">
                <span className="portal-stat-dot portal-stat-dot-negative" />
                <div className="min-w-0">
                  <p className="portal-info-label">Tổng tiền đã chi</p>
                  <div className="portal-stat-number">
                    <AutoFitText maxFontSize={24} minFontSize={12}>
                      {formatCurrency(summary?.total_spent ?? 0)}
                    </AutoFitText>
                  </div>
                </div>
              </div>

              <div className="portal-stat-card">
                <span className="portal-stat-dot portal-stat-dot-positive" />
                <div className="min-w-0">
                  <p className="portal-info-label">Tổng tiền đã nạp</p>
                  <div className="portal-stat-number">
                    <AutoFitText maxFontSize={24} minFontSize={12}>
                      {formatCurrency(summary?.total_deposited ?? 0)}
                    </AutoFitText>
                  </div>
                </div>
              </div>

              <div className="portal-stat-card">
                <span className="portal-stat-dot portal-stat-dot-neutral" />
                <div className="min-w-0">
                  <p className="portal-info-label">VPS đang hoạt động</p>
                  <div className="portal-stat-number">
                    <AutoFitText maxFontSize={24} minFontSize={12}>
                      {summary?.active_instances ?? orders?.instances.length ?? 0}
                    </AutoFitText>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </GlowCard>

        <GlowCard>
          <div className="portal-card">
            <div className="portal-card-heading">
              <span className="portal-card-icon">
                <Bell className="h-4 w-4" />
              </span>
              <div>
                <h3 className="portal-card-title">Thông báo</h3>
                <p className="portal-card-subtitle">Các cập nhật sẽ xuất hiện tại đây</p>
              </div>
            </div>

            <div className="portal-empty-card">
              <ShieldCheck className="h-10 w-10 text-[var(--brand-solid)]" />
              <p className="mt-4 text-lg font-semibold text-[var(--foreground)]">
                {loading ? "Đang đồng bộ dữ liệu..." : "Không có thông báo mới"}
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                Khi có thay đổi về đơn hàng, gia hạn hoặc trạng thái VPS, hệ thống sẽ hiển thị
                ngay tại khu vực này.
              </p>
            </div>

            <div className="mt-6 grid gap-3">
              <Link href="/vps/dashboard/services" className="action-button w-full">
                Mua thêm Cloud VPS
              </Link>
              <a href={siteConfig.depositUrl} className="ghost-button w-full">
                Nạp thêm số dư
              </a>
              <Link href="/vps/dashboard/vps" className="ghost-button w-full">
                Xem VPS đang sử dụng
              </Link>
            </div>
          </div>
        </GlowCard>
      </section>

      <NoticeModal
        open={Boolean(message)}
        title="Thông báo hệ thống"
        message={message || ""}
        onClose={() => {
          setMessage("");
        }}
      />
    </PortalShell>
  );
}
