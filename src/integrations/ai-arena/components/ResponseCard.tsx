import type { CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Check,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  Expand,
  LoaderCircle,
  Minimize2,
  RotateCcw
} from "lucide-react";
import { useState } from "react";
import { ModelInfo, TurnResult } from "../lib/types";
import { formatResponseTime } from "../lib/utils";
import { AnimatedMarkdown } from "./AnimatedMarkdown";
import { GradientLoader } from "./GradientLoader";
import { ModelDropdown } from "./ModelDropdown";
import { ModelAvatarMark } from "./ModelAvatarMark";

interface ResponseCardProps {
  result: TurnResult;
  revealed: boolean;
  allowRegenerate?: boolean;
  onRegenerate?: () => Promise<void> | void;
  modelPicker?: {
    model: ModelInfo | null;
    models: ModelInfo[];
    onChange?: (modelId: string) => void;
    placeholderLabel?: string;
  };
}

const copyToClipboard = async (value: string) => {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
};

export function ResponseCard({
  result,
  revealed: _revealed,
  allowRegenerate = false,
  onRegenerate,
  modelPicker
}: ResponseCardProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const label = result.realLabel || result.displayLabel;
  const webSources = result.webSources ?? [];
  const metaLabel = result.responseMs
    ? `${result.providerLabel} • ${formatResponseTime(result.responseMs)}`
    : result.isStreaming
      ? result.statusText || "Đang xử lý"
      : result.providerLabel;

  const handleCopy = async () => {
    const ok = await copyToClipboard(result.content);
    if (!ok) {
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const getSourceHost = (value: string) => {
    try {
      return new URL(value).hostname.replace(/^www\./, "");
    } catch {
      return value;
    }
  };

  const handleExportPdf = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({
      unit: "pt",
      format: "a4"
    });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const lines = doc.splitTextToSize(result.content || result.error || "", 520);
    doc.text(lines, 40, 56);
    doc.save(`${label}.pdf`);
  };

  const handleRegenerate = async () => {
    if (!onRegenerate) {
      return;
    }
    setRegenerating(true);
    try {
      await onRegenerate();
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <>
      <article
        className={`response-card ${result.isStreaming ? "is-streaming" : ""}`}
        style={{ "--card-accent": result.accent } as CSSProperties}
      >
        <div className="response-card__header">
          <div className="response-card__header-main">
            {modelPicker ? (
              <ModelDropdown
                model={modelPicker.model}
                models={modelPicker.models}
                onChange={modelPicker.onChange}
                placeholderLabel={modelPicker.placeholderLabel}
                placeholderMeta="Đổi model cho khung này"
                metaText={metaLabel}
                ariaLabel={`Chọn model cho ${modelPicker.placeholderLabel ?? label}`}
                variant="card-header"
              />
            ) : (
              <div>
                <div className="response-card__label">
                  <ModelAvatarMark
                    modelId={result.modelId}
                    label={label}
                    providerLabel={result.providerLabel}
                    accent={result.accent}
                    size={14}
                    className="response-card__mark"
                    alt={`${label} logo`}
                  />
                  {label}
                </div>
                <div className="response-card__meta">
                  <span>{result.providerLabel}</span>
                  <span>{result.responseMs ? formatResponseTime(result.responseMs) : "Đang xử lý"}</span>
                </div>
              </div>
            )}
          </div>
          {result.isStreaming ? (
            <span className="response-card__badge">
              <LoaderCircle size={14} className="spin" />
              {result.statusText || "Đang trả lời"}
            </span>
          ) : result.finishReason === "stopped" ? (
            <span className="response-card__badge muted">
              <AlertCircle size={14} />
              Đã dừng
            </span>
          ) : result.finishReason === "length" ? (
            <span className="response-card__badge muted">
              <Clock3 size={14} />
              Bị cắt ngắn
            </span>
          ) : result.error ? (
            <span className="response-card__badge muted">
              <AlertCircle size={14} />
              Cần thử lại
            </span>
        ) : null}
        </div>

        <div className="response-card__scroll">
          {result.error ? (
            <div className="response-card__error">
              <AlertCircle size={16} />
              <span>{result.error}</span>
            </div>
          ) : (
            <div className="markdown-body">
              <AnimatedMarkdown content={result.content} animate={!result.isStreaming} />
            </div>
          )}

          {webSources.length > 0 && !result.isStreaming && (
            <div className="response-card__sources">
              <div className="response-card__sources-head">Nguồn Search Web</div>
              <div className="response-card__sources-list">
                {webSources.map((source, index) => (
                  <a
                    key={`${source.url}-${index}`}
                    className="response-card__source"
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    title={source.url}
                  >
                    <div className="response-card__source-title">
                      <span>{source.title || getSourceHost(source.url)}</span>
                      <ExternalLink size={12} />
                    </div>
                    <div className="response-card__source-meta">{getSourceHost(source.url)}</div>
                    {source.snippet ? (
                      <div className="response-card__source-snippet">{source.snippet}</div>
                    ) : null}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="response-card__actions">
            {!result.error && (
              <>
                <button
                  type="button"
                  className={`response-action response-action--icon ${copied ? "copied" : ""}`}
                  onClick={() => void handleCopy()}
                  aria-label={copied ? "Đã sao chép" : "Sao chép"}
                  title={copied ? "Đã sao chép" : "Sao chép"}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>

                <button
                  type="button"
                  className="response-action response-action--icon"
                  onClick={() => setExpanded(true)}
                  aria-label="Mở rộng"
                  title="Mở rộng"
                >
                  <Expand size={14} />
                </button>

                {allowRegenerate && onRegenerate && !result.isStreaming && (
                  <button
                    type="button"
                    className="response-action response-action--icon"
                    onClick={() => void handleRegenerate()}
                    disabled={regenerating}
                    aria-label={result.error ? "Thử lại" : "Tạo lại"}
                    title={result.error ? "Thử lại" : "Tạo lại"}
                  >
                    {regenerating ? (
                      <LoaderCircle size={14} className="spin" />
                    ) : (
                      <RotateCcw size={14} />
                    )}
                  </button>
                )}
              </>
            )}
          </div>

          <div className="response-card__footer">
            {result.statusText && result.isStreaming ? result.statusText : result.providerLabel}
          </div>
        </div>
      </article>

      <AnimatePresence>
        {expanded && (
          <motion.div
            className="response-preview-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setExpanded(false)}
          >
            <motion.div
              className="response-preview-card"
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.99 }}
              transition={{ type: "spring", stiffness: 220, damping: 24 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="response-preview-card__header">
                <div>
                  <strong>{label}</strong>
                  <span>
                    {result.providerLabel} • {result.responseMs ? formatResponseTime(result.responseMs) : "Đang xử lý"}
                  </span>
                </div>

                <div className="response-preview-card__actions">
                  <button
                    type="button"
                    className={`response-action response-action--icon ${copied ? "copied" : ""}`}
                    onClick={() => void handleCopy()}
                    aria-label={copied ? "Đã sao chép" : "Sao chép"}
                    title={copied ? "Đã sao chép" : "Sao chép"}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                  <button
                    type="button"
                    className="response-action response-action--icon"
                    onClick={() => void handleExportPdf()}
                    aria-label="Xuất PDF"
                    title="Xuất PDF"
                  >
                    <Download size={14} />
                  </button>
                  <button
                    type="button"
                    className="response-action response-action--icon"
                    onClick={() => setExpanded(false)}
                    aria-label="Thu gọn"
                    title="Thu gọn"
                  >
                    <Minimize2 size={14} />
                  </button>
                </div>
              </div>

              <div className="response-preview-card__body markdown-body">
                <AnimatedMarkdown content={result.content} animate={false} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function ResponseLoaderCard({ slotLabel }: { slotLabel: string }) {
  return (
    <article className="response-card is-loading">
      <div className="response-card__header">
        <div>
          <div className="response-card__label">
            <span className="response-card__dot" />
            {slotLabel}
          </div>
          <div className="response-card__meta">
            <span>Đang lấy phản hồi...</span>
          </div>
        </div>
        <span className="response-card__badge">
          <Clock3 size={14} />
          Đang tải
        </span>
      </div>

      <div className="response-loader-body">
        <GradientLoader
          size={132}
          className="gradient-loader--response"
          label="Đang lấy phản hồi..."
        />
      </div>
    </article>
  );
}
