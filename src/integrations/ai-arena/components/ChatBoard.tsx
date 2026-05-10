import type { CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  FileDown,
  FileText,
  Medal,
  PencilLine,
  StepForward
} from "lucide-react";
import { useEffect, useRef } from "react";
import { ArenaMode, ArenaPreferences, ChatSession, ModelInfo, VoteChoice } from "../lib/types";
import { formatTime } from "../lib/utils";
import { ModelDropdown } from "./ModelDropdown";
import { ResponseCard, ResponseLoaderCard } from "./ResponseCard";

interface ChatBoardProps {
  session: ChatSession | null;
  mode: ArenaMode;
  isMobile?: boolean;
  sending: boolean;
  error: string | null;
  pendingPrompt: string;
  isConversationActive: boolean;
  readOnly?: boolean;
  models: ModelInfo[];
  preferences: ArenaPreferences;
  onReveal: (turnId: string) => Promise<void>;
  onVote: (turnId: string, choice: VoteChoice) => Promise<void>;
  onQuickPrompt: (prompt: string) => void;
  onEditPrompt?: (prompt: string) => void;
  onFrameModelChange?: (index: number, modelId: string) => void;
  onSideFrameModelChange?: (
    key: "directModelId" | "leftModelId" | "rightModelId",
    value: string
  ) => void;
  onRegenerateTurn?: (turnId: string) => Promise<void>;
  onContinueTurn?: (turnId: string) => Promise<void>;
  onExportConversation?: (format: "markdown" | "pdf") => Promise<void>;
}

const promptSuggestions = [
  "Lập kế hoạch kiếm khách trong 30 ngày.",
  "Soạn tin nhắn tư vấn ngắn gọn và dễ chốt hơn.",
  "Tóm tài liệu này thành checklist triển khai.",
  "Viết giúp tôi một phương án chốt sale tự nhiên hơn."
];

const voteOptions: Array<{ choice: VoteChoice; label: string }> = [
  { choice: "left", label: "Bên trái tốt hơn" },
  { choice: "right", label: "Bên phải tốt hơn" },
  { choice: "tie", label: "Hai bên ngang nhau" },
  { choice: "both_bad", label: "Cả hai đều chưa ổn" }
];

const battleLabelFromIndex = (index: number) =>
  `Nguồn ${String.fromCharCode(65 + Math.min(index, 25))}`;

const getCompareGridColumns = (count: number, isMobile = false) => {
  if (isMobile) {
    return 1;
  }
  if (count <= 2) {
    return Math.max(1, count);
  }
  if (count === 4) {
    return 2;
  }
  return Math.min(3, count);
};

const getCompareGridRows = (count: number, columns: number) =>
  Math.max(1, Math.ceil(count / Math.max(1, columns)));

