"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Info, LifeBuoy, TriangleAlert, Wrench, X } from "lucide-react";

type NoticeModalProps = {
  open: boolean;
  title: string;
  message: string;
  variant?: "info" | "success" | "warning";
  highlights?: string[];
  supportLink?: string | null;
  onClose: () => void;
};

export function NoticeModal({
  open,
  title,
  message,
  variant = "info",
  highlights = [],
  supportLink,
  onClose,
}: NoticeModalProps) {
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
    info: {
      icon: Info,
      badge: "Thông báo hệ thống",
      panelClass: "border-[rgba(53,109,255,0.22)] bg-[rgba(53,109,255,0.08)]",
      iconClass: "text-[#7aa0ff]",
    },
    success: {
      icon: CheckCircle2,
      badge: "Thao tác thành công",
      panelClass: "border-[rgba(34,197,94,0.22)] bg-[rgba(34,197,94,0.08)]",
      iconClass: "text-emerald-300",
    },
    warning: {
      icon: TriangleAlert,
      badge: "Cần lưu ý",
      panelClass: "border-[rgba(245,158,11,0.22)] bg-[rgba(245,158,11,0.08)]",
      iconClass: "text-amber-300",
    },
  }[variant];
  const VariantIcon = variantConfig.icon;

  return createPortal(
    <div
      className="fixed inset-0 z-[145] flex items-start justify-center overflow-y-auto overscroll-contain px-3 py-4 md:px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notice-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#020617]/82 backdrop-blur-md"
        onClick={onClose}
        aria-label="Đóng thông báo"
      />

      <div className="relative z-[1] flex max-h-[min(92dvh,860px)] w-full max-w-[min(92vw,920px)] min-h-0 flex-col overflow-hidden rounded-[34px] border border-white/10 bg-[var(--background)] shadow-[0_40px_120px_rgba(2,6,23,0.65)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-5 md:px-8 md:py-7">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
              <Wrench className="h-3.5 w-3.5" />
              {variantConfig.badge}
            </span>
            <h3
              id="notice-modal-title"
              className="mt-4 font-[family-name:var(--font-space-grotesk)] text-[1.9rem] font-semibold tracking-[-0.04em] text-[var(--foreground)] md:text-[2.35rem]"
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

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-5 md:px-8 md:py-7">
          <div
            className={`rounded-[28px] border px-6 py-6 text-sm leading-7 text-[var(--muted)] md:px-7 md:py-7 md:text-base md:leading-8 ${variantConfig.panelClass}`}
          >
            <div className="flex items-start gap-3">
              <VariantIcon className={`mt-1 h-5 w-5 shrink-0 ${variantConfig.iconClass}`} />
              <p>{message}</p>
            </div>
          </div>

          {highlights.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {highlights.map((item) => (
                <div
                  key={item}
                  className="rounded-[22px] border border-white/8 bg-white/[0.03] px-5 py-4 text-sm leading-7 text-[var(--foreground)]"
                >
                  {item}
                </div>
              ))}
            </div>
          ) : null}

          {supportLink ? (
            <div className="rounded-[24px] border border-white/8 bg-white/[0.03] px-5 py-4 text-sm leading-7 text-[var(--muted)]">
              Nếu cần hỗ trợ thêm hoặc trạng thái chậm đồng bộ, anh có thể liên hệ admin để được
              kiểm tra trực tiếp.
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" onClick={onClose} className="ghost-button">
              Đóng
            </button>
            {supportLink ? (
              <a href={supportLink} target="_blank" rel="noreferrer" className="action-button">
                <LifeBuoy className="h-4 w-4" />
                Liên hệ admin
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
