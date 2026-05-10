import { useEffect, useRef, useState } from "react";
import { ChevronDown, Clock, ImageIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { ToolImageGenerateResponse } from "../lib/types";

const PROMPT_MAX = 2000;
const HISTORY_KEY = "ttmmo-ai-image-gen-prompt-history";
const HISTORY_CAP = 12;

export const IMAGE_GEN_MODEL_OPTIONS = [
  {
    id: "gemini:gemini-3.1-flash-image-preview",
    label: "Nano Banana 2",
    vendor: "google" as const
  },
  {
    id: "openai:gpt-image-1",
    label: "GPT Image",
    vendor: "openai" as const
  }
];

const SIZE_OPTIONS = [
  { value: "auto", label: "Tự động điều chỉnh kích thước" },
  { value: "1024x1024", label: "Vuông 1024 × 1024" },
  { value: "1024x1536", label: "Dọc 1024 × 1536" },
  { value: "1536x1024", label: "Ngang 1536 × 1024" }
];

function loadPromptHistory(): string[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string").slice(0, HISTORY_CAP)
      : [];
  } catch {
    return [];
  }
}

function savePromptHistory(entries: string[]) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, HISTORY_CAP)));
}

function pushPromptHistory(prompt: string) {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return;
  }
  const prev = loadPromptHistory().filter((p) => p !== trimmed);
  savePromptHistory([trimmed, ...prev].slice(0, HISTORY_CAP));
}

function GoogleGMark() {
  return (
    <span className="image-gen__vendor-mark image-gen__vendor-mark--google" aria-hidden>
      <svg width="18" height="18" viewBox="0 0 48 48">
        <path
          fill="#FFC107"
          d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12 s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24 s8.955,20,20,20s20-8.955,20-20c0-1.341-0.138-2.65-0.389-3.917z"
        />
        <path
          fill="#FF3D00"
          d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039 l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
        />
        <path
          fill="#4CAF50"
          d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36 c-5.222,0-9.654-3.345-11.303-8l-6.571,4.819C9.655,39.108,16.318,44,24,44z"
        />
        <path
          fill="#1976D2"
          d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571 l0.004-0.003l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"
        />
      </svg>
    </span>
  );
}

function OpenAIMark() {
  return (
    <span className="image-gen__vendor-mark image-gen__vendor-mark--openai" aria-hidden>
      GPT
    </span>
  );
}

interface ImageGenPanelProps {
  prompt: string;
  modelId: string;
  imageSize: string;
  loading: boolean;
  error: string | null;
  result: ToolImageGenerateResponse | null;
  onPromptChange: (value: string) => void;
  onModelIdChange: (value: string) => void;
  onImageSizeChange: (value: string) => void;
  onSubmit: () => void;
}

export function ImageGenPanel({
  prompt,
  modelId,
  imageSize,
  loading,
  error,
  result,
  onPromptChange,
  onModelIdChange,
  onImageSizeChange,
  onSubmit
}: ImageGenPanelProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<string[]>(() => loadPromptHistory());
  const historyRef = useRef<HTMLDivElement | null>(null);

  const dataUrl =
    result?.imageBase64 && result?.mimeType
      ? `data:${result.mimeType};base64,${result.imageBase64}`
      : null;

  const len = Math.min(prompt.length, PROMPT_MAX);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!historyRef.current?.contains(event.target as Node)) {
        setHistoryOpen(false);
      }
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const handleSubmit = () => {
    if (!prompt.trim() || loading) {
      return;
    }
    pushPromptHistory(prompt);
    setHistoryItems(loadPromptHistory());
    onSubmit();
  };

  const selectedModel = IMAGE_GEN_MODEL_OPTIONS.find((m) => m.id === modelId) ?? IMAGE_GEN_MODEL_OPTIONS[0];

  return (
    <section className="image-gen">
      <div className="image-gen__inner">
        <h1 className="image-gen__title">Bộ Tạo Hình Ảnh</h1>

        <div className="image-gen__composer">
          <div className="image-gen__textarea-wrap">
            <textarea
              className="image-gen__textarea"
              value={prompt}
              onChange={(event) => onPromptChange(event.target.value.slice(0, PROMPT_MAX))}
              placeholder="Mô tả hình ảnh bạn muốn tạo..."
              maxLength={PROMPT_MAX}
              rows={8}
            />
            <div className="image-gen__textarea-meta">
              <span className="image-gen__textarea-icon" aria-hidden>
                <ImageIcon size={18} strokeWidth={1.75} />
              </span>
              <span className="image-gen__counter">
                {len} / {PROMPT_MAX}
              </span>
            </div>
          </div>

          <div className="image-gen__toolbar">
            <div className="image-gen__select-shell image-gen__select-shell--model">
              <span className="image-gen__select-icon">
                {selectedModel.vendor === "google" ? <GoogleGMark /> : <OpenAIMark />}
              </span>
              <select
                className="image-gen__select image-gen__select--with-icon"
                value={modelId}
                onChange={(event) => onModelIdChange(event.target.value)}
                aria-label="Chọn model tạo ảnh"
              >
                {IMAGE_GEN_MODEL_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="image-gen__select-chevron" aria-hidden />
            </div>

            <div className="image-gen__select-shell image-gen__select-shell--wide">
              <select
                className="image-gen__select"
                value={imageSize}
                onChange={(event) => onImageSizeChange(event.target.value)}
                aria-label="Kích thước ảnh"
              >
                {SIZE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="image-gen__select-chevron" aria-hidden />
            </div>

            <div className="image-gen__toolbar-spacer" />

            <div className="image-gen__history-wrap" ref={historyRef}>
              <button
                type="button"
                className="image-gen__history-btn"
                title="Lịch sử mô tả"
                aria-expanded={historyOpen}
                onClick={(event) => {
                  event.stopPropagation();
                  setHistoryOpen((open) => !open);
                  setHistoryItems(loadPromptHistory());
                }}
              >
                <Clock size={18} strokeWidth={1.75} />
              </button>
              <AnimatePresence>
                {historyOpen ? (
                  <motion.div
                    className="image-gen__history-pop"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.15 }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {historyItems.length === 0 ? (
                      <p className="image-gen__history-empty">Chưa có lịch sử</p>
                    ) : (
                      <ul className="image-gen__history-list">
                        {historyItems.map((item) => (
                          <li key={item}>
                            <button
                              type="button"
                              className="image-gen__history-item"
                              onClick={() => {
                                onPromptChange(item.slice(0, PROMPT_MAX));
                                setHistoryOpen(false);
                              }}
                            >
                              {item.length > 72 ? `${item.slice(0, 72)}…` : item}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <button
              type="button"
              className="image-gen__generate"
              disabled={!prompt.trim() || loading}
              onClick={handleSubmit}
            >
              {loading ? "Đang tạo…" : "Tạo ra"}
            </button>
          </div>
        </div>

        {error ? (
          <p className="image-gen__error" role="alert">
            {error}
          </p>
        ) : null}

        {dataUrl ? (
          <motion.div
            className="image-gen__result"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
          >
            <img src={dataUrl} alt="Ảnh đã tạo" className="image-gen__result-img" />
            {result?.caption ? <p className="image-gen__caption">{result.caption}</p> : null}
          </motion.div>
        ) : null}
      </div>
    </section>
  );
}
