"use client";

import { ArrowRight, BadgePercent, Check, Cpu, HardDrive, MemoryStick } from "lucide-react";
import { formatCurrency } from "@vps/lib/api";
import { formatBillingCycle } from "@vps/lib/portal";
import { CatalogItem } from "@vps/lib/types";

type StorefrontPlanCardProps = {
  item: CatalogItem;
  onBuy: () => void;
  buttonLabel?: string;
  disabled?: boolean;
  loading?: boolean;
};

function buildSpecRows(item: CatalogItem) {
  return [
    {
      icon: Cpu,
      label: item.cpu_label || `${Math.max(item.addon_cpu, 1)} CPU`,
    },
    {
      icon: MemoryStick,
      label: item.ram_label || `${Math.max(item.addon_ram, 1)} GB RAM`,
    },
    {
      icon: HardDrive,
      label: item.disk_label || `${Math.max(item.addon_disk, 20)} GB SSD`,
    },
  ];
}

function buildFeatureRows(item: CatalogItem) {
  return [
    `Network: ${item.bandwidth_label || "Đường truyền ổn định cho website, MMO và bot phổ biến"}`,
    "Có thể custom thêm CPU, RAM và disk ngay trong popup thanh toán trước khi tạo VPS.",
    "Bàn giao IP, user và mật khẩu quản trị ngay trong bảng điều khiển sau khi đơn được xử lý.",
    "Có thể theo dõi trạng thái, kỳ hạn và thao tác VPS ngay trong bảng điều khiển.",
  ].filter(Boolean);
}

function formatDisplayTitle(title: string) {
  return title
    .trim()
    .replace(/^CS(?=[\d-])/i, "VPS ")
    .replace(/^CS\s+/i, "VPS ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function StorefrontPlanCard({
  item,
  onBuy,
  buttonLabel = "Đăng ký ngay",
  disabled = false,
  loading = false,
}: StorefrontPlanCardProps) {
  const displayTitle = formatDisplayTitle(item.title);
  const billingLabel = formatBillingCycle(item.billing_cycle_label || item.billing_cycle_code);
  const hasComparePrice =
    typeof item.compare_price === "number" && item.compare_price > 0;
  const savingsPercent =
    hasComparePrice && item.compare_price && item.compare_price > item.sale_price
      ? Math.max(1, Math.round(((item.compare_price - item.sale_price) / item.compare_price) * 100))
      : null;
  const operatingSystemLabel = "Win/Linux/Tùy chỉnh theo nhu cầu";
  const summaryCopy =
    item.short_description ||
    item.description ||
    "Phù hợp cho các workload phổ biến cần khởi tạo nhanh và quản lý gọn.";
  const detailRows = [
    {
      label: "Chu kỳ",
      value: billingLabel,
    },
    {
      label: "OS khởi tạo",
      value: operatingSystemLabel,
    },
  ];

  return (
    <article className="vps-offer-card-shell">
      <div className="vps-offer-card-head">
        <div className="vps-offer-card-topline">
          <div className="vps-offer-card-title-wrap">
            <div className="vps-offer-card-title-row">
              <p className="vps-offer-card-title">{displayTitle}</p>
              <span className="vps-offer-card-badge">{item.badge_text || "Sẵn sàng"}</span>
            </div>
            <p className="vps-offer-card-copy">{summaryCopy}</p>
          </div>

          <span className="vps-offer-card-cycle-pill">{billingLabel}</span>
        </div>

        <div className="vps-offer-price-block">
          {hasComparePrice ? (
            <div className="vps-offer-compare-row">
              <span className="vps-offer-compare-label">Giá gốc</span>
              <span className="vps-offer-compare-price">{formatCurrency(item.compare_price ?? 0)}</span>
            </div>
          ) : (
            <div className="vps-offer-compare-spacer" />
          )}

          <div className="vps-offer-sale-row">
            <span className="vps-offer-sale-price">{formatCurrency(item.sale_price)}</span>
            <div className="vps-offer-sale-meta">
              <span className="vps-offer-sale-suffix">/{billingLabel.toLowerCase()}</span>
              <span className="vps-offer-sale-caption">Thanh toán theo chu kỳ đã chọn</span>
            </div>
          </div>
        </div>

        <div className="vps-offer-promo-bar">
          <BadgePercent className="h-4 w-4" />
          <span>
            {hasComparePrice && savingsPercent
              ? `Ưu đãi đang áp dụng, tiết kiệm ${savingsPercent}% so với giá gốc`
              : "Giá tốt đang mở bán, có thể mua và kích hoạt ngay"}
          </span>
        </div>
      </div>

      <div className="vps-offer-spec-grid">
        {buildSpecRows(item).map((spec) => (
          <div key={spec.label} className="vps-offer-spec-pill">
            <spec.icon className="h-4 w-4" />
            <span>{spec.label}</span>
          </div>
        ))}
      </div>

      <div className="vps-offer-detail-grid">
        {detailRows.map((detail) => (
          <div key={detail.label} className="vps-offer-detail-card">
            <span className="vps-offer-detail-label">{detail.label}</span>
            <p className="vps-offer-detail-value">{detail.value}</p>
          </div>
        ))}
      </div>

      <div className="vps-offer-feature-list">
        {buildFeatureRows(item).map((feature) => (
          <div key={feature} className="vps-offer-feature-item">
            <Check className="h-4 w-4" />
            <span>{feature}</span>
          </div>
        ))}
      </div>

      <button type="button" className="vps-offer-buy-button" onClick={onBuy} disabled={disabled}>
        <span>{loading ? "Đang xử lý..." : buttonLabel}</span>
        <ArrowRight className="h-4 w-4" />
      </button>
    </article>
  );
}
