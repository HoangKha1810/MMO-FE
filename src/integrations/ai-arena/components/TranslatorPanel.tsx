import { Languages } from "lucide-react";
import type { ModelInfo } from "../lib/types";

const TARGET_OPTIONS: { value: string; label: string }[] = [
  { value: "vi", label: "Tiếng Việt" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
  { value: "zh", label: "中文" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" }
];

const SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: "auto", label: "Tự động nhận diện" },
  { value: "vi", label: "Tiếng Việt" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
  { value: "zh", label: "中文" }
];

interface TranslatorPanelProps {
  text: string;
  sourceLang: string;
  targetLang: string;
  modelId: string;
  models: ModelInfo[];
  loading: boolean;
  error: string | null;
  translated: string | null;
  onTextChange: (value: string) => void;
  onSourceLangChange: (value: string) => void;
  onTargetLangChange: (value: string) => void;
  onModelIdChange: (value: string) => void;
  onSubmit: () => void;
}

export function TranslatorPanel({
  text,
  sourceLang,
  targetLang,
  modelId,
  models,
  loading,
  error,
  translated,
  onTextChange,
  onSourceLangChange,
  onTargetLangChange,
  onModelIdChange,
  onSubmit
}: TranslatorPanelProps) {
  const available = models.filter((m) => m.available);

  return (
    <section className="web-summary-panel tool-panel tool-panel--translator">
      <div className="web-summary-canvas">
        <div className="web-summary-topbar">
          <div className="web-summary-topbar__icon">
            <Languages size={18} />
          </div>
          <div>
            <h2>AI Biên dịch viên</h2>
            <p>Chọn model và ngôn ngữ. Hệ thống gửi văn bản tới model bạn chọn để dịch.</p>
          </div>
        </div>

        <div className="tool-panel__grid">
          <label className="tool-panel__field">
            <span>Ngôn ngữ nguồn</span>
            <select
              value={sourceLang}
              onChange={(event) => onSourceLangChange(event.target.value)}
              className="tool-panel__select"
            >
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="tool-panel__field">
            <span>Ngôn ngữ đích</span>
            <select
              value={targetLang}
              onChange={(event) => onTargetLangChange(event.target.value)}
              className="tool-panel__select"
            >
              {TARGET_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="tool-panel__field tool-panel__field--span2">
            <span>Model</span>
            <select
              value={modelId}
              onChange={(event) => onModelIdChange(event.target.value)}
              className="tool-panel__select"
            >
              {available.length === 0 ? (
                <option value="">Chưa có model khả dụng</option>
              ) : (
                available.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} — {m.providerLabel}
                  </option>
                ))
              )}
            </select>
          </label>
        </div>

        <div className="tool-panel__field">
          <label htmlFor="translator-source">Văn bản gốc</label>
          <textarea
            id="translator-source"
            className="tool-panel__textarea"
            value={text}
            onChange={(event) => onTextChange(event.target.value)}
            placeholder="Dán hoặc nhập đoạn cần dịch..."
            rows={5}
          />
        </div>

        <div className="web-summary-search">
          <button
            type="button"
            className="web-summary-search__button tool-panel__submit"
            onClick={onSubmit}
            disabled={!text.trim() || !modelId || loading}
          >
            {loading ? "Đang dịch..." : "Dịch"}
          </button>
        </div>

        {error ? (
          <p className="tool-panel__error" role="alert">
            {error}
          </p>
        ) : null}

        {translated ? (
          <div className="tool-panel__field">
            <span>Bản dịch</span>
            <div className="tool-panel__output">{translated}</div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
