"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Clock3,
  Globe2,
  Layers3,
  LayoutDashboard,
  Server,
  ShieldCheck,
  Sparkles,
  WalletCards,
  Zap,
} from "lucide-react";
import { SiteHeader } from "@vps/components/layout/site-header";
import { HeroScene } from "@vps/components/sections/hero-scene";
import { VietnamNetworkMap } from "@vps/components/sections/vietnam-network-map";
import { GlowCard } from "@vps/components/ui/glow-card";
import { DEPOSIT_URL, getStorefrontData } from "@vps/lib/api";
import { storefrontFallback } from "@vps/lib/sample-data";
import { StorefrontData } from "@vps/lib/types";

type OperatingSystemInsight = {
  title: string;
  summary: string;
  highlights: string[];
};

const introAnchors = [
  { href: "#vps-la-gi", label: "Giới thiệu", isPrimary: false },
  { href: "#he-dieu-hanh", label: "Hệ điều hành", isPrimary: false },
  { href: "#ha-tang", label: "Hạ tầng", isPrimary: false },
  { href: "#tinh-nang", label: "Tính năng", isPrimary: false },
  { href: "/vps#catalog", label: "Xem các gói và giá", isPrimary: true },
] as const;

const performanceItems = [
  "Ổ cứng SSD/NVMe tốc độ cao kết hợp Intel Xeon Gold & Platinum để website, MMO và bot phản hồi nhanh hơn.",
  "Tài nguyên CPU, RAM, dung lượng lưu trữ và băng thông được niêm yết rõ ràng để bạn dễ chọn gói phù hợp ngay từ đầu.",
  "Đường truyền nội địa và quốc tế được ưu tiên ổn định để backend, website, automation bot vận hành mượt hơn.",
] as const;

const infrastructureLocations = [
  "Cụm vận hành tại TP. Hồ Chí Minh",
  "Cụm vận hành tại Hà Nội",
  "Kết nối tăng cường qua Bình Dương",
  "Điểm trung chuyển tối ưu tại Đà Nẵng",
  "Đường truyền nội địa ưu tiên độ trễ thấp",
  "Kênh truy cập quốc tế ổn định cho website, MMO và automation",
] as const;

const introductionReasons = [
  {
    icon: Zap,
    title: "Đơn giản, dễ dùng và triển khai nhanh",
    description:
      "Giao diện chọn gói, thanh toán và nhận thông tin truy cập được gom về một flow ngắn gọn, dễ thao tác cho cả người mới lẫn người vận hành thường xuyên.",
  },
  {
    icon: Globe2,
    title: "Network nhanh và ổn định",
    description:
      "Ưu tiên băng thông ổn định trong nước lẫn quốc tế để website, MMO và automation bot vận hành mượt hơn theo thời gian.",
  },
  {
    icon: LayoutDashboard,
    title: "Portal quản lý tập trung",
    description:
      "Xem đơn hàng, VPS đang chạy, thông tin đăng nhập và trạng thái dịch vụ trong cùng một khu quản lý rõ ràng, dễ theo dõi.",
  },
  {
    icon: ShieldCheck,
    title: "Firewall và uptime cao",
    description:
      "Tăng độ an toàn khi vận hành, giảm rủi ro gián đoạn và giữ trải nghiệm dịch vụ ổn định hơn cho từng gói VPS bạn sử dụng.",
  },
] as const;

const introHeroHighlights = [
  {
    title: "Mua nhanh bằng số dư",
    description: "Chọn gói, xác nhận chính sách và để hệ thống xử lý đơn theo luồng ngắn gọn.",
  },
  {
    title: "Bàn giao về dashboard",
    description: "IP, user, mật khẩu và trạng thái VPS trả về cùng một nơi để dễ theo dõi hơn.",
  },
  {
    title: "Tối ưu cho MMO và bot",
    description: "Tập trung vào trải nghiệm khởi tạo nhanh, rõ trạng thái và dễ thao tác lại sau mua.",
  },
] as const;

