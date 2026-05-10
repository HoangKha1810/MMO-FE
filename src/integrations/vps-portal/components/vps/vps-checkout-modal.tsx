"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  Clock3,
  HardDrive,
  MemoryStick,
  Minus,
  Plus,
  Server,
  ShoppingCart,
  WalletCards,
  X,
} from "lucide-react";
import { formatCurrency } from "@vps/lib/api";
import { formatBillingCycle } from "@vps/lib/portal";
import { siteConfig } from "@vps/lib/site";
import { CatalogItem, StoreSettings } from "@vps/lib/types";

type VpsCheckoutModalProps = {
  item: CatalogItem | null;
  settings: Pick<
    StoreSettings,
    "addon_cpu_price" | "addon_ram_price" | "addon_disk_price" | "addon_disk_step"
  >;
  open: boolean;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    acceptedPolicy: true;
    note?: string;
    quantity: number;
    customAddonCpu: number;
    customAddonRam: number;
    customAddonDisk: number;
  }) => void;
  onOpenPolicy: () => void;
};

function extractNumberFromLabel(value: string | null | undefined, fallback: number) {
  if (typeof value !== "string") {
    return fallback;
  }

  const matched = value.match(/(\d+(?:[.,]\d+)?)/);

  if (!matched) {
    return fallback;
  }

  const parsed = Number(matched[1].replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveBaseCpu(item: CatalogItem) {
  return Math.max(Number(item.addon_cpu ?? 0), extractNumberFromLabel(item.cpu_label, 1), 1);
}

function resolveBaseRam(item: CatalogItem) {
  return Math.max(Number(item.addon_ram ?? 0), extractNumberFromLabel(item.ram_label, 1), 1);
}

function resolveBaseDisk(item: CatalogItem) {
  return Math.max(Number(item.addon_disk ?? 0), extractNumberFromLabel(item.disk_label, 20), 20);
}

function resolveBillingMonths(item: CatalogItem | null) {
  const source = item?.billing_cycle_label || item?.billing_cycle_code || "";
  const matched = source.match(/(\d+)/);

  if (matched) {
    const parsed = Number(matched[1]);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return /year|nam/i.test(source) ? 12 : 1;
}

export function VpsCheckoutModal({
  item,
  settings,
  open,
  loading = false,
  onClose,
  onConfirm,
  onOpenPolicy,
}: VpsCheckoutModalProps) {
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [note, setNote] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [customAddonCpu, setCustomAddonCpu] = useState(0);
  const [customAddonRam, setCustomAddonRam] = useState(0);
  const [customAddonDisk, setCustomAddonDisk] = useState(0);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  const billingLabel = formatBillingCycle(item?.billing_cycle_label || item?.billing_cycle_code);
  const operatingSystemLabel = "Win/Linux/Tùy chỉnh theo nhu cầu";
  const hasComparePrice =
    typeof item?.compare_price === "number" && typeof item?.sale_price === "number"
      ? item.compare_price > item.sale_price
      : false;
  const diskStep = Math.max(Number(settings.addon_disk_step ?? 10), 1);
  const billingMonths = resolveBillingMonths(item);

  const baseConfig = useMemo(() => {
    if (!item) {
      return {
        cpu: 1,
        ram: 1,
        disk: 20,
      };
    }

    return {
      cpu: resolveBaseCpu(item),
      ram: resolveBaseRam(item),
      disk: resolveBaseDisk(item),
    };
  }, [item]);

  const unitAddonPrice =
    (customAddonCpu * Number(settings.addon_cpu_price ?? 0) +
      customAddonRam * Number(settings.addon_ram_price ?? 0) +
      (customAddonDisk / diskStep) * Number(settings.addon_disk_price ?? 0)) *
    billingMonths;
  const unitTotalPrice = Number(item?.sale_price ?? 0) + unitAddonPrice;
  const totalPrice = unitTotalPrice * quantity;
  const finalConfig = {
    cpu: baseConfig.cpu + customAddonCpu,
    ram: baseConfig.ram + customAddonRam,
    disk: baseConfig.disk + customAddonDisk,
  };

  const checkoutSteps = [
    "Trừ số dư và tạo đơn VPS trên hệ thống.",
    "Đẩy yêu cầu provision với cấu hình tổng đã chọn sang nhà cung cấp.",
    "Đồng bộ IP, user, mật khẩu và trạng thái về dashboard khi có phản hồi.",
  ];

  const pricingRows = [
    {
      key: "cpu",
      label: "CPU",
      price: Number(settings.addon_cpu_price ?? 0),
      quantityLabel: customAddonCpu > 0 ? `+${customAddonCpu}` : "0",
      total: customAddonCpu * Number(settings.addon_cpu_price ?? 0) * billingMonths,
      unitLabel: "/ 1 core",
    },
    {
      key: "ram",
      label: "RAM",
      price: Number(settings.addon_ram_price ?? 0),
      quantityLabel: customAddonRam > 0 ? `+${customAddonRam} GB` : "0",
      total: customAddonRam * Number(settings.addon_ram_price ?? 0) * billingMonths,
      unitLabel: "/ 1 GB",
    },
    {
      key: "disk",
      label: "Disk",
      price: Number(settings.addon_disk_price ?? 0),
      quantityLabel: customAddonDisk > 0 ? `+${customAddonDisk} GB` : "0",
      total:
        (customAddonDisk / diskStep) *
        Number(settings.addon_disk_price ?? 0) *
        billingMonths,
      unitLabel: `/ ${diskStep} GB`,
    },
  ];

  if (!open || !item) {
    return null;
  }

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto overscroll-contain px-3 py-3 md:px-6 md:py-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vps-checkout-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#020617]/80 backdrop-blur-md"
        onClick={onClose}
        aria-label="Đóng popup thanh toán"
      />

      <div className="vps-checkout-modal-shell relative z-[1] flex w-full max-w-5xl min-h-0 flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[var(--background)] shadow-[0_40px_120px_rgba(2,6,23,0.65)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-5 md:px-7">
          <div className="min-w-0">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
              Cấu hình tùy chọn
            </p>
            <h3
              id="vps-checkout-title"
              className="mt-3 font-[family-name:var(--font-space-grotesk)] text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]"
            >
              {item.title}
            </h3>
            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
              Tăng thêm CPU, RAM hoặc disk theo nhu cầu rồi xác nhận thanh toán ngay trong cùng một popup.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[var(--foreground)] transition hover:bg-white/10"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="vps-checkout-modal-body min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 md:px-7 md:py-6">
          <div className="vps-checkout-modal-grid grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
            <div className="space-y-4">
              <div className="rounded-[24px] border border-white/8 bg-white/[0.03] px-5 py-5">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                      Gói khởi tạo
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-[var(--foreground)]">
                      {formatCurrency(item.sale_price)}
                    </p>
                  </div>

                  <div className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                    {billingLabel}
                  </div>
                </div>

                {hasComparePrice ? (
                  <p className="mt-3 text-sm text-[var(--muted)]">
                    Giá trước ưu đãi:{" "}
                    <span className="font-semibold line-through">
                      {formatCurrency(item.compare_price ?? 0)}
                    </span>
                  </p>
                ) : null}

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[20px] border border-white/8 bg-white/[0.04] px-4 py-4">
                    <div className="flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                      <Clock3 className="h-3.5 w-3.5" />
                      Chu kỳ
                    </div>
                    <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                      {billingLabel}
                    </p>
                  </div>
                  <div className="rounded-[20px] border border-white/8 bg-white/[0.04] px-4 py-4">
                    <div className="flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                      <Server className="h-3.5 w-3.5" />
                      OS khởi tạo
                    </div>
                    <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                      {operatingSystemLabel}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[20px] border border-white/8 bg-white/[0.04] px-4 py-4">
                    <div className="flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                      <Server className="h-3.5 w-3.5" />
                      CPU gốc
                    </div>
                    <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                      {baseConfig.cpu} core
                    </p>
                  </div>
                  <div className="rounded-[20px] border border-white/8 bg-white/[0.04] px-4 py-4">
                    <div className="flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                      <MemoryStick className="h-3.5 w-3.5" />
                      RAM gốc
                    </div>
                    <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                      {baseConfig.ram} GB
                    </p>
                  </div>
                  <div className="rounded-[20px] border border-white/8 bg-white/[0.04] px-4 py-4">
                    <div className="flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                      <HardDrive className="h-3.5 w-3.5" />
                      Disk gốc
                    </div>
                    <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                      {baseConfig.disk} GB
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-white/8 bg-white/[0.03] px-5 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                      Addon mua thêm
                    </p>
                    <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                      Khách có thể tăng cấu hình ngay lúc mua. Disk được cộng theo từng nấc {diskStep} GB.
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <div className="rounded-[22px] border border-white/8 bg-white/[0.04] px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[var(--foreground)]">CPU</p>
                      <span className="text-xs text-[var(--muted)]">
                        {formatCurrency(settings.addon_cpu_price)} / core / tháng
                      </span>
                    </div>
                    <div className="mt-4 flex items-center overflow-hidden rounded-[16px] border border-white/10 bg-white/[0.04]">
                      <button
                        type="button"
                        className="inline-flex h-11 w-11 items-center justify-center text-[var(--foreground)] transition hover:bg-white/10 disabled:opacity-40"
                        onClick={() => setCustomAddonCpu((current) => Math.max(0, current - 1))}
                        disabled={loading || customAddonCpu === 0}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <div className="flex-1 text-center text-sm font-semibold text-[var(--foreground)]">
                        +{customAddonCpu}
                      </div>
                      <button
                        type="button"
                        className="inline-flex h-11 w-11 items-center justify-center text-[var(--foreground)] transition hover:bg-white/10"
                        onClick={() => setCustomAddonCpu((current) => current + 1)}
                        disabled={loading}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-white/8 bg-white/[0.04] px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[var(--foreground)]">RAM</p>
                      <span className="text-xs text-[var(--muted)]">
                        {formatCurrency(settings.addon_ram_price)} / GB / tháng
                      </span>
                    </div>
                    <div className="mt-4 flex items-center overflow-hidden rounded-[16px] border border-white/10 bg-white/[0.04]">
                      <button
                        type="button"
                        className="inline-flex h-11 w-11 items-center justify-center text-[var(--foreground)] transition hover:bg-white/10 disabled:opacity-40"
                        onClick={() => setCustomAddonRam((current) => Math.max(0, current - 1))}
                        disabled={loading || customAddonRam === 0}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <div className="flex-1 text-center text-sm font-semibold text-[var(--foreground)]">
                        +{customAddonRam} GB
                      </div>
                      <button
                        type="button"
                        className="inline-flex h-11 w-11 items-center justify-center text-[var(--foreground)] transition hover:bg-white/10"
                        onClick={() => setCustomAddonRam((current) => current + 1)}
                        disabled={loading}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-white/8 bg-white/[0.04] px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[var(--foreground)]">Disk</p>
                      <span className="text-xs text-[var(--muted)]">
                        {formatCurrency(settings.addon_disk_price)} / {diskStep} GB / tháng
                      </span>
                    </div>
                    <div className="mt-4 flex items-center overflow-hidden rounded-[16px] border border-white/10 bg-white/[0.04]">
                      <button
                        type="button"
                        className="inline-flex h-11 w-11 items-center justify-center text-[var(--foreground)] transition hover:bg-white/10 disabled:opacity-40"
                        onClick={() =>
                          setCustomAddonDisk((current) => Math.max(0, current - diskStep))
                        }
                        disabled={loading || customAddonDisk === 0}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <div className="flex-1 text-center text-sm font-semibold text-[var(--foreground)]">
                        +{customAddonDisk} GB
                      </div>
                      <button
                        type="button"
                        className="inline-flex h-11 w-11 items-center justify-center text-[var(--foreground)] transition hover:bg-white/10"
                        onClick={() => setCustomAddonDisk((current) => current + diskStep)}
                        disabled={loading}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[18px] border border-[rgba(53,109,255,0.2)] bg-[rgba(53,109,255,0.09)] px-4 py-4">
                    <span className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                      CPU sau custom
                    </span>
                    <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                      {finalConfig.cpu} core
                    </p>
                  </div>
                  <div className="rounded-[18px] border border-[rgba(53,109,255,0.2)] bg-[rgba(53,109,255,0.09)] px-4 py-4">
                    <span className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                      RAM sau custom
                    </span>
                    <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                      {finalConfig.ram} GB
                    </p>
                  </div>
                  <div className="rounded-[18px] border border-[rgba(53,109,255,0.2)] bg-[rgba(53,109,255,0.09)] px-4 py-4">
                    <span className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                      Disk sau custom
                    </span>
                    <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                      {finalConfig.disk} GB
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-white/8 bg-white/[0.03] px-5 py-5">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                  Sau khi xác nhận
                </p>
                <div className="mt-3 grid gap-3">
                  {checkoutSteps.map((step, index) => (
                    <div key={step} className="flex items-start gap-3 text-sm leading-7 text-[var(--foreground)]">
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[0.72rem] font-black text-slate-950">
                        0{index + 1}
                      </span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[24px] border border-white/8 bg-white/[0.03] px-5 py-5">
                <span className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                  Số lượng
                </span>
                <div className="mt-3 flex items-center overflow-hidden rounded-[18px] border border-white/10 bg-white/[0.04]">
                  <button
                    type="button"
                    className="inline-flex h-12 w-12 items-center justify-center text-[var(--foreground)] transition hover:bg-white/10 disabled:opacity-40"
                    onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                    disabled={loading || quantity === 1}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <div className="flex-1 text-center text-sm font-semibold text-[var(--foreground)]">
                    {quantity}
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-12 w-12 items-center justify-center text-[var(--foreground)] transition hover:bg-white/10 disabled:opacity-40"
                    onClick={() => setQuantity((current) => Math.min(5, current + 1))}
                    disabled={loading || quantity === 5}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-2 text-xs leading-6 text-[var(--muted)]">
                  Mỗi đơn hiện cho phép mua tối đa 5 VPS cùng một cấu hình.
                </p>
              </div>

              <label className="block rounded-[24px] border border-white/8 bg-white/[0.03] px-5 py-5">
                <span className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                  Ghi chú đơn hàng
                </span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Ví dụ: cần hệ điều hành cụ thể, ghi chú bàn giao hoặc lưu ý kỹ thuật."
                  className="textarea-shell mt-3 min-h-28 resize-none"
                  maxLength={400}
                />
              </label>

              <div className="rounded-[24px] border border-white/8 bg-white/[0.03] px-5 py-5">
                <div className="flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                  <WalletCards className="h-3.5 w-3.5" />
                  Tóm tắt thanh toán
                </div>
                <p className="mt-3 text-xs leading-6 text-[var(--muted)]">
                  Giá addon đang tính theo chu kỳ {billingLabel.toLowerCase()}.
                </p>

                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[var(--muted)]">Gói gốc / 1 VPS</span>
                    <strong className="text-[var(--foreground)]">{formatCurrency(item.sale_price)}</strong>
                  </div>
                  {pricingRows.map((row) => (
                    <div key={row.key} className="flex items-center justify-between gap-4">
                      <div>
                      <span className="text-[var(--muted)]">
                        {row.label} {row.unitLabel}
                      </span>
                        <p className="text-xs text-[var(--muted)]">{row.quantityLabel}</p>
                      </div>
                      <strong className="text-[var(--foreground)]">{formatCurrency(row.total)}</strong>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-4 border-t border-white/8 pt-3">
                    <span className="text-[var(--muted)]">Đơn giá sau custom / 1 VPS</span>
                    <strong className="text-[var(--foreground)]">{formatCurrency(unitTotalPrice)}</strong>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[var(--muted)]">Số lượng</span>
                    <strong className="text-[var(--foreground)]">x{quantity}</strong>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-white/8 pt-3 text-base">
                    <span className="font-semibold text-[var(--foreground)]">Tổng cộng</span>
                    <strong className="text-xl font-semibold text-[#7da7ff]">{formatCurrency(totalPrice)}</strong>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-white/8 bg-white/[0.03] px-5 py-5">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                  Cấu hình sẽ tạo
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-[var(--foreground)]">
                    {finalConfig.cpu} core
                  </span>
                  <span className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-[var(--foreground)]">
                    {finalConfig.ram} GB RAM
                  </span>
                  <span className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-[var(--foreground)]">
                    {finalConfig.disk} GB SSD
                  </span>
                  <span className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-[var(--foreground)]">
                    {item.bandwidth_label || "Network 100 Mb/10 Mb"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border border-[rgba(53,109,255,0.22)] bg-[rgba(53,109,255,0.08)] px-5 py-4">
            <div className="flex items-start gap-3">
              <input
                id="vps-policy-accept"
                type="checkbox"
                checked={acceptedPolicy}
                onChange={(event) => setAcceptedPolicy(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent accent-[#356dff]"
              />

              <div className="min-w-0">
                <label
                  htmlFor="vps-policy-accept"
                  className="text-sm leading-7 text-[var(--muted)]"
                >
                  Tôi đã đọc và đồng ý với{" "}
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onOpenPolicy();
                    }}
                    className="font-semibold text-[var(--foreground)] underline decoration-2 underline-offset-4"
                  >
                    <strong>Chính sách</strong>
                  </button>{" "}
                  dịch vụ VPS của {siteConfig.name}.
                </label>
                <p className="mt-1 text-xs leading-6 text-[var(--muted)]">
                  Đây là bước bắt buộc. Hệ thống chỉ cho phép đặt mua khi bạn đã xác nhận chính sách.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white/8 bg-white/[0.03] px-5 py-4">
            <div className="flex items-center gap-3 text-sm text-[var(--muted)]">
              <CheckCircle2 className="h-4 w-4 text-[#4f7cf3]" />
              <span>Đơn hàng sẽ được xử lý tự động sau khi thanh toán thành công.</span>
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={onClose} className="ghost-button">
                Đóng
              </button>
              <button
                type="button"
                onClick={() =>
                  onConfirm({
                    acceptedPolicy: true,
                    note: note.trim() || undefined,
                    quantity,
                    customAddonCpu,
                    customAddonRam,
                    customAddonDisk,
                  })
                }
                className="action-button"
                disabled={loading || !acceptedPolicy}
              >
                <ShoppingCart className="h-4 w-4" />
                {loading ? "Đang xử lý..." : `Xác nhận mua ${formatCurrency(totalPrice)}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
