import type { CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ModelInfo } from "../lib/types";
import { groupModelsByProvider, truncate } from "../lib/utils";
import { ModelAvatarMark } from "./ModelAvatarMark";

interface ModelDropdownProps {
  model: ModelInfo | null;
  models: ModelInfo[];
  onChange?: (modelId: string) => void;
  placeholderLabel?: string;
  placeholderMeta?: string;
  metaText?: string;
  ariaLabel?: string;
  variant?: "default" | "card-header" | "mobile-header";
}

export function ModelDropdown({
  model,
  models,
  onChange,
  placeholderLabel,
  placeholderMeta,
  metaText,
  ariaLabel,
  variant = "default"
}: ModelDropdownProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const interactive = Boolean(onChange);
  const availableModels = models.filter((item) => item.available);
  const groupedModels = Object.entries(groupModelsByProvider(availableModels));
  const isMobileSheet = variant === "mobile-header";
  const optionMarkSize = isMobileSheet ? 22 : 16;

  useEffect(() => {
    if (!open) {
      return;
    }

    const closePicker = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    const handleViewportChange = () => setOpen(false);

    document.addEventListener("mousedown", closePicker);
    document.addEventListener("scroll", closePicker, true);
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleViewportChange);

    return () => {
      document.removeEventListener("mousedown", closePicker);
      document.removeEventListener("scroll", closePicker, true);
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      if (isMobileSheet) {
        setOpenUpward(false);
        const selectedOption = panelRef.current?.querySelector<HTMLElement>("[data-selected='true']");
        selectedOption?.scrollIntoView({ block: "nearest" });
        return;
      }

      const triggerRect = rootRef.current?.getBoundingClientRect();
      const panelHeight = panelRef.current?.offsetHeight ?? 360;

      if (!triggerRect) {
        return;
      }

      const viewportPadding = 16;
      const spaceBelow = window.innerHeight - triggerRect.bottom - viewportPadding;
      const spaceAbove = triggerRect.top - viewportPadding;

      setOpenUpward(spaceBelow < panelHeight && spaceAbove > spaceBelow);

      const selectedOption = panelRef.current?.querySelector<HTMLElement>("[data-selected='true']");
      selectedOption?.scrollIntoView({ block: "nearest" });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [open, model?.id, isMobileSheet]);

  useEffect(() => {
    if (!open || !isMobileSheet) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, isMobileSheet]);

  const label = model?.label ?? placeholderLabel ?? "Chọn model";
  const meta = metaText ?? model?.providerLabel ?? placeholderMeta ?? "Đổi model cho khung này";

  return (
    <div
      ref={rootRef}
      className={[
        "frame-model-picker",
        `frame-model-picker--${variant}`,
        interactive ? "is-interactive" : "",
        open ? "is-open" : "",
        !isMobileSheet && openUpward ? "opens-upward" : ""
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ "--picker-accent": model?.accent ?? "#6e89a7" } as CSSProperties}
    >
      <motion.button
        type="button"
        className="frame-model-picker__trigger"
        disabled={!interactive}
        onClick={() => {
          if (!interactive) return;
          setOpen((current) => !current);
        }}
        aria-label={ariaLabel ?? placeholderLabel ?? "Chọn model"}
        aria-expanded={interactive ? open : undefined}
        aria-haspopup={interactive ? "listbox" : undefined}
        whileTap={interactive ? { scale: 0.99 } : undefined}
      >
        <span className="frame-model-picker__value">
          <ModelAvatarMark
            modelId={model?.id}
            modelName={model?.modelName}
            label={label}
            providerId={model?.providerId}
            providerLabel={model?.providerLabel}
            accent={model?.accent ?? "#6e89a7"}
            size={isMobileSheet ? 18 : 16}
            className="frame-model-picker__mark"
            alt={`${label} logo`}
          />
          <span className="frame-model-picker__copy">
            <strong>{label}</strong>
            <small>{meta}</small>
          </span>
        </span>
        <ChevronDown
          size={isMobileSheet ? 14 : 16}
          className={`frame-model-picker__chevron ${open ? "rotated" : ""}`}
        />
      </motion.button>

      <AnimatePresence>
        {interactive && open && !isMobileSheet ? (
          <motion.div
            ref={panelRef}
            className="frame-model-picker__panel"
            initial={{ opacity: 0, y: openUpward ? 10 : -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: openUpward ? 10 : -10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              className="frame-model-picker__list"
              role="listbox"
              aria-label={ariaLabel ?? placeholderLabel ?? "Chọn model"}
            >
              {groupedModels.map(([provider, providerModels], groupIndex) => (
                <section key={provider} className="frame-model-picker__group">
                  <div className="frame-model-picker__group-label">
                    <span>{provider}</span>
                    <small>{providerModels.length} model</small>
                  </div>

                  <div className="frame-model-picker__group-items">
                    {providerModels.map((option, optionIndex) => {
                      const active = option.id === model?.id;

                      return (
                        <motion.button
                          key={option.id}
                          type="button"
                          role="option"
                          aria-selected={active}
                          data-selected={active ? "true" : undefined}
                          className={`frame-model-picker__option ${active ? "active" : ""}`}
                          style={{ "--option-accent": option.accent } as CSSProperties}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: 0.18,
                            delay: Math.min(groupIndex * 0.03 + optionIndex * 0.015, 0.14),
                            ease: "easeOut"
                          }}
                          onClick={() => {
                            onChange?.(option.id);
                            setOpen(false);
                          }}
                        >
                          <ModelAvatarMark
                            modelId={option.id}
                            modelName={option.modelName}
                            label={option.label}
                            providerId={option.providerId}
                            providerLabel={option.providerLabel}
                            accent={option.accent}
                            size={optionMarkSize}
                            className="frame-model-picker__option-mark"
                            alt={`${option.label} logo`}
                          />
                          <span className="frame-model-picker__option-copy">
                            <strong>{option.label}</strong>
                            <small>{truncate(option.description || option.modelName, 56)}</small>
                          </span>
                          {active ? (
                            <span className="frame-model-picker__option-check">
                              <Check size={14} />
                            </span>
                          ) : null}
                        </motion.button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {typeof document !== "undefined"
        ? createPortal(
            <AnimatePresence>
              {interactive && open && isMobileSheet ? (
                <motion.div
                  key="model-picker-mobile-layer"
                  className="frame-model-picker__mobile-layer"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                >
                  <motion.button
                    type="button"
                    className="frame-model-picker__mobile-backdrop"
                    aria-label="Đóng danh sách model"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    onClick={() => setOpen(false)}
                  />
                  <motion.div
                    ref={panelRef}
                    className="frame-model-picker__panel frame-model-picker__panel--mobile-sheet"
                    initial={{ y: "108%", opacity: 0.7, scale: 0.96 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: "108%", opacity: 0.7, scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 320, damping: 32, mass: 0.9 }}
                  >
                    <div className="frame-model-picker__mobile-sheet-handle" aria-hidden="true" />
                    <div
                      className="frame-model-picker__list"
                      role="listbox"
                      aria-label={ariaLabel ?? placeholderLabel ?? "Chọn model"}
                    >
                      {groupedModels.map(([provider, providerModels], groupIndex) => (
                        <section key={provider} className="frame-model-picker__group">
                          <div className="frame-model-picker__group-label">
                            <span>{provider}</span>
                            <small>{providerModels.length} model</small>
                          </div>

                          <div className="frame-model-picker__group-items">
                            {providerModels.map((option, optionIndex) => {
                              const active = option.id === model?.id;

                              return (
                                <motion.button
                                  key={option.id}
                                  type="button"
                                  role="option"
                                  aria-selected={active}
                                  data-selected={active ? "true" : undefined}
                                  className={`frame-model-picker__option ${active ? "active" : ""}`}
                                  style={{ "--option-accent": option.accent } as CSSProperties}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{
                                    duration: 0.2,
                                    delay: Math.min(groupIndex * 0.04 + optionIndex * 0.02, 0.2),
                                    ease: [0.22, 1, 0.36, 1]
                                  }}
                                  onClick={() => {
                                    onChange?.(option.id);
                                    setOpen(false);
                                  }}
                                >
                                  <ModelAvatarMark
                                    modelId={option.id}
                                    modelName={option.modelName}
                                    label={option.label}
                                    providerId={option.providerId}
                                    providerLabel={option.providerLabel}
                                    accent={option.accent}
                                    size={optionMarkSize}
                                    className="frame-model-picker__option-mark"
                                    alt={`${option.label} logo`}
                                  />
                                  <span className="frame-model-picker__option-copy">
                                    <strong>{option.label}</strong>
                                    <small>{truncate(option.description || option.modelName, 56)}</small>
                                  </span>
                                  {active ? (
                                    <span className="frame-model-picker__option-check">
                                      <Check size={14} />
                                    </span>
                                  ) : null}
                                </motion.button>
                              );
                            })}
                          </div>
                        </section>
                      ))}
                    </div>
                  </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body
          )
        : null}
    </div>
  );
}
