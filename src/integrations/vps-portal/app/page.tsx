"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  ServerCog,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { SiteHeader } from "@vps/components/layout/site-header";
import { GlowCard } from "@vps/components/ui/glow-card";
import { NoticeModal } from "@vps/components/ui/notice-modal";
import { VpsCheckoutModal } from "@vps/components/vps/vps-checkout-modal";
import { VpsPolicyModal } from "@vps/components/vps/vps-policy-modal";
import { StorefrontPlanCard } from "@vps/components/vps/storefront-plan-card";
import {
  createOrder,
  DEPOSIT_URL,
  getPortalSnapshot,
  getStorefrontData,
  getStoredSession,
  PURCHASE_MAINTENANCE_MESSAGE,
  redirectToDeposit,
  shouldShowMaintenanceNotice,
  shouldRedirectToDeposit,
  subscribeSession,
} from "@vps/lib/api";
import { CatalogItem, StorefrontData } from "@vps/lib/types";
import { storefrontFallback } from "@vps/lib/sample-data";
import { siteConfig } from "@vps/lib/site";
import { sortCatalogItemsForStorefront } from "@vps/lib/catalog";
import { vpsPolicyHighlights } from "@vps/lib/vps-policy";

const faqItems = [
  {
    question: "Làm sao để mua VPS trên hệ thống?",
    answer:
      "Bạn chỉ cần đăng nhập, chọn gói phù hợp, thanh toán bằng số dư hiện có và hệ thống sẽ tạo đơn VPS ngay. Nếu thiếu số dư, website sẽ chuyển bạn đến trang nạp tiền.",
  },
  {
    question: "Sau khi mua tôi nhận thông tin VPS ở đâu?",
    answer:
      "Toàn bộ IP, tài khoản, mật khẩu và trạng thái dịch vụ sẽ hiển thị trong khu quản lý VPS của tài khoản ngay sau khi đơn hàng được xử lý thành công.",
  },
  {
    question: "Tôi có thể tự quản lý vòng đời VPS không?",
    answer:
      "Có. Hệ thống được thiết kế để theo dõi kỳ hạn, xem trạng thái và làm nền cho các thao tác như tự gia hạn hoặc quản lý lại dịch vụ theo cấu hình từ backend.",
  },
] as const;

const heroFlowSteps = [
  {
    icon: WalletCards,
    title: "Trừ số dư và tạo đơn",
    description: "Flow thanh toán gọn, kiểm tra số dư và chuyển thẳng sang xử lý đơn VPS.",
  },
  {
    icon: ServerCog,
    title: "Provision theo cấu hình",
    description: "Hệ thống đẩy yêu cầu OS, CPU, RAM và disk sang cụm hạ tầng đang mở bán.",
  },
  {
    icon: CheckCircle2,
    title: "Đồng bộ về dashboard",
    description: "IP, user, mật khẩu cùng trạng thái sẽ hiển thị lại trong khu quản lý tập trung.",
  },
] as const;