function getOperatingSystemInsight(name: string): OperatingSystemInsight {
  const normalizedName = name.toLowerCase();

  if (normalizedName.includes("ubuntu 24")) {
    return {
      title: name,
      summary: "Bản Ubuntu mới, hợp cho backend hiện đại, Docker và các stack mới cần thư viện cập nhật.",
      highlights: ["API / backend mới", "Docker / container", "Triển khai dài hạn"],
    };
  }

  if (normalizedName.includes("ubuntu 22")) {
    return {
      title: name,
      summary: "Lựa chọn cân bằng để chạy web, MMO, tool và automation bot với hệ sinh thái rất phổ biến.",
      highlights: ["Ổn định cho MMO", "Phổ biến với web", "Dễ tìm tài liệu"],
    };
  }

  if (normalizedName.includes("ubuntu 20")) {
    return {
      title: name,
      summary: "Phù hợp khi cần tương thích với các stack cũ hơn nhưng vẫn muốn giữ trải nghiệm Ubuntu quen thuộc.",
      highlights: ["Tương thích cao", "Hợp stack cũ", "Dễ quản trị"],
    };
  }

  if (normalizedName.includes("debian 12")) {
    return {
      title: name,
      summary: "Debian 12 gọn, ổn định và hợp với các workload backend hoặc web cần uptime đều.",
      highlights: ["Backend lâu dài", "Nhẹ và ổn định", "Hợp server production"],
    };
  }

  if (normalizedName.includes("debian 11")) {
    return {
      title: name,
      summary: "Bản Debian phổ biến cho các dịch vụ chạy bền bỉ, ít thay đổi và dễ kiểm soát tài nguyên.",
      highlights: ["Ổn định", "Ít tiêu tốn tài nguyên", "Hợp dịch vụ nền"],
    };
  }

  if (
    normalizedName.includes("alma") ||
    normalizedName.includes("centos") ||
    normalizedName.includes("rocky")
  ) {
    return {
      title: name,
      summary: "Nhóm hệ điều hành phù hợp cho môi trường kiểu doanh nghiệp, control panel và các app thích chuẩn RHEL.",
      highlights: ["Chuẩn RHEL", "Hợp control panel", "Ổn định lâu dài"],
    };
  }

  if (normalizedName.includes("windows")) {
    return {
      title: name,
      summary: "Dùng khi bạn cần môi trường quen thuộc cho phần mềm Windows, remote desktop hoặc tool chuyên dụng.",
      highlights: ["Tool Windows", "RDP tiện dùng", "Hợp app desktop"],
    };
  }

  if (normalizedName.includes("proxy")) {
    return {
      title: name,
      summary: "Biến thể dựng sẵn cho các kịch bản proxy hoặc luồng mạng riêng cần thao tác nhanh ngay sau khi tạo VPS.",
      highlights: ["Dùng nhanh", "Tối ưu kết nối", "Hợp workflow mạng"],
    };
  }

  if (normalizedName.includes("docker")) {
    return {
      title: name,
      summary: "Biến thể tối ưu cho container, giúp bạn dựng môi trường chạy app hoặc bot theo mô hình đóng gói nhanh hơn.",
      highlights: ["Tối ưu container", "Triển khai nhanh", "Hợp microservice"],
    };
  }

  if (normalizedName.includes("aapanel") || normalizedName.includes("nginx")) {
    return {
      title: name,
      summary: "Bản dựng sẵn panel và web stack để rút ngắn thời gian cấu hình ban đầu cho website hoặc landing page.",
      highlights: ["Có sẵn web stack", "Dễ quản trị", "Phù hợp website"],
    };
  }

  return {
    title: name,
    summary: "Bản hệ điều hành có sẵn trong hệ thống để bạn chọn nhanh đúng môi trường phù hợp cho nhu cầu triển khai.",
    highlights: ["Triển khai nhanh", "Có sẵn trong hệ thống", "Dễ đổi theo nhu cầu"],
  };
}

