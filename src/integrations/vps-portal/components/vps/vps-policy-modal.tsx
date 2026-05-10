"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ShieldCheck, X } from "lucide-react";
import { siteConfig } from "@vps/lib/site";
import { VPS_POLICY_VERSION, vpsPolicySections } from "@vps/lib/vps-policy";

type VpsPolicyModalProps = {
  open: boolean;
  onClose: () => void;
};

export function VpsPolicyModal({ open, onClose }: VpsPolicyModalProps) {
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

  return createPortal(
    <div
      className="fixed inset-0 z-[140] flex items-start justify-center overflow-y-auto overscroll-contain px-3 py-3 md:px-6 md:py-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vps-policy-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#020617]/82 backdrop-blur-md"
        onClick={onClose}
        aria-label="Đóng popup chính sách"
      />

      <div className="vps-policy-modal-shell relative z-[1] flex max-h-[min(94dvh,980px)] w-full max-w-[min(96vw,1380px)] min-h-0 flex-col overflow-hidden rounded-[34px] border border-white/10 bg-[var(--background)] shadow-[0_40px_120px_rgba(2,6,23,0.65)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-5 md:px-8 md:py-7">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.26em] text-[var(--muted)]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Chính sách dịch vụ
            </span>
            <h2
              id="vps-policy-title"
              className="mt-4 font-[family-name:var(--font-space-grotesk)] text-[1.9rem] font-semibold tracking-[-0.04em] text-[var(--foreground)] md:text-[2.45rem]"
            >
              CHÍNH SÁCH &amp; ĐIỀU KHOẢN VPS
            </h2>
            <p className="mt-3 max-w-4xl text-sm leading-7 text-[var(--muted)] md:text-base md:leading-8">
              Áp dụng cho dịch vụ VPS được đăng ký và quản lý trên {siteConfig.name}. Nội
              dung bên dưới là bản điều chỉnh phù hợp với thương hiệu và mô hình dịch vụ VPS của
              chúng tôi.
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

        <div className="vps-policy-modal-body min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 md:px-8 md:py-7">
          <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
            <div className="space-y-6">
              <div className="rounded-[28px] border border-[rgba(53,109,255,0.22)] bg-[rgba(53,109,255,0.08)] px-6 py-6 text-sm leading-7 text-[var(--foreground)] md:px-7 md:py-7 md:text-base md:leading-8">
                <p className="font-[family-name:var(--font-space-grotesk)] text-xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                  Tóm tắt nhanh
                </p>
                <p className="mt-3 text-[var(--muted)]">
                  Bằng việc đặt mua VPS trên {siteConfig.name}, khách hàng đồng ý sử dụng dịch vụ
                  đúng pháp luật, tự bảo mật tài khoản quản trị, tuân thủ điều kiện hoàn tiền và
                  gửi khiếu nại qua các kênh hỗ trợ chính thức khi cần xử lý sự cố.
                </p>
              </div>

              <div className="rounded-[26px] border border-white/8 bg-white/[0.03] px-6 py-5 text-sm leading-7 text-[var(--muted)] md:px-7 md:text-base md:leading-8">
                <p className="font-[family-name:var(--font-space-grotesk)] text-lg font-semibold text-[var(--foreground)]">
                  Phạm vi áp dụng
                </p>
                <p className="mt-3">
                  Các điều khoản này áp dụng cho toàn bộ dịch vụ VPS được đăng ký, gia hạn, sử
                  dụng và quản lý trên hệ thống {siteConfig.name}.
                </p>
                <div className="mt-5 rounded-[20px] border border-white/8 bg-white/[0.03] px-4 py-4 text-xs leading-6 text-[var(--muted)] md:text-sm">
                  Phiên bản áp dụng:{" "}
                  <strong className="text-[var(--foreground)]">{VPS_POLICY_VERSION}</strong>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {vpsPolicySections.map((section) => (
                <section
                  key={section.id}
                  className="rounded-[30px] border border-white/8 bg-white/[0.03] px-6 py-6 md:px-7 md:py-7"
                >
                  <h3 className="font-[family-name:var(--font-space-grotesk)] text-[1.35rem] font-semibold tracking-[-0.03em] text-[var(--foreground)] md:text-[1.55rem]">
                    {section.title}
                  </h3>

                  <div className="mt-4 space-y-3 text-sm leading-7 text-[var(--muted)] md:text-base md:leading-8">
                    {section.paragraphs.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>

                  {section.bullets?.length ? (
                    <ul className="mt-5 space-y-3 pl-5 text-sm leading-7 text-[var(--muted)] marker:text-[var(--brand-solid)] md:text-base md:leading-8">
                      {section.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