export default function Home() {
  const router = useRouter();
  const session = useSyncExternalStore(
    subscribeSession,
    getStoredSession,
    () => null,
  );
  const [storefront, setStorefront] = useState<StorefrontData | null>(null);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState("");
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState("Thông báo");
  const [noticeMessage, setNoticeMessage] = useState("");
  const [noticeVariant, setNoticeVariant] = useState<"info" | "success" | "warning">("info");
  const [noticeHighlights, setNoticeHighlights] = useState<string[]>([]);
  const [viewerSummary, setViewerSummary] = useState<{
    total_orders: number;
    active_instances: number;
  } | null>(null);
  const [viewerSummaryLoading, setViewerSummaryLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
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

  useEffect(() => {
    let cancelled = false;

    if (!session) {
      setViewerSummary(null);
      setViewerSummaryLoading(false);
      return;
    }

    setViewerSummaryLoading(true);

    void (async () => {
      try {
        const snapshot = await getPortalSnapshot(session.token);

        if (!cancelled) {
          setViewerSummary({
            total_orders: snapshot.orders.summary.total_orders,
            active_instances: snapshot.orders.summary.active_instances,
          });
        }
      } catch {
        if (!cancelled) {
          setViewerSummary(null);
        }
      } finally {
        if (!cancelled) {
          setViewerSummaryLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session]);

  const currentStorefront = storefront ?? storefrontFallback;
  const catalogItems =
    loading && !storefront ? [] : sortCatalogItemsForStorefront(currentStorefront.items);
  const heroStats = [
    {
      label: "Đơn hàng",
      value: session
        ? (viewerSummary?.total_orders ?? 0)
        : currentStorefront.stats.total_orders,
    },
    {
      label: "VPS đang chạy",
      value: session
        ? (viewerSummary?.active_instances ?? 0)
        : currentStorefront.stats.live_instances,
    },
  ];

  async function handleBuyNow(payload: {
    itemId: number;
    note?: string;
    quantity: number;
    customAddonCpu: number;
    customAddonRam: number;
    customAddonDisk: number;
  }) {
    const currentSession = getStoredSession();

    if (!currentSession) {
      router.push("/vps/auth");
      return;
    }

    try {
      setIsSubmittingOrder(true);
      await createOrder(currentSession.token, {
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
      setNoticeMessage("Đơn hàng của bạn đã được tạo thành công. Vui lòng vào bảng điều khiển để xem VPS và trạng thái xử lý.");
      setNoticeVariant("success");
      setNoticeHighlights([
        "IP, user, mật khẩu và trạng thái sẽ hiển thị trong dashboard khi hệ thống hoàn tất đồng bộ.",
        "Anh có thể theo dõi tiếp auto renew hoặc thao tác nguồn ngay trong khu quản lý VPS.",
      ]);
      setNoticeOpen(true);
      try {
        const snapshot = await getPortalSnapshot(currentSession.token);
        setViewerSummary({
          total_orders: snapshot.orders.summary.total_orders,
          active_instances: snapshot.orders.summary.active_instances,
        });
      } catch {
        // no-op
      }
    } catch (error) {
      const nextMessage =
        error instanceof Error ? error.message : "Không thể tạo đơn hàng.";

      if (shouldRedirectToDeposit(nextMessage)) {
        setFlash("Số dư không đủ. Hệ thống đang chuyển bạn sang trang nạp tiền...");
        setNoticeVariant("warning");
        setNoticeHighlights([
          "Sau khi nạp thêm số dư, anh có thể quay lại và tiếp tục mua lại đúng gói đang chọn.",
        ]);
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
          "Nếu cần kiểm tra thời gian mở bán lại, anh có thể liên hệ hỗ trợ trực tiếp.",
        ]);
        setNoticeOpen(true);
        return;
      }

      setFlash(nextMessage);
    } finally {
      setIsSubmittingOrder(false);
    }
  }

  const heroTitle =
    currentStorefront.settings.hero_title || storefrontFallback.settings.hero_title;

  return (
    <div className="landing-typography min-h-screen pb-20">
      <SiteHeader
        brandName={currentStorefront.settings.brand_name}
        supportLink={currentStorefront.settings.support_link}
      />

      <main className="space-y-16 pb-20 pt-6 md:pt-8">
        <section className="section-shell">
          <div className="landing-hero-shell">
            <div className="landing-hero-grid" />
            <div className="relative mx-auto flex max-w-5xl flex-col items-center text-center">
              <div className="landing-hero-logo-wrap">
                <Image
                  src={siteConfig.splashLogoPath}
                  alt={siteConfig.name}
                  width={320}
                  height={120}
                  unoptimized
                  loading="eager"
                  priority
                  className="landing-hero-logo-image h-14 w-auto object-contain drop-shadow-[0_12px_40px_rgba(0,102,255,0.25)] md:h-[4.25rem]"
                />
              </div>

              <span className="landing-hero-badge landing-hero-reveal-badge">
                <Sparkles className="h-3.5 w-3.5" />
                {currentStorefront.settings.hero_badge}
              </span>

              <h1 className="landing-hero-title landing-hero-reveal-title">{heroTitle}</h1>

              <p className="landing-hero-copy landing-hero-reveal-copy">
                {currentStorefront.settings.hero_subtitle}
              </p>

              <div className="landing-hero-actions landing-hero-reveal-actions">
                <Link href={session ? "/vps/dashboard" : "/vps/auth"} className="landing-cta-primary">
                  {session ? "Vào bảng điều khiển" : "Đăng nhập để mua VPS"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a href={DEPOSIT_URL} className="landing-cta-secondary">
                  Nạp số dư
                </a>
              </div>

              {flash ? (
                <div className="landing-flash-banner mt-6">
                  {flash}
                </div>
              ) : null}

              <div className="landing-hero-flow-board landing-hero-reveal-stage">
                <div className="landing-hero-flow-step-list">
                  {heroFlowSteps.map((item, index) => (
                    <div key={item.title} className="landing-hero-flow-step-card">
                      <div className="landing-hero-flow-step-icon">
                        <item.icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="landing-hero-flow-step-meta">
                          <span className="landing-mini-pill">0{index + 1}</span>
                          <p className="landing-hero-flow-step-title">{item.title}</p>
                        </div>
                        <p className="landing-hero-flow-step-copy">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="landing-hero-flow-visual">
                  <div className="landing-hero-flow-aura landing-hero-flow-aura-a" />
                  <div className="landing-hero-flow-aura landing-hero-flow-aura-b" />
                  <div className="landing-hero-flow-ring landing-hero-flow-ring-a" />
                  <div className="landing-hero-flow-ring landing-hero-flow-ring-b" />
                  <div className="landing-hero-flow-ring landing-hero-flow-ring-c" />

                  <div className="landing-hero-flow-tag landing-hero-flow-tag-a">
                    THANH TOÁN
                  </div>
                  <div className="landing-hero-flow-tag landing-hero-flow-tag-b">
                    PROVISION
                  </div>
                  <div className="landing-hero-flow-tag landing-hero-flow-tag-c">
                    DASHBOARD
                  </div>
                  <div className="landing-hero-flow-tag landing-hero-flow-tag-d">
                    AUTO RENEW
                  </div>

                  <span className="landing-hero-flow-orbit-dot landing-hero-flow-orbit-dot-a" />
                  <span className="landing-hero-flow-orbit-dot landing-hero-flow-orbit-dot-b" />
                  <span className="landing-hero-flow-orbit-dot landing-hero-flow-orbit-dot-c" />
                  <span className="landing-hero-flow-orbit-dot landing-hero-flow-orbit-dot-d" />

                  <div className="landing-hero-flow-core">
                    <span className="landing-hero-flow-core-kicker">Điều phối</span>
                    <strong className="landing-hero-flow-core-title">VPS</strong>
                  </div>
                </div>
              </div>

              <div className="landing-stat-row landing-hero-reveal-stats">
                {heroStats.map((item, index) => (
                  <div
                    key={item.label}
                    className="landing-stat-card"
                    style={{ animationDelay: `${0.08 + index * 0.1}s` }}
                  >
                    <p className="landing-stat-label">{item.label}</p>
                    <div className="landing-stat-value">
                      {loading && !storefront ? (
                        <span className="landing-stat-skeleton" />
                      ) : session && viewerSummaryLoading ? (
                        <span className="landing-stat-skeleton" />
                      ) : (
                        item.value
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="section-shell">
          <div className="landing-catalog-hero">
            <div className="landing-catalog-grid">
              <div className="landing-catalog-copy">
                <span className="landing-section-kicker">Trang giới thiệu riêng</span>
                <h2 className="landing-section-title mt-5">
                  Xem riêng phần giới thiệu VPS, hệ điều hành và hạ tầng vận hành
                </h2>
                <p className="landing-section-copy mt-4 max-w-3xl">
                  Nếu bạn muốn xem kỹ hơn về dịch vụ VPS, khu giới thiệu hiện đã được tách ra
                  thành một trang riêng với tổng quan hệ điều hành, tính năng nổi bật và hạ tầng
                  kết nối tại Việt Nam.
                </p>

                <div className="landing-catalog-tags mt-6">
                  <span className="landing-mini-pill">Giới thiệu riêng</span>
                  <span className="landing-mini-pill">Có bản đồ Việt Nam</span>
                  <span className="landing-mini-pill">Danh sách OS thật</span>
                </div>
              </div>

              <div className="landing-catalog-panel">
                <p className="landing-catalog-panel-kicker">Khám phá thêm</p>
                <h3 className="landing-catalog-panel-title">
                  Mở trang <strong>Giới thiệu</strong> để xem toàn bộ chi tiết
                </h3>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                  Tại đây bạn sẽ thấy tổng quan VPS là gì, danh sách hệ điều hành, hạ tầng trong
                  nước và những tính năng nổi bật trước khi quyết định mua.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href="/vps/gioi-thieu" className="landing-cta-primary !h-11 !px-5">
                    Mở trang giới thiệu
                  </Link>
                  <a href="#catalog" className="landing-cta-secondary !h-11 !px-5">
                    Xem bảng giá
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="catalog" className="section-shell">
          <div className="landing-catalog-hero mb-10">
            <div className="landing-catalog-grid">
              <div className="landing-catalog-copy">
                <span className="landing-section-kicker">Danh mục đang mở bán</span>
                <h2 className="landing-section-title mt-5">
                  Gói VPS cấu hình sẵn, giá rõ ràng và có thể mua ngay
                </h2>
                <p className="landing-section-copy mt-4 max-w-3xl">
                  Chọn nhanh gói phù hợp với nhu cầu MMO, website hoặc bot tự động của bạn.
                  Sau khi thanh toán, hệ thống sẽ tiếp tục đẩy đơn và trả thông tin quản lý về
                  dashboard.
                </p>

                <div className="landing-catalog-tags mt-6">
                  <span className="landing-mini-pill">Mở bán tự động</span>
                  <span className="landing-mini-pill">Thanh toán bằng số dư</span>
                  <span className="landing-mini-pill">Bàn giao về dashboard</span>
                </div>
              </div>

              <div className="landing-catalog-panel">
                <p className="landing-catalog-panel-kicker">Lưu ý trước khi thanh toán</p>
                <h3 className="landing-catalog-panel-title">
                  Vui lòng đọc <strong>Chính sách</strong> dịch vụ VPS
                </h3>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                  Trước khi bấm mua, bạn cần xem qua điều khoản sử dụng, hoàn tiền và quy định
                  vận hành để quá trình đăng ký VPS diễn ra rõ ràng hơn.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button type="button" onClick={() => setPolicyOpen(true)} className="ghost-button">
                    Xem Chính sách
                  </button>
                  <a href={DEPOSIT_URL} className="landing-cta-secondary !h-11 !px-5">
                    Nạp số dư
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-6 rounded-[30px] border border-white/8 bg-white/[0.03] p-5 md:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
                  Điều khoản khi mua VPS
                </p>
                <h3 className="mt-3 font-[family-name:var(--font-space-grotesk)] text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                  <strong>Chính sách</strong> được áp dụng trực tiếp trong luồng thanh toán
                </h3>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
                  Khi bấm mua gói VPS, hệ thống sẽ yêu cầu bạn xác nhận đã đọc và đồng ý với
                  chính sách trước khi tạo đơn hàng.
                </p>
              </div>

              <button type="button" onClick={() => setPolicyOpen(true)} className="ghost-button">
                Xem toàn bộ chính sách
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {vpsPolicyHighlights.map((item) => (
                <div
                  key={item}
                  className="rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-4 text-sm leading-7 text-[var(--muted)]"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="landing-plan-grid">
            {catalogItems.length ? (
              catalogItems.map((item) => (
                <GlowCard key={item.id} className="h-full">
                  <StorefrontPlanCard
                    item={item}
                    buttonLabel="Đăng ký ngay"
                    onBuy={() => {
                      if (!session) {
                        router.push("/vps/auth");
                        return;
                      }

                      setSelectedItem(item);
                    }}
                  />
                </GlowCard>
              ))
            ) : loading && !storefront ? (
              Array.from({ length: 3 }).map((_, index) => (
                <GlowCard key={`loading-${index}`} className="h-full">
                  <div className="vps-offer-card-shell">
                    <div className="h-8 w-40 animate-pulse rounded-full bg-slate-200/80" />
                    <div className="mt-3 h-4 w-20 animate-pulse rounded-full bg-slate-200/70" />
                    <div className="mt-6 h-3 w-20 animate-pulse rounded-full bg-slate-200/70" />
                    <div className="mt-3 h-12 w-48 animate-pulse rounded-[20px] bg-slate-200/80" />
                    <div className="mt-4 h-10 animate-pulse rounded-2xl bg-red-100/90" />
                    <div className="mt-6 grid gap-3">
                      {Array.from({ length: 3 }).map((__, specIndex) => (
                        <div key={specIndex} className="h-11 animate-pulse rounded-[18px] bg-slate-200/75" />
                      ))}
                    </div>
                    <div className="mt-6 grid gap-4">
                      {Array.from({ length: 3 }).map((__, featureIndex) => (
                        <div key={featureIndex} className="h-6 animate-pulse rounded-full bg-slate-200/65" />
                      ))}
                    </div>
                    <div className="mt-8 h-12 animate-pulse rounded-2xl bg-sky-200/80" />
                  </div>
                </GlowCard>
              ))
            ) : (
              <div className="md:col-span-2 xl:col-span-3">
                <div className="landing-empty-card">
                  <Boxes className="h-10 w-10 text-[#0066ff]" />
                  <h3 className="mt-5 font-[family-name:var(--font-space-grotesk)] text-2xl font-semibold text-[var(--foreground)]">
                    Chưa có gói VPS nào đang mở bán
                  </h3>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
                    Hệ thống đang chờ danh mục VPS được đồng bộ và bật trạng thái bán. Khi có dữ liệu, các gói sẽ tự hiển thị tại đây để người dùng đặt mua.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="section-shell">
          <div className="landing-faq-shell">
            <div className="mx-auto mb-10 flex max-w-5xl flex-col items-center text-center">
              <span className="landing-section-kicker">Câu hỏi thường gặp</span>
              <h2 className="landing-section-title mt-5 text-balance">
                Những điểm người mua VPS thường hỏi trước khi bắt đầu
              </h2>
            </div>

            <div className="mx-auto max-w-4xl space-y-4">
              {faqItems.map((item, index) => (
                <details key={item.question} className="landing-faq-item" open={index === 0}>
                  <summary className="landing-faq-summary">
                    <span className="min-w-0 flex-1">{item.question}</span>
                    <span className="landing-mini-pill flex-shrink-0">0{index + 1}</span>
                  </summary>
                  <p className="landing-faq-answer">{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <footer className="section-shell">
          <div className="landing-footer-shell">
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.34em] text-[var(--muted)]">
                TRUNGTAMMMO.VN
              </p>
              <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--muted)]">
                Website VPS tối ưu cho việc chọn gói, thanh toán bằng số dư và quản lý dịch vụ trong một giao diện sạch, nhanh và dễ dùng.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm font-semibold">
              <Link
                href="/vps/gioi-thieu"
                className="text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
              >
                Giới thiệu
              </Link>
              <a href="#catalog" className="text-[var(--muted)] transition-colors hover:text-[var(--foreground)]">
                Bảng giá
              </a>
              <a href={DEPOSIT_URL} className="text-[var(--muted)] transition-colors hover:text-[var(--foreground)]">
                Nạp số dư
              </a>
              <Link
                href={session ? "/vps/dashboard" : "/vps/auth"}
                className="text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
              >
                {session ? "Dashboard" : "Tài khoản"}
              </Link>
            </div>
          </div>
        </footer>
      </main>

      <VpsCheckoutModal
        key={selectedItem?.id ?? "home-checkout"}
        item={selectedItem}
        settings={currentStorefront.settings}
        open={Boolean(selectedItem)}
        loading={isSubmittingOrder}
        onClose={() => setSelectedItem(null)}
        onOpenPolicy={() => setPolicyOpen(true)}
        onConfirm={({ note, acceptedPolicy, quantity, customAddonCpu, customAddonRam, customAddonDisk }) => {
          if (!selectedItem) {
            return;
          }

          if (!acceptedPolicy) {
            return;
          }

          void handleBuyNow({
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
        message={noticeMessage}
        variant={noticeVariant}
        highlights={noticeHighlights}
        supportLink={noticeTitle === "Hệ thống bảo trì" ? currentStorefront.settings.support_link : undefined}
        onClose={() => {
          setNoticeOpen(false);
          setNoticeVariant("info");
          setNoticeHighlights([]);
        }}
      />
    </div>
  );
}