export function IntroductionPageClient() {
  const [storefront, setStorefront] = useState<StorefrontData>(storefrontFallback);
  const [loading, setLoading] = useState(true);
  const [activeOperatingSystem, setActiveOperatingSystem] = useState("");

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

  const operatingSystems = Array.from(
    new Set(
      [
        ...(Array.isArray(storefront.operatingSystems)
          ? storefront.operatingSystems
          : storefrontFallback.operatingSystems),
        ...storefront.items
          .map((item) => item.operating_system_name)
          .filter((item): item is string => Boolean(item)),
      ].map((item) => item.replace(/\s+/g, " ").trim()),
    ),
  ).slice(0, 18);
  const introCustomerCount = Number.parseInt(
    storefront.settings.intro_customer_count || `${storefront.stats.total_customers || 0}`,
    10,
  );

  const resolvedActiveOperatingSystem = operatingSystems.includes(activeOperatingSystem)
    ? activeOperatingSystem
    : (operatingSystems[0] ?? "");

  const activeOperatingSystemInsight = resolvedActiveOperatingSystem
    ? getOperatingSystemInsight(resolvedActiveOperatingSystem)
    : null;

  return (
    <div className="landing-typography min-h-screen pb-20">
      <SiteHeader
        brandName={storefront.settings.brand_name}
        supportLink={storefront.settings.support_link}
      />

      <main className="space-y-16 pb-20 pt-6 md:pt-8">
        <section className="section-shell">
          <div className="landing-intro-shell">
            <div className="landing-anchor-row">
              {introAnchors.map((item) =>
                item.isPrimary ? (
                  <Link key={item.href} href={item.href} className="landing-cta-primary !h-11 !px-5">
                    {item.label}
                  </Link>
                ) : (
                  <a key={item.href} href={item.href} className="landing-anchor-link">
                    {item.label}
                  </a>
                ),
              )}
            </div>

            <div className="landing-intro-page-hero">
              <div className="landing-intro-page-copy">
                <span className="landing-section-kicker">
                  <Sparkles className="h-3.5 w-3.5" />
                  Giới thiệu hệ thống VPS
                </span>
                <h1 className="landing-section-title mt-6 !max-w-[14ch]">
                  VPS tốc độ cao cho MMO, website và automation bot
                </h1>
                <p className="mt-5 max-w-3xl text-base leading-8 text-[var(--muted)] md:text-lg">
                  Đây là khu giới thiệu tổng quan về dịch vụ VPS tại TRUNGTAMMMO.VN, nơi bạn có
                  thể xem cách hệ thống vận hành, danh sách hệ điều hành, hạ tầng kết nối và
                  các điểm nổi bật trước khi chọn gói phù hợp.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href="/vps#catalog" className="landing-cta-primary">
                    Xem bảng giá VPS
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <a href={DEPOSIT_URL} className="landing-cta-secondary">
                    Nạp số dư
                  </a>
                </div>
              </div>

              <div className="landing-intro-summary-panel">
                <div className="landing-intro-page-stat-row">
                  {[
                    { label: "Gói đang mở bán", value: storefront.items.length },
                    { label: "OS triển khai", value: operatingSystems.length },
                    {
                      label: "Khách hàng",
                      value: Number.isFinite(introCustomerCount)
                        ? introCustomerCount
                        : storefront.stats.total_customers,
                    },
                  ].map((item) => (
                    <div key={item.label} className="landing-intro-stat-card">
                      <p className="landing-intro-stat-label">{item.label}</p>
                      <div className="landing-intro-stat-value">
                        {loading ? <span className="landing-stat-skeleton" /> : item.value}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="landing-intro-summary-list">
                  {introHeroHighlights.map((item) => (
                    <div key={item.title} className="landing-intro-summary-item">
                      <div className="landing-bullet-icon landing-intro-summary-icon">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {item.title}
                        </p>
                        <p className="mt-1 text-sm leading-7 text-[var(--muted)]">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="landing-intro-summary-note">
                  <p className="landing-intro-summary-note-kicker">Luồng được mô tả trong video</p>
                  <p className="mt-3 text-sm leading-7 text-[var(--foreground)] md:text-base">
                    Từ lúc chọn gói tới lúc xem trạng thái trên dashboard, toàn bộ flow được tối ưu
                    để ít bước hơn, dễ hiểu hơn và bớt cảm giác rời rạc giữa mua, provision và quản lý.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="vps-la-gi" className="section-shell scroll-mt-32">
          <div className="landing-intro-top-grid">
            <div className="landing-copy-card">
              <span className="landing-section-kicker">Giới thiệu</span>
              <h2 className="landing-section-title mt-5">VPS là gì?</h2>
              <p className="landing-section-copy mt-4">
                VPS là máy chủ ảo riêng với tài nguyên CPU, RAM và dung lượng lưu trữ được tách
                riêng để bạn có thể cài đặt hệ điều hành, cấu hình dịch vụ và vận hành như một
                máy chủ độc lập cho chính mình.
              </p>
              <p className="mt-4 text-sm leading-8 text-[var(--muted)] md:text-base">
                Tại TRUNGTAMMMO.VN, VPS phù hợp để chạy MMO, website, backend, tool bán hàng,
                automation bot và những workflow cần khởi tạo nhanh, dễ theo dõi và dễ mở rộng
                theo từng giai đoạn vận hành.
              </p>

              <div className="landing-intro-fact-grid">
                {[
                  {
                    icon: Layers3,
                    title: "Tài nguyên riêng",
                    description:
                      "CPU, RAM và dung lượng lưu trữ được tách riêng theo từng gói để bạn dễ quản trị.",
                  },
                  {
                    icon: WalletCards,
                    title: "Thanh toán gọn",
                    description:
                      "Mua VPS trực tiếp bằng số dư hiện có trong hệ thống TRUNGTAMMMO.VN mà không cần nhiều bước trung gian.",
                  },
                  {
                    icon: Server,
                    title: "Toàn quyền quản trị",
                    description:
                      "Bạn chủ động chọn hệ điều hành, nhận IP, user và mật khẩu để cài đặt, vận hành theo ý muốn.",
                  },
                  {
                    icon: Clock3,
                    title: "Theo dõi tập trung",
                    description:
                      "Quản lý vòng đời dịch vụ, kỳ hạn và trạng thái ngay trong dashboard người dùng.",
                  },
                ].map((item) => (
                  <div key={item.title} className="landing-intro-fact-card">
                    <div className="landing-bullet-icon">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-[var(--foreground)]">
                        {item.title}
                      </p>
                      <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="landing-intro-visual-wrap">
              <div className="landing-intro-visual-copy">
                <span className="landing-section-kicker">Trải nghiệm VPS</span>
                <h3 className="font-[family-name:var(--font-space-grotesk)] text-3xl font-semibold tracking-[-0.05em] text-[var(--foreground)] md:text-4xl">
                  Luồng chọn gói, thanh toán và provision được gom vào một trải nghiệm rõ ràng
                </h3>
                <p className="landing-section-copy mt-4 max-w-2xl">
                  {storefront.settings.announcement}
                  {loading ? " Hệ thống đang đồng bộ thêm dữ liệu để hiển thị đầy đủ hơn..." : ""}
                </p>
              </div>

              <HeroScene />
            </div>
          </div>
        </section>

        <section className="section-shell">
          <div className="landing-intro-dual-grid">
            <div className="landing-copy-card">
              <span className="landing-section-kicker">Hiệu năng nổi bật</span>
              <h3 className="landing-intro-card-title">
                Tốc độ nhanh và ổn định cho MMO, website và automation
              </h3>
              <p className="mt-4 text-sm leading-8 text-[var(--muted)] md:text-base">
                Trải nghiệm vận hành được tối ưu theo hướng dễ chọn cấu hình, dễ triển khai và
                hạn chế các bước rườm rà trong quá trình sử dụng hàng ngày.
              </p>

              <div className="landing-performance-list">
                {performanceItems.map((item) => (
                  <div key={item} className="landing-performance-item">
                    <div className="landing-performance-check">
                      <Zap className="h-4 w-4" />
                    </div>
                    <p className="text-sm leading-7 text-[var(--foreground)]">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div id="he-dieu-hanh" className="landing-os-card scroll-mt-32">
              <span className="landing-section-kicker">Hệ điều hành</span>
              <h3 className="landing-intro-card-title">Danh sách OS sẵn sàng triển khai</h3>
              <p className="mt-4 text-sm leading-8 text-[var(--muted)] md:text-base">
                Danh sách hệ điều hành dưới đây được đồng bộ từ hệ thống triển khai hiện tại để
                bạn dễ chọn bản phù hợp cho website, MMO, automation bot hoặc backend.
              </p>

              <div className="landing-os-grid">
                {operatingSystems.map((operatingSystem) => {
                  const insight = getOperatingSystemInsight(operatingSystem);
                  const isActive = operatingSystem === activeOperatingSystem;

                  return (
                    <button
                      key={operatingSystem}
                      type="button"
                      className="landing-os-chip"
                      data-active={isActive}
                      onMouseEnter={() => setActiveOperatingSystem(operatingSystem)}
                      onFocus={() => setActiveOperatingSystem(operatingSystem)}
                      onClick={() => setActiveOperatingSystem(operatingSystem)}
                    >
                      <span className="landing-os-chip-text">{operatingSystem}</span>
                      <span className="landing-os-chip-hover-card" role="tooltip">
                        <strong>{insight.title}</strong>
                        <span>{insight.summary}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {activeOperatingSystemInsight ? (
                <div className="landing-os-detail-card">
                  <p className="landing-os-detail-kicker">OS đang được xem</p>
                  <h4 className="landing-os-detail-title">{activeOperatingSystemInsight.title}</h4>
                  <p className="landing-os-detail-copy">{activeOperatingSystemInsight.summary}</p>

                  <div className="landing-os-detail-tags">
                    {activeOperatingSystemInsight.highlights.map((highlight) => (
                      <span key={highlight} className="landing-os-detail-tag">
                        {highlight}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section id="ha-tang" className="section-shell scroll-mt-32">
          <div className="space-y-6">
            <div className="landing-copy-card">
              <span className="landing-section-kicker">Hạ tầng trung tâm dữ liệu</span>
              <h3 className="landing-intro-card-title">
                Phân bổ theo các cụm hạ tầng lớn tại Việt Nam
              </h3>
              <p className="mt-4 text-sm leading-8 text-[var(--muted)] md:text-base">
                Hệ thống ưu tiên khả năng kết nối nhanh, độ trễ tốt và mức độ sẵn sàng cao để
                phục vụ các workload cần vận hành liên tục, ổn định và dễ mở rộng.
              </p>

              <div className="landing-datacenter-list">
                {infrastructureLocations.map((location) => (
                  <div key={location} className="landing-datacenter-item">
                    <span className="landing-datacenter-dot" />
                    <span>{location}</span>
                  </div>
                ))}
              </div>
            </div>

            <VietnamNetworkMap />
          </div>
        </section>

        <section id="tinh-nang" className="section-shell scroll-mt-32">
          <div className="mx-auto mb-8 flex max-w-5xl flex-col items-center text-center">
            <span className="landing-section-kicker">Tính năng nổi bật</span>
            <h2 className="landing-section-title mt-5 !max-w-none">
              Những điểm làm cho trải nghiệm VPS gọn, nhanh và dễ dùng hơn
            </h2>
          </div>

          <div className="landing-feature-grid">
            {introductionReasons.map((item) => (
              <GlowCard key={item.title} className="h-full">
                <div className="landing-feature-card">
                  <div className="landing-bullet-icon">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <h4 className="mt-6 font-[family-name:var(--font-space-grotesk)] text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                    {item.title}
                  </h4>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                    {item.description}
                  </p>
                </div>
              </GlowCard>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
