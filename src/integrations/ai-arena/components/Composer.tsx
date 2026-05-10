import { motion } from "framer-motion";
import {
  Globe2,
  Languages,
  LoaderCircle,
  Paperclip,
  SendHorizonal,
  Square,
  Sparkles,
  X
} from "lucide-react";
import { useEffect, useRef } from "react";
import { ArenaMode, UploadedAsset } from "../lib/types";

interface ComposerProps {
  mode: ArenaMode;
  value: string;
  disabled: boolean;
  requiresUpgrade?: boolean;
  uploadRequiresUpgrade?: boolean;
  imageRequiresUpgrade?: boolean;
  translatorRequiresUpgrade?: boolean;
  webSearchRequiresUpgrade?: boolean;
  sending: boolean;
  stopping: boolean;
  canStop: boolean;
  uploading: boolean;
  expanded: boolean;
  useWebSearch: boolean;
  attachments: UploadedAsset[];
  onChange: (value: string) => void;
  onSubmit: () => void;
  onUploadFiles: (files: FileList | File[]) => Promise<void>;
  onRemoveAttachment: (assetId: string) => void;
  onToggleWebSearch: () => void;
  onOpenImageTool: () => void;
  onOpenTranslatorTool: () => void;
  onOpenUpgrade?: () => void;
  onStop: () => Promise<void> | void;
}

const placeholders: Record<ArenaMode, string> = {
  battle: "Nhập nội dung để so sánh nhiều model cùng lúc...",
  "side-by-side": "Nhập nội dung để đặt hai câu trả lời cạnh nhau...",
  direct: "Hỏi bất kỳ điều gì hoặc nhập phần việc bạn muốn xử lý..."
};

