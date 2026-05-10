import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import { Globe2, Link2, Sparkles } from "lucide-react";
import { ArenaMode, ArenaPreferences, ModelInfo, WebSummaryResponse } from "../lib/types";
import { ResponseCard, ResponseLoaderCard } from "./ResponseCard";

interface WebSummaryPanelProps {
  url: string;
  mode: ArenaMode;
  preferences: ArenaPreferences;
  models: ModelInfo[];
  loading: boolean;
  error: string | null;
  result: WebSummaryResponse | null;
  onUrlChange: (value: string) => void;
  onSubmit: () => void;
}

const getModelById = (models: ModelInfo[], modelId: string) =>
  models.find((model) => model.id === modelId) ?? null;

export function WebSummaryPanel({
  url,
  mode,
  preferences,
  models,
  loading,
  error,
  result,
  onUrlChange,
  onSubmit
}: WebSummaryPanelProps) {
  const availableModels = models.filter((model) => model.available);
  const battlePreviewModels = preferences.battlePoolIds
    .map((modelId) => getModelById(availableModels, modelId))
    .filter((model): model is ModelInfo => Boolean(model));
  const previewModels =
    mode === "direct"
      ? [getModelById(availableModels, preferences.directModelId)].filter(
          (model): model is ModelInfo => Boolean(model)
        )
      : mode === "side-by-side"
        ? [preferences.leftModelId, preferences.rightModelId]
            .map((modelId) => getModelById(availableModels, modelId))
            .filter((model): model is ModelInfo => Boolean(model))
        : battlePreviewModels;

  return (
    <section className="web-summary-panel">
      <div className="web-summary-canvas">
        <div className="web-summary-topbar">
          <div className="web-summary-topbar__icon">
            <Globe2 size={18} />
          </div>
          <div>
            <h2>Trình tóm tắt trang web</h2>
            <p>
              Dán URL để hệ thống đọc nội dung và tóm tắt bằng model hoặc nhiều model bạn đang chọn ở thanh bên trái.
            </p>
          </div>
        </div>

        <div className="web-summary-search">
          <div className="web-summary-search__input">
            <Link2 size={16} />
            <input
              value={url}
              onChange={(event) => onUrlChange(event.target.value)}
              placeholder="Nhập URL bài viết, landing page hoặc trang sản phẩm cần tóm tắt"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onSubmit();
                }
              }}
            />
          </div>
          <button
            type="button"
            className="web-summary-search__button"
            onClick={onSubmit}
            disabled={!url.trim() || loading}
          >
            {loading ? "Đang tóm tắt..." : "Tóm tắt"}
          </button>
        </div>

        <div className="web-summary-meta-strip">
          <span>
            {mode === "direct"
              ? "1 mô hình"
              : mode === "side-by-side"
                ? "2 mô hình"
                : `${Math.max(2, previewModels.length)} mô hình`}
          </span>
          <span>
            {previewModels.length
              ? previewModels.map((model) => model.label).join(" • ")
              : "Chọn model ở thanh bên trái để bắt đầu"}
          </span>
        </div>

        {error && <div className="banner-error">{error}</div>}

        <div className="web-summary-body">
          {result ? (
            <motion.div
              className="web-summary-results"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="web-summary-results__source">
                <div>
                  <p className="section-label">Nguồn đang phân tích</p>
                  <strong>{result.pageTitle}</strong>
                  <span>{result.resolvedUrl}</span>
                </div>
                <p>{result.pageDescription || result.excerpt}</p>
              </div>

              <div
                className={`response-grid ${
                  result.results.length === 1
                    ? "single"
                    : result.results.length > 2
                      ? "multi"
                      : "double"
                }`}
                style={
                  result.results.length > 2
                    ? ({ "--grid-columns": Math.min(3, result.results.length) } as CSSProperties)
                    : undefined
                }
              >
                {result.results.map((item) => (
                  <ResponseCard key={`${item.slot}-${item.modelId}`} result={item} revealed />
                ))}
              </div>
            </motion.div>
          ) : loading ? (
            <div
              className={`response-grid ${
                previewModels.length <= 1 ? "single" : previewModels.length > 2 ? "multi" : "double"
              } web-summary-loading-grid`}
              style={
                previewModels.length > 2
                  ? ({ "--grid-columns": Math.min(3, previewModels.length) } as CSSProperties)
                  : undefined
              }
            >
              {(previewModels.length
                ? previewModels
                : [{ id: "fallback", label: "Nguồn đang chọn" } as ModelInfo]
              ).map((model, index) => (
                <ResponseLoaderCard
                  key={model.id}
                  slotLabel={mode === "battle" ? `Nguồn ${String.fromCharCode(65 + index)}` : model.label}
                />
              ))}
            </div>
          ) : (
            <div className="web-summary-empty">
              <Sparkles size={24} />
              <strong>Nhập một URL để bắt đầu</strong>
              <p>
                Công cụ này phù hợp để rút gọn bài blog, landing page, trang sản phẩm, tài liệu giới thiệu hoặc bất kỳ nội dung web nào bạn muốn nắm ý nhanh.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