function PendingTurn({
  mode,
  pendingPrompt,
  battleCount = 2,
  isMobile = false
}: {
  mode: ArenaMode;
  pendingPrompt: string;
  battleCount?: number;
  isMobile?: boolean;
}) {
  const battleLabels = Array.from({ length: Math.max(2, battleCount) }, (_item, index) =>
    battleLabelFromIndex(index)
  );
  const pendingColumns = mode === "battle" ? getCompareGridColumns(battleLabels.length, isMobile) : 2;
  const pendingRows = mode === "battle" ? getCompareGridRows(battleLabels.length, pendingColumns) : 1;

  return (
    <motion.div
      className="turn-card"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="turn-card__user">
        <div className="turn-card__prompt pending">
          <div className="turn-card__prompt-meta">
            <span>Bạn</span>
            <span>Đang gửi lên backend</span>
          </div>
          <p>{pendingPrompt || "Đang chuẩn bị nội dung để gửi..."}</p>
        </div>
      </div>

      <div className="turn-card__assistant">
        <div
          className={`response-grid ${
            mode === "direct" ? "single" : mode === "battle" && battleLabels.length > 2 ? "multi" : "double"
          }`}
          style={
            mode === "battle" && battleLabels.length > 2
              ? ({
                  "--grid-columns": pendingColumns,
                  "--grid-rows": pendingRows
                } as CSSProperties)
              : undefined
          }
        >
          {mode === "direct" ? (
            <ResponseLoaderCard slotLabel="Nguồn đang chọn" />
          ) : mode === "battle" ? (
            battleLabels.map((slotLabel) => (
              <ResponseLoaderCard key={slotLabel} slotLabel={slotLabel} />
            ))
          ) : (
            <>
              <ResponseLoaderCard slotLabel="Bên trái" />
              <ResponseLoaderCard slotLabel="Bên phải" />
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function ChatBoard({
  session,
  mode,
  isMobile = false,
  sending,
  error,
  pendingPrompt,
  isConversationActive,
  readOnly = false,
  models,
  preferences,
  onReveal,
  onVote,
  onQuickPrompt,
  onEditPrompt,
  onFrameModelChange,
  onSideFrameModelChange,
  onRegenerateTurn,
  onContinueTurn,
  onExportConversation
}: ChatBoardProps) {
  const hasTurns = Boolean(session?.turns.length);
  const turnListRef = useRef<HTMLDivElement | null>(null);
  const availableModels = models.filter((model) => model.available);
  const isCompareMode = mode !== "direct";
  const emptyVariantClass =
    mode === "battle" ? "empty--battle" : mode === "side-by-side" ? "empty--side" : "empty--direct";

  const getModelById = (modelId: string) =>
    availableModels.find((model) => model.id === modelId) ??
    models.find((model) => model.id === modelId) ??
    null;

  const leftCompareModel = getModelById(preferences.leftModelId);
  const rightCompareModel = getModelById(preferences.rightModelId);
  const selectedBattleModels = preferences.battlePoolIds
    .map((modelId) => getModelById(modelId))
    .filter((model): model is ModelInfo => Boolean(model));

  const battlePreviewModels =
    selectedBattleModels.length > 0
      ? selectedBattleModels.slice(0, 6)
      : availableModels.slice(0, 6);
  const battlePreviewColumns = getCompareGridColumns(battlePreviewModels.length, isMobile);
  const battlePreviewRows = getCompareGridRows(battlePreviewModels.length, battlePreviewColumns);
  const sidePreviewColumns = getCompareGridColumns(2, isMobile);
  const sidePreviewRows = getCompareGridRows(2, sidePreviewColumns);

  useEffect(() => {
    if (!turnListRef.current) {
      return;
    }

    turnListRef.current.scrollTo({
      top: turnListRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [session?.turns.length, sending]);

  if (!hasTurns && !sending) {
    return (
      <section
        className={`chat-board ${isCompareMode ? "chat-board--compare" : "chat-board--direct"} empty ${emptyVariantClass} ${isConversationActive ? "active" : ""}`}
      >
        {mode === "battle" ? (
          <motion.div
            className="multi-compare-shell"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <div
              className="multi-compare-grid"
              style={
                {
                  "--grid-columns": battlePreviewColumns,
                  "--grid-rows": battlePreviewRows
                } as CSSProperties
              }
            >
              {battlePreviewModels.map((model, index) => (
                <article
                  key={model.id}
                  className="multi-compare-card"
                  style={{ "--card-accent": model.accent } as CSSProperties}
                >
                  <div className="multi-compare-card__header">
                    <ModelDropdown
                      model={model}
                      models={availableModels}
                      placeholderLabel={battleLabelFromIndex(index)}
                      placeholderMeta="Chọn model cho ô này"
                      onChange={onFrameModelChange ? (modelId) => onFrameModelChange(index, modelId) : undefined}
                    />
                  </div>
                  <div className="multi-compare-card__divider" />
                  <div className="multi-compare-card__body" />
                </article>
              ))}
            </div>
          </motion.div>
        ) : mode === "side-by-side" ? (
          <motion.div
            className="compare-empty-shell"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <div
              className="compare-empty-grid"
              style={
                {
                  "--grid-columns": sidePreviewColumns,
                  "--grid-rows": sidePreviewRows
                } as CSSProperties
              }
            >
              {[leftCompareModel, rightCompareModel].map((model, index) => (
                <article
                  key={model?.id ?? index}
                  className="compare-empty-card"
                  style={
                    {
                      "--card-accent": model?.accent ?? "#6e89a7"
                    } as CSSProperties
                  }
                >
                  <div className="compare-empty-card__header">
                    <ModelDropdown
                      model={model}
                      models={availableModels}
                      placeholderLabel={index === 0 ? "Model A" : "Model B"}
                      placeholderMeta="Chọn model cho khung này"
                      onChange={
                        onSideFrameModelChange
                          ? (modelId) =>
                              onSideFrameModelChange(index === 0 ? "leftModelId" : "rightModelId", modelId)
                          : undefined
                      }
                    />
                  </div>
                  <div className="compare-empty-card__divider" />
                  <div className="compare-empty-card__body" />
                </article>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            className="empty-state"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <h2>Hôm nay bạn muốn làm gì?</h2>

            <div className="quick-prompts">
              {promptSuggestions.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="quick-prompt"
                  onClick={() => onQuickPrompt(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </section>
    );
  }

  const streamingTurnExists = Boolean(session?.turns.some((turn) => turn.isStreaming));

  return (
    <section
      className={`chat-board ${isCompareMode ? "chat-board--compare" : "chat-board--direct"} active ${isConversationActive ? "expanded" : ""}`}
    >
      <div className="panel__header">
        <div>
          <h2 className="chat-board__title">{session?.title || "Đang chuẩn bị mục mới"}</h2>
        </div>
        <div className="panel__header-actions">
          {session && onExportConversation && !readOnly && (
            <>
              <button
                type="button"
                className="ghost-button ghost-button--icon"
                onClick={() => void onExportConversation("markdown")}
                aria-label="Xuất Markdown"
                title="Xuất Markdown"
              >
                <FileText size={15} />
              </button>
              <button
                type="button"
                className="ghost-button ghost-button--icon"
                onClick={() => void onExportConversation("pdf")}
                aria-label="Xuất PDF"
                title="Xuất PDF"
              >
                <FileDown size={15} />
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="banner-error">{error}</div>}

      <div className={`turn-list ${isCompareMode ? "turn-list--compare" : ""}`} ref={turnListRef}>
        <AnimatePresence initial={false}>
          {session?.turns.map((turn) => (
            <motion.div
              key={turn.id}
              className={`turn-card ${turn.mode !== "direct" ? "turn-card--compare" : ""}`}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
            >
              <div className="turn-card__user">
                <div className="turn-card__prompt">
                  <div className="turn-card__prompt-meta">
                    <span>Bạn</span>
                    <span>{formatTime(turn.timestamp)}</span>
                  </div>
                  <p>{turn.prompt}</p>

                  {turn.attachments.length > 0 && (
                    <div className="turn-card__attachments">
                      {turn.attachments.map((asset) => (
                        <a
                          key={asset.id}
                          className="turn-card__attachment"
                          href={asset.publicUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {asset.fileName}
                        </a>
                      ))}
                    </div>
                  )}

                  {!readOnly && onEditPrompt && (
                    <div className="turn-card__prompt-actions">
                      <button
                        type="button"
                        className="ghost-button ghost-button--icon"
                        onClick={() => onEditPrompt(turn.prompt)}
                        aria-label="Sửa và gửi lại"
                        title="Sửa và gửi lại"
                      >
                        <PencilLine size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="turn-card__assistant">
                <div
                  className={`response-grid ${
                    turn.mode === "direct"
                      ? "single"
                      : turn.results.length > 2
                        ? "multi"
                        : "double"
                  }`}
                  style={
                    turn.results.length > 2
                      ? ({
                          "--grid-columns": getCompareGridColumns(turn.results.length, isMobile),
                          "--grid-rows": getCompareGridRows(
                            turn.results.length,
                            getCompareGridColumns(turn.results.length, isMobile)
                          )
                        } as CSSProperties)
                      : turn.mode !== "direct"
                        ? ({
                            "--grid-columns": getCompareGridColumns(turn.results.length, isMobile),
                            "--grid-rows": getCompareGridRows(
                              turn.results.length,
                              getCompareGridColumns(turn.results.length, isMobile)
                            )
                          } as CSSProperties)
                        : undefined
                  }
                >
                  {turn.results.map((result, index) => {
                    const currentModel =
                      turn.mode === "side-by-side"
                        ? getModelById(index === 0 ? preferences.leftModelId : preferences.rightModelId) ??
                          getModelById(result.modelId)
                        : turn.mode === "battle"
                          ? getModelById(preferences.battlePoolIds[index] ?? result.modelId) ??
                            getModelById(result.modelId)
                          : getModelById(result.modelId);

                    return (
                      <div
                        key={`${turn.id}-${result.slot}`}
                        className="response-grid__cell"
                      >
                        <ResponseCard
                          result={result}
                          revealed={turn.revealed}
                          allowRegenerate={!readOnly}
                          onRegenerate={
                            onRegenerateTurn ? () => onRegenerateTurn(turn.id) : undefined
                          }
                          modelPicker={
                            turn.mode !== "direct" && !readOnly
                              ? {
                                  model: currentModel,
                                  models: availableModels,
                                  onChange:
                                    turn.mode === "battle"
                                      ? onFrameModelChange
                                        ? (modelId) => onFrameModelChange(index, modelId)
                                        : undefined
                                      : onSideFrameModelChange
                                        ? (modelId) =>
                                            onSideFrameModelChange(
                                              index === 0 ? "leftModelId" : "rightModelId",
                                              modelId
                                            )
                                        : undefined,
                                  placeholderLabel:
                                    turn.mode === "battle"
                                      ? battleLabelFromIndex(index)
                                      : index === 0
                                        ? "Model A"
                                        : "Model B"
                                }
                              : undefined
                          }
                        />
                      </div>
                    );
                  })}
                </div>

                {!readOnly && (
                  <div className="turn-card__assistant-actions">
                    {onContinueTurn &&
                      !turn.isStreaming &&
                      turn.results.some((result) => result.finishReason === "stopped" || result.finishReason === "length") && (
                      <button
                        type="button"
                        className="ghost-button ghost-button--icon"
                        onClick={() => void onContinueTurn(turn.id)}
                        aria-label="Tiếp tục trả lời"
                        title="Tiếp tục trả lời"
                      >
                        <StepForward size={15} />
                      </button>
                    )}
                  </div>
                )}

                {turn.mode === "battle" && !readOnly && (
                  <div className="battle-actions">
                    {turn.results.length === 2 ? (
                      <div className="battle-actions__group">
                        {voteOptions.map((option) => (
                          <button
                            key={option.choice}
                            type="button"
                            className={`vote-button ${
                              turn.vote === option.choice ? "active" : ""
                            }`}
                            onClick={() => void onVote(turn.id, option.choice)}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {turn.results.length > 2 ? (
                      <div className="vote-summary">
                        Đang so sánh {turn.results.length} model cùng lúc.
                      </div>
                    ) : turn.tally ? (
                      <div className="vote-summary">
                        <Medal size={14} />
                        Tổng vote: {turn.tally.total} | Trái {turn.tally.left} | Phải{" "}
                        {turn.tally.right}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {sending && !streamingTurnExists && (
          <PendingTurn
            mode={mode}
            pendingPrompt={pendingPrompt}
            battleCount={preferences.battlePoolIds.length}
            isMobile={isMobile}
          />
        )}
      </div>
    </section>
  );
}
