"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, RefreshCcw, ServerCog, X } from "lucide-react";
import { RemoteOs } from "@vps/lib/types";

type RebuildOsModalProps = {
  open: boolean;
  systems: RemoteOs[];
  selectedOsId: number;
  loading?: boolean;
  instanceTitle?: string | null;
  onSelect: (value: number) => void;
  onClose: () => void;
  onConfirm: () => void;
};

export function RebuildOsModal({
  open,
  systems,
  selectedOsId,
  loading = false,
  instanceTitle,
  onSelect,
  onClose,
  onConfirm,
}: RebuildOsModalProps) {
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

  if (!open || typeof document === "undefined") {
    return null;
  }

  const hasSystems = systems.length > 0;
  const selectedSystem =
    systems.find((system) => system.vncloud_os_id === selectedOsId) ?? systems[0] ?? null;
  const rebuildSteps = [
    "Chọn hệ điều hành muốn cài lại.",
    "Xác nhận để gửi lệnh rebuild lên nhà cung cấp.",
    "Theo dõi trạng thái VPS cho tới khi dashboard đồng bộ xong. Quá trình này có thể lâu hơn bật/tắt VPS vài phút.",
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[145] flex items-start justify-center overflow-y-auto overscroll-contain px-3 py-4 md:px-6 md:py-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rebuild-os-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#020617]/84 backdrop-blur-md"
        onClick={onClose}
        aria-label="Đóng đổi hệ điều hành"
      />

      <div className="vps-rebuild-modal-shell relative z-[1] flex max-h-[min(92dvh,900px)] w-full max-w-[min(92vw,880px)] min-h-0 flex-col overflow-hidden rounded-[34px] border border-white/10 bg-[var(--background)] shadow-[0_40px_120px_rgba(2,6,23,0.65)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-5 md:px-8 md:py-7">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
              <ServerCog className="h-3.5 w-3.5" />
              Cài đặt lại VPS
            </span>
            <h3
              id="rebuild-os-modal-title"
              className="mt-4 font-[family-name:var(--font-space-grotesk)] text-[1.8rem] font-semibold tracking-[-0.04em] text-[var(--foreground)] md:text-[2.2rem]"
            >
              Đổi hệ điều hành và cài lại VPS
            </h3>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)] md:text-base md:leading-8">
              {instanceTitle
                ? `Bạn đang thao tác với ${instanceTitle}.`
                : "Bạn đang thao tác với VPS đã mua."}{" "}
              Hệ thống sẽ gửi lệnh cài đặt lại trực tiếp lên nhà cung cấp với OS mới bạn chọn.
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

        <div className="vps-rebuild-modal-body min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-5 md:px-8 md:py-7">
          <div className="rounded-[28px] border border-[rgba(244,114,182,0.18)] bg-[rgba(244,114,182,0.08)] px-6 py-5 text-sm leading-7 text-[var(--foreground)]">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-pink-300" />
              <div>
                <p className="font-semibold">Lưu ý trước khi cài lại VPS</p>
                <p className="mt-2 text-[var(--muted)]">
                  Dữ liệu, cấu hình và thông tin đăng nhập hiện tại trên VPS có thể bị ghi đè sau
                  khi rebuild. Anh nên sao lưu trước khi xác nhận thao tác này.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                    Danh sách hệ điều hành
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Chọn OS mới rồi xác nhận để gửi lệnh `confirm-rebuild-vps`.
                  </p>
                </div>
                <span className="landing-mini-pill">{systems.length} lựa chọn</span>
              </div>

              {hasSystems ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {systems.map((system) => (
                    <button
                      key={system.vncloud_os_id}
                      type="button"
                      className="rounded-[24px] border px-5 py-4 text-left transition-all duration-300"
                      style={{
                        borderColor:
                          selectedOsId === system.vncloud_os_id
                            ? "rgba(0, 102, 255, 0.34)"
                            : "rgba(255, 255, 255, 0.1)",
                        background:
                          selectedOsId === system.vncloud_os_id
                            ? "linear-gradient(180deg, rgba(0,102,255,0.14), rgba(0,102,255,0.08))"
                            : "color-mix(in oklab, var(--background) 76%, white 10%)",
                      }}
                      onClick={() => onSelect(system.vncloud_os_id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-[var(--foreground)]">
                            {system.name}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                            {system.group_name || "Hệ điều hành triển khai"}
                          </p>
                        </div>
                        {selectedOsId === system.vncloud_os_id ? (
                          <span className="landing-mini-pill">Đang chọn</span>
                        ) : null}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-[24px] border border-white/10 bg-white/5 px-5 py-6 text-sm leading-7 text-[var(--muted)]">
                  Chưa tải được danh sách hệ điều hành. Vui lòng thử lại sau ít phút.
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="rounded-[26px] border border-white/10 bg-white/[0.03] px-5 py-5">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  OS đang chọn
                </p>
                <p className="mt-3 text-xl font-semibold text-[var(--foreground)]">
                  {selectedSystem?.name || "Chưa chọn hệ điều hành"}
                </p>
                <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                  {selectedSystem?.group_name || "Hệ điều hành sẽ được cài mới cho VPS này."}
                </p>
              </div>

              <div className="rounded-[26px] border border-white/10 bg-white/[0.03] px-5 py-5">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                  Quy trình sau khi xác nhận
                </p>
                <div className="mt-4 grid gap-3">
                  {rebuildSteps.map((step, index) => (
                    <div key={step} className="flex items-start gap-3 text-sm leading-7 text-[var(--foreground)]">
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[0.72rem] font-black text-slate-950">
                        0{index + 1}
                      </span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[26px] border border-[rgba(53,109,255,0.18)] bg-[rgba(53,109,255,0.08)] px-5 py-5 text-sm leading-7 text-[var(--muted)]">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-[#7aa0ff]" />
                  <p>
                    Sau khi rebuild hoàn tất, anh nên kiểm tra lại IP, user, mật khẩu và trạng thái
                    VPS trong dashboard trước khi đăng nhập lại.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-white/10 px-5 py-5 md:px-8 md:py-6">
          <button type="button" onClick={onClose} className="ghost-button">
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="action-button"
            disabled={loading || !hasSystems || !selectedOsId}
          >
            <RefreshCcw className="h-4 w-4" />
            {loading ? "Đang gửi lệnh..." : "Xác nhận cài lại OS"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