export function Composer({
  mode,
  value,
  disabled,
  requiresUpgrade = false,
  uploadRequiresUpgrade = false,
  imageRequiresUpgrade = false,
  translatorRequiresUpgrade = false,
  webSearchRequiresUpgrade = false,
  sending,
  stopping,
  canStop,
  uploading,
  expanded,
  useWebSearch,
  attachments,
  onChange,
  onSubmit,
  onUploadFiles,
  onRemoveAttachment,
  onToggleWebSearch,
  onOpenImageTool,
  onOpenTranslatorTool,
  onOpenUpgrade,
  onStop
}: ComposerProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canUseWebSearch = mode === "direct";
  const webSearchActive = canUseWebSearch && useWebSearch;
  const webSearchDisabled = disabled || !canUseWebSearch || webSearchRequiresUpgrade;
  const webSearchTitle = webSearchRequiresUpgrade
    ? "Gói Free cần nâng cấp để dùng chức năng này"
    : canUseWebSearch
    ? useWebSearch
      ? "Tắt search web"
      : "Bật search web"
    : "Search web chỉ hỗ trợ trò chuyện 1 nguồn";

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    ref.current.style.height = "0px";
    const maxHeight = expanded ? 120 : 210;
    ref.current.style.height = `${Math.min(ref.current.scrollHeight, maxHeight)}px`;
  }, [expanded, value]);

  return (
    <motion.section
      className={`composer ${expanded ? "is-expanded" : "is-hero"}`}
      layout={false}
      transition={{ type: "spring", stiffness: 170, damping: 24 }}
    >
      {attachments.length > 0 && (
        <div className="composer-attachments">
          {attachments.map((asset) => (
            <div key={asset.id} className="composer-attachment-chip">
              <span>{asset.fileName}</span>
              <button type="button" onClick={() => onRemoveAttachment(asset.id)}>
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="composer__body">
        <div className="composer-input-shell">
          <textarea
            ref={ref}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={
              requiresUpgrade
                ? "Gói Free cần nâng cấp để tiếp tục dùng chat AI..."
                : placeholders[mode]
            }
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSubmit();
              }
            }}
            disabled={disabled || requiresUpgrade}
          />

          <button
            className="send-button"
            type="button"
            onClick={() => {
              if (requiresUpgrade) {
                onOpenUpgrade?.();
                return;
              }
              if (canStop) {
                void onStop();
                return;
              }
              onSubmit();
            }}
            disabled={canStop ? stopping : disabled || requiresUpgrade || !value.trim()}
            aria-label={
              requiresUpgrade
                ? "Mở trang nâng cấp"
                : canStop
                ? stopping
                  ? "Đang dừng phản hồi"
                  : "Dừng phản hồi"
                : sending
                  ? "Đang gửi"
                  : "Gửi nội dung"
            }
            title={
              requiresUpgrade
                ? "Mở trang nâng cấp"
                : canStop
                ? stopping
                  ? "Đang dừng phản hồi"
                  : "Dừng phản hồi"
                : sending
                  ? "Đang gửi"
                  : "Gửi nội dung"
            }
          >
            {canStop ? (
              stopping ? <LoaderCircle className="spin" size={16} /> : <Square size={13} fill="currentColor" />
            ) : sending ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <SendHorizonal size={15} />
            )}
          </button>
        </div>

        <div className="composer-toolbar">
          <div className="composer-toolbar__actions">
            <button
              type="button"
              className={`composer-utility-button ${webSearchActive ? "active" : ""}`}
              onClick={() => {
                if (webSearchRequiresUpgrade) {
                  onOpenUpgrade?.();
                  return;
                }
                onToggleWebSearch();
              }}
              disabled={webSearchDisabled}
              aria-label={webSearchTitle}
              aria-pressed={webSearchActive}
              title={webSearchTitle}
            >
              <Globe2 size={13} />
            </button>

            <button
              type="button"
              className="composer-utility-button"
              onClick={() => {
                if (imageRequiresUpgrade) {
                  onOpenUpgrade?.();
                  return;
                }
                onOpenImageTool();
              }}
              aria-label="Mở bộ tạo hình ảnh"
              title={imageRequiresUpgrade ? "Gói hiện tại cần nâng cấp để dùng chức năng này" : "Mở bộ tạo hình ảnh"}
            >
              <Sparkles size={13} />
            </button>

            <button
              type="button"
              className="composer-utility-button"
              onClick={() => {
                if (translatorRequiresUpgrade) {
                  onOpenUpgrade?.();
                  return;
                }
                onOpenTranslatorTool();
              }}
              aria-label="Mở AI biên dịch viên"
              title={translatorRequiresUpgrade ? "Gói hiện tại cần nâng cấp để dùng chức năng này" : "Mở AI biên dịch viên"}
            >
              <Languages size={13} />
            </button>

            <span className="composer-toolbar__divider" aria-hidden="true" />

            <button
              type="button"
              className="composer-utility-button composer-utility-button--ghost"
              onClick={() => {
                if (uploadRequiresUpgrade) {
                  onOpenUpgrade?.();
                  return;
                }
                fileInputRef.current?.click();
              }}
              disabled={disabled || uploading || uploadRequiresUpgrade}
              aria-label="Đính kèm ảnh hoặc tài liệu"
              title={
                uploadRequiresUpgrade
                  ? "Gói Free cần nâng cấp để dùng chức năng này"
                  : "Đính kèm ảnh hoặc tài liệu"
              }
            >
              {uploading ? <LoaderCircle className="spin" size={13} /> : <Paperclip size={13} />}
            </button>
          </div>

          <div className="composer__footer-hint">
            {webSearchActive
              ? "Search web đang bật • Enter để gửi • Shift + Enter để xuống dòng"
              : requiresUpgrade
                ? "Gói Free cần nâng cấp để dùng chat và công cụ AI"
                : "Enter để gửi • Shift + Enter để xuống dòng"}
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        hidden
        multiple
        accept="image/*,.pdf,.txt,.md,.json,.csv,.doc,.docx"
        onChange={(event) => {
          const files = event.target.files;
          if (files?.length) {
            void onUploadFiles(files);
          }
          event.currentTarget.value = "";
        }}
      />
    </motion.section>
  );
}
