"use client";

import { useEffect, useState, useTransition } from "react";
import { ShoppingCart } from "lucide-react";
import { GlowCard } from "@vps/components/ui/glow-card";
import { NoticeModal } from "@vps/components/ui/notice-modal";
import { VpsCheckoutModal } from "@vps/components/vps/vps-checkout-modal";
import { VpsPolicyModal } from "@vps/components/vps/vps-policy-modal";
import { StorefrontPlanCard } from "@vps/components/vps/storefront-plan-card";
import { PortalAuthFallback, PortalShell } from "@vps/components/portal/portal-shell";
import { usePortalSnapshot } from "@vps/hooks/use-portal-snapshot";
import {
  createOrder,
  getStorefrontData,
  PURCHASE_MAINTENANCE_MESSAGE,
  redirectToDeposit,
  shouldShowMaintenanceNotice,
  shouldRedirectToDeposit,
} from "@vps/lib/api";
import { sortCatalogItemsForStorefront } from "@vps/lib/catalog";
import { storefrontFallback } from "@vps/lib/sample-data";
import { CatalogItem, StorefrontData } from "@vps/lib/types";
import { vpsPolicyHighlights } from "@vps/lib/vps-policy";

export function ServicesDashboardPage() {
  const { session, user, orders, refresh } = usePortalSnapshot();
  const currentUser = user ?? session?.user ?? null;
  const [storefront, setStorefront] = useState<StorefrontData | null>(null);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState("");
  const [isPending, startTransition] = useTransition();
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState("Thông báo");
  const [noticeMessage, setNoticeMessage] = useState("");
  const [noticeVariant, setNoticeVariant] = useState<"info" | "success" | "warning">("info");
  const [noticeHighlights, setNoticeHighlights] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      const data = await getStorefrontData();

      if (mounted) {
        setStorefront(data);
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (!currentUser || !session) {
    return <PortalAuthFallback />;
  }

  const currentStorefront = storefront ?? storefrontFallback;
  const catalogItems =
    loading && !storefront ? [] : sortCatalogItemsForStorefront(currentStorefront.items);

  function handleBuyNow(payload: {
    itemId: number;
    note?: string;
    quantity: number;
    customAddonCpu: number;
    customAddonRam: number;
    customAddonDisk: number;
  }) {
    const activeSession = session;

    if (!activeSession) {
      return;
    }

    startTransition(() => {
      void (async () => {
        try {
          await createOrder(activeSession.token, {
            catalogItemId: payload.itemId,
            quantity: payload.quantity,
            acceptedPolicy: true,
            note: payload.note,
            customAddonCpu: payload.customAddonCpu,
            customAddonRam: payload.customAddonRam,
            customAddonDisk: payload.customAddonDisk,
          });
          setSelectedItem(null);
          setFlash("");
          setNoticeTitle("Mua VPS thành công");
          setNoticeMessage(
            "Đơn hàng của bạn đã được tạo thành công. Vui lòng vào mục VPS đang sử dụng để xem trạng thái xử lý.",
          );
          setNoticeVariant("success");
          setNoticeHighlights([
            "IP, user, mật khẩu và trạng thái sẽ được đồng bộ trong trang quản lý VPS khi provision xong.",
            "Nếu vừa mua thêm nhiều gói, dashboard có thể cập nhật theo từng đợt trong vài phút đầu.",
          ]);
          setNoticeOpen(true);
          await refresh();
        } catch (error) {
          const nextMessage =
            error instanceof Error ? error.message : "Không thể tạo đơn hàng VPS.";

          if (shouldRedirectToDeposit(nextMessage)) {
            setFlash("");
            setNoticeTitle("Thông báo thanh toán");
            setNoticeMessage("Số dư không đủ. Hệ thống đang chuyển bạn sang trang nạp tiền...");
            setNoticeVariant("warning");
            setNoticeHighlights([
              "Sau khi nạp thêm số dư, anh có thể quay lại ngay và tiếp tục đăng ký gói VPS.",
            ]);
            setNoticeOpen(true);
            window.setTimeout(() => {
              redirectToDeposit();
            }, 900);
            return;
          }

          if (shouldShowMaintenanceNotice(nextMessage)) {
            setSelectedItem(null);
            setFlash("");
            setNoticeTitle("Hệ thống bảo trì");
            setNoticeMessage(PURCHASE_MAINTENANCE_MESSAGE);
            setNoticeVariant("warning");
            setNoticeHighlights([
              "Nếu cần kiểm tra thời điểm mở bán lại, anh có thể liên hệ hỗ trợ trực tiếp.",
            ]);
            setNoticeOpen(true);
            return;
          }

          setFlash(nextMessage);
          setNoticeTitle("Thông báo hệ thống");
          setNoticeMessage(nextMessage);
          setNoticeVariant("warning");
          setNoticeHighlights([]);
          setNoticeOpen(true);
        }
      })();
    });
  }

  return (
    <PortalShell
      user={currentUser}
      pageTitle="Gói dịch vụ VPS"
      breadcrumb="Gói dịch vụ VPS"
      pageDescription="Chọn gói VPS phù hợp với nhu cầu của bạn và thanh toán trực tiếp bằng số dư."
      notificationCount={orders?.summary.notifications ?? 0}
    >
      <div className="portal-section-intro">
        <span className="portal-section-line" />
        <h2 className="text-4xl font-semibold text-[var(--foreground)]">Máy chủ ảo cấu hình sẵn</h2>
        <p className="mt-3 text-lg text-[var(--muted)]">
          Chọn gói VPS phù hợp với nhu cầu của bạn và có thể cộng thêm CPU, RAM, disk ngay trong bước thanh toán
          {loading ? " - đang tải dữ liệu..." : ""}
        </p>
      </div>

      <GlowCard>
        <div className="portal-card">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
                Chính sách dịch vụ VPS
              </p>
              <h3 className="mt-3 font-[family-name:var(--font-space-grotesk)] text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                Vui lòng đọc <strong>Chính sách</strong> trước khi đăng ký dịch vụ
              </h3>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
                Trong bước xác nhận thanh toán, bạn bắt buộc phải tick đồng ý với{" "}
                <button
                  type="button"
                  onClick={() => setPolicyOpen(true)}
                  className="font-semibold text-[var(--foreground)] underline decoration-2 underline-offset-4"
                >
                  <strong>Chính sách</strong>
                </button>{" "}
                thì hệ thống mới cho phép tạo đơn VPS.
              </p>
            </div>

            <button type="button" onClick={() => setPolicyOpen(true)} className="ghost-button">
              Xem toàn bộ chính sách
            </button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {vpsPolicyHighlights.map((highlight) => (
              <div
                key={highlight}
                className="rounded-[24px] border border-white/8 bg-white/[0.03] px-4 py-4 text-sm leading-7 text-[var(--muted)]"
              >
                {highlight}
              </div>
            ))}
          </div>
        </div>
      </GlowCard>

      <section className="landing-plan-grid">
        {catalogItems.length ? (
          catalogItems.map((item) => (
            <GlowCard key={item.id} className="h-full">
              <StorefrontPlanCard
                item={item}
                onBuy={() => setSelectedItem(item)}
                buttonLabel="Đăng ký ngay"
                disabled={isPending}
                loading={isPending}
              />
            </GlowCard>
          ))
        ) : (
          <GlowCard className="xl:col-span-3">
            <div className="portal-card">
              <div className="portal-empty-card">
                <ShoppingCart className="h-10 w-10 text-[var(--brand-solid)]" />
                <p className="mt-4 text-lg font-semibold text-[var(--foreground)]">
                  Chưa có gói VPS nào đang mở bán
                </p>
                <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                  Hãy đồng bộ danh mục VPS và bật các gói muốn bán để chúng xuất hiện tại đây.
                </p>
              </div>
            </div>
          </GlowCard>
        )}
      </section>

      <VpsCheckoutModal
        key={selectedItem?.id ?? "services-checkout"}
        item={selectedItem}
        settings={currentStorefront.settings}
        open={Boolean(selectedItem)}
        loading={isPending}
        onClose={() => setSelectedItem(null)}
        onOpenPolicy={() => setPolicyOpen(true)}
        onConfirm={({ note, quantity, customAddonCpu, customAddonRam, customAddonDisk }) => {
          if (!selectedItem) {
            return;
          }

          handleBuyNow({
            itemId: selectedItem.id,
            note,
            quantity,
            customAddonCpu,
            customAddonRam,
            customAddonDisk,
          });
        }}
      />

      <VpsPolicyModal open={policyOpen} onClose={() => setPolicyOpen(false)} />
      <NoticeModal
        open={noticeOpen}
        title={noticeTitle}
        message={noticeMessage || flash}
        variant={noticeVariant}
        highlights={noticeHighlights}
        supportLink={
          noticeTitle === "Hệ thống bảo trì"
            ? currentStorefront.settings.support_link
            : undefined
        }
        onClose={() => {
          setNoticeOpen(false);
          setFlash("");
          setNoticeVariant("info");
          setNoticeHighlights([]);
        }}
      />
    </PortalShell>
  );
}

export default ServicesDashboardPage;
