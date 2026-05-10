"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, RefreshCcw, ShieldAlert, X } from "lucide-react";

type ConfirmModalProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  variant?: "warning" | "danger" | "info";
  highlights?: string[];
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  variant = "warning",
  highlights = [],
  loading = false,
  onClose,
  onConfirm,
}: ConfirmModalProps) {
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

  if (!open) {
    return null;
  }

  if (typeof document === "undefined") {
    return null;
  }

  const variantConfig = {
    warning: {
      icon: AlertTriangle,
      badge: "Xác nhận thao tác",
      panelClass: "border-[rgba(245,158,11,0.22)] bg-[rgba(245,158,11,0.08)]",
      iconClass: "text-amber-300",
    },
    danger: {
      icon: ShieldAlert,
      badge: "Thao tác nhạy cảm",
      panelClass: "border-[rgba(239,68,68,0.22)] bg-[rgba(239,68,68,0.08)]",
      iconClass: "text-rose-300",
    },
    info: {
      icon: RefreshCcw,
      badge: "Kiểm tra trước khi tiếp tục",
      panelClass: "border-[rgba(53,109,255,0.22)] bg-[rgba(53,109,255,0.08)]",
      iconClass: "text-[#7aa0ff]",
    },
  }[variant];
  const VariantIcon = variantConfig.icon;

  return createPortal(
    <div
      className="fixed inset-0 z-[145] flex items-start justify-center overflow-y-auto overscroll-contain px-3 py-4 md:px-6 md:py-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#020617]/82 backdrop-blur-md"
        onClick={onClose}
        aria-label="Đóng xác nhận"
      />

      <div className="relative z-[1] flex max-h-[min(92dvh,760px)] w-full max-w-lg min-h-0 flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[var(--background)] shadow-[0_40px_120px_rgba(2,6,23,0.65)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-5 md:px-7">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
              <VariantIcon className={`h-3.5 w-3.5 ${variantConfig.iconClass}`} />
              {variantConfig.badge}
            </span>
            <h3
              id="confirm-modal-title"
              className="mt-4 font-[family-name:var(--font-space-grotesk)] text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]"
            >
              {title}
            </h3>
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

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 md:px-7 md:py-6">
          <div className={`rounded-[26px] border px-5 py-5 text-sm leading-7 text-[var(--muted)] ${variantConfig.panelClass}`}>
            <div className="flex items-start gap-3">
              <VariantIcon className={`mt-1 h-5 w-5 shrink-0 ${variantConfig.iconClass}`} />
              <p>{message}</p>
            </div>
          </div>

          {highlights.length ? (
            <div className="grid gap-3">
              {highlights.map((item) => (
                <div
                  key={item}
                  className="rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-4 text-sm leading-7 text-[var(--foreground)]"
                >
                  {item}
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" onClick={onClose} className="ghost-button">
              Hủy
            </button>
            <button type="button" onClick={onConfirm} className="action-button" disabled={loading}>
              {loading ? "Đang xử lý..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
