import type { CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlignJustify,
  Boxes,
  Check,
  CheckSquare,
  ChevronDown,
  Compass,
  Download,
  Globe2,
  ImagePlus,
  Languages,
  LogOut,
  MoreHorizontal,
  PencilLine,
  Pin,
  Plus,
  Search,
  Share2,
  Sparkles,
  Square,
  Swords,
  Trash2
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { ModelAvatarMark } from "./ModelAvatarMark";
import {
  ArenaMode,
  ArenaPreferences,
  ChatSession,
  ModelInfo,
  UsageMetric,
  UsageSummary,
  WorkspaceTool
} from "../lib/types";
import { formatTime, getModeLabel, truncate } from "../lib/utils";

interface SidebarProps {
  sidebarOpen: boolean;
  isMobile?: boolean;
  userName: string;
  userAvatarUrl?: string | null;
  currentPlanName?: string | null;
  currentPlanIsPaid?: boolean;
  usageSummary?: UsageSummary | null;
  maxCompareModels?: number | null;
  isFreePlanLocked?: boolean;
  imageRequiresUpgrade?: boolean;
  translatorRequiresUpgrade?: boolean;
  webSummaryRequiresUpgrade?: boolean;
  hideModelsForPlan?: boolean;
  sessions: ChatSession[];
  activeSessionId: string;
  deletingSessionId: string | null;
  activeTool: WorkspaceTool;
  mode: ArenaMode;
  preferences: ArenaPreferences;
  models: ModelInfo[];
  onToggleSidebar: () => void;
  onSelectTool: (tool: WorkspaceTool) => void;
  onSelectSession: (sessionId: string) => void;
  onModeChange: (mode: ArenaMode) => void;
  onModelChange: (
    key: "directModelId" | "leftModelId" | "rightModelId",
    value: string
  ) => void;
  onBattleToggle: (modelId: string) => void;
  onBattleCountChange: (count: number) => void;
  onRequestDeleteSession: (session: ChatSession) => void;
  onRenameSession: (conversationId: string, title: string) => Promise<void>;
  onTogglePinSession: (conversationId: string) => Promise<void>;
  onShareSession: (conversationId: string) => Promise<void>;
  onExportSession: (conversationId: string, format: "markdown" | "pdf") => Promise<void>;
  onBatchDelete: (conversationIds: string[]) => Promise<void>;
  onNewChat: () => void;
  onOpenUpgrade: () => void;
  onOpenMainSite: () => void;
  onResetSession: () => void;
  onMobileFeatureNotice?: (title: string, message: string) => void;
}

const brandIconSrc = toAiAssetUrl("android-chrome-192x192.png");
const brandLogoSrc = toAiAssetUrl("logo.gif");

/** Thứ tự hiển thị nhóm model trong sidebar */
const MODEL_GROUP_ORDER = [
  "openai",
  "gemini",
  "cohere",
  "dashscope",
  "minimax",
  "deepseek",
  "kimi",
  "anthropic",
  "xai",
  "groq"
];

const MODEL_GROUP_LABEL: Record<string, string> = {
  openai: "ChatGPT",
  gemini: "Gemini",
  cohere: "Cohere",
  dashscope: "Qwen",
  minimax: "MiniMax",
  deepseek: "DeepSeek",
  kimi: "Kimi",
  anthropic: "Claude",
  xai: "Grok",
  groq: "Groq"
};

const modeItems = [
  { mode: "battle" as const, icon: Swords, label: "So sánh nhiều nguồn" },
  { mode: "side-by-side" as const, icon: Boxes, label: "So sánh 2 nguồn" },
  { mode: "direct" as const, icon: Compass, label: "Trò chuyện 1 nguồn" }
];

function SidebarModelLogo({ model }: { model: ModelInfo }) {
  return (
    <ModelAvatarMark
      modelId={model.id}
      modelName={model.modelName}
      label={model.label}
      providerId={model.providerId}
      providerLabel={model.providerLabel}
      accent={model.accent}
      size={18}
      className="sidebar-model-item__mark"
      alt={`${model.providerLabel} logo`}
    />
  );
}

const getRelativeDayLabel = (value: string) => {
  const date = new Date(value);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfTarget.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays <= 0) return "Hôm nay";
  if (diffDays === 1) return "Hôm qua";
  if (diffDays <= 7) return "7 ngày qua";
  return "Cũ hơn";
};

interface SessionMenuState {
  sessionId: string;
  left: number;
  top?: number;
  bottom?: number;
}

export function Sidebar({
  sidebarOpen,
  isMobile = false,
  userName,
  userAvatarUrl,
  currentPlanName,
  currentPlanIsPaid = false,
  usageSummary,
  maxCompareModels,
  isFreePlanLocked = false,
  imageRequiresUpgrade = false,
  translatorRequiresUpgrade = false,
  webSummaryRequiresUpgrade = false,
  hideModelsForPlan = false,
  sessions,
  activeSessionId,
  deletingSessionId,
  activeTool,
  mode,
  preferences,
  models,
  onToggleSidebar,
  onSelectTool,
  onSelectSession,
  onModeChange,
  onModelChange,
  onBattleToggle,
  onBattleCountChange,
  onRequestDeleteSession,
  onRenameSession,
  onTogglePinSession,
  onShareSession,
  onExportSession,
  onBatchDelete,
  onNewChat,
  onOpenUpgrade,
  onOpenMainSite,
  onResetSession,
  onMobileFeatureNotice
}: SidebarProps) {
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [avatarErrored, setAvatarErrored] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState("");
  const [editingValue, setEditingValue] = useState("");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [openMenu, setOpenMenu] = useState<SessionMenuState | null>(null);
  const [historyExpanded, setHistoryExpanded] = useState(true);
  const [sideCompareTarget, setSideCompareTarget] = useState<"leftModelId" | "rightModelId">("leftModelId");
  const [battleCountMenuOpen, setBattleCountMenuOpen] = useState(false);
  const battlePickerRef = useRef<HTMLDivElement | null>(null);
  const availableModels = useMemo(() => models.filter((model) => model.available), [models]);
  const [modelGroupOpenOverride, setModelGroupOpenOverride] = useState<Record<string, boolean>>({});

  const modelsByProvider = useMemo(() => {
    const map = new Map<string, ModelInfo[]>();
    for (const model of availableModels) {
      const list = map.get(model.providerId) ?? [];
      list.push(model);
      map.set(model.providerId, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.label.localeCompare(b.label, "vi", { sensitivity: "base" }));
    }
    const rows = [...map.entries()].map(([providerId, groupModels]) => ({
      providerId,
      label: MODEL_GROUP_LABEL[providerId] ?? groupModels[0]?.providerLabel ?? providerId,
      models: groupModels
    }));
    rows.sort((a, b) => {
      const ia = MODEL_GROUP_ORDER.indexOf(a.providerId);
      const ib = MODEL_GROUP_ORDER.indexOf(b.providerId);
      if (ia === -1 && ib === -1) {
        return a.label.localeCompare(b.label, "vi", { sensitivity: "base" });
      }
      if (ia === -1) {
        return 1;
      }
      if (ib === -1) {
        return -1;
      }
      return ia - ib;
    });
    return rows;
  }, [availableModels]);

  const providersWithActiveSelection = useMemo(() => {
    const ids = new Set<string>();
    const touch = (modelId: string | null | undefined) => {
      if (!modelId) {
        return;
      }
      const found = availableModels.find((m) => m.id === modelId);
      if (found) {
        ids.add(found.providerId);
      }
    };
    if (mode === "direct") {
      touch(preferences.directModelId);
    } else if (mode === "side-by-side") {
      touch(preferences.leftModelId);
      touch(preferences.rightModelId);
    } else {
      preferences.battlePoolIds.forEach((id) => touch(id));
    }
    return ids;
  }, [mode, preferences, availableModels]);

  const isModelGroupExpanded = (providerId: string) => {
    if (Object.prototype.hasOwnProperty.call(modelGroupOpenOverride, providerId)) {
      return modelGroupOpenOverride[providerId]!;
    }
    if (providersWithActiveSelection.size > 0) {
      return providersWithActiveSelection.has(providerId);
    }
    const firstId = modelsByProvider[0]?.providerId;
    return Boolean(firstId && firstId === providerId);
  };

  const toggleModelGroup = (providerId: string) => {
    const next = !isModelGroupExpanded(providerId);
    setModelGroupOpenOverride((prev) => ({ ...prev, [providerId]: next }));
  };

  const closeOnMobile = () => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(max-width: 960px)").matches && sidebarOpen) {
      onToggleSidebar();
    }
  };

  const filteredSessions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return sessions
      .filter((session) => {
        if (!query) return true;
        const haystack = [
          session.title,
          getModeLabel(session.mode),
          formatTime(session.updatedAt),
          ...session.turns.flatMap((turn) => [
            turn.prompt,
            ...turn.results.map((result) => result.content)
          ])
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      })
      .map((session, index) => ({
        session,
        displayIndex: index + 1
      }));
  }, [searchTerm, sessions]);

  const groupedSessions = useMemo(() => {
    return filteredSessions.reduce<
      Array<{
        label: string;
        items: Array<{ session: ChatSession; displayIndex: number }>;
      }>
    >((groups, item) => {
      const label = getRelativeDayLabel(item.session.updatedAt);
      const group = groups.find((entry) => entry.label === label);
      if (group) {
        group.items.push(item);
      } else {
        groups.push({ label, items: [item] });
      }
      return groups;
    }, []);
  }, [filteredSessions]);

  const battleCountOptions = Array.from(
    { length: Math.max(0, Math.min(maxCompareModels ?? 6, availableModels.length, 6) - 1) },
    (_item, index) => index + 2
  );
  const activeBattleCount = battleCountOptions.includes(preferences.battleModelCount)
    ? preferences.battleModelCount
    : battleCountOptions.at(-1) ?? 2;
  const workspaceTitle =
    activeTool === "web-summary"
      ? "Trình tóm tắt web"
      : activeTool === "image-gen"
        ? "Bộ tạo hình ảnh"
        : activeTool === "translator"
          ? "AI Biên dịch viên"
          : "All-In-One";

  const handleWorkspaceTitleClick = () => {
    if (!isMobile || activeTool !== "chat") {
      return;
    }
    onMobileFeatureNotice?.(
      "Cần màn hình lớn hơn",
      "Các chế độ <strong>So sánh song song</strong> và <strong>Battle</strong> cần màn hình lớn để hiển thị nhiều cột. Hãy mở trên laptop/desktop để trải nghiệm đầy đủ."
    );
  };

  const openMenuSession = useMemo(
    () => sessions.find((session) => session.id === openMenu?.sessionId) ?? null,
    [openMenu?.sessionId, sessions]
  );

  useEffect(() => {
    if (!openMenu) return;

    const closeMenu = (event: MouseEvent | globalThis.MouseEvent | Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest(".session-menu-shell") || target.closest(".session-menu-popover")) return;
      setOpenMenu(null);
    };

    const handleViewportChange = () => setOpenMenu(null);

    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("scroll", closeMenu, true);
    window.addEventListener("resize", handleViewportChange);

    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [openMenu]);

  useEffect(() => {
    if (activeTool !== "chat" || mode !== "battle") {
      setBattleCountMenuOpen(false);
    }
  }, [activeTool, mode]);

  useEffect(() => {
    if (!battleCountMenuOpen) return;

    const closePicker = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (battlePickerRef.current?.contains(target)) return;
      setBattleCountMenuOpen(false);
    };

    const handleViewportChange = () => setBattleCountMenuOpen(false);

    document.addEventListener("mousedown", closePicker);
    document.addEventListener("scroll", closePicker, true);
    window.addEventListener("resize", handleViewportChange);

    return () => {
      document.removeEventListener("mousedown", closePicker);
      document.removeEventListener("scroll", closePicker, true);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [battleCountMenuOpen]);

  useEffect(() => {
    setAvatarErrored(false);
  }, [userAvatarUrl]);

  const handleOpenMenu = (event: MouseEvent<HTMLButtonElement>, sessionId: string) => {
    event.stopPropagation();
    const triggerRect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 236;
    const menuHeight = 270;
    const viewportPadding = 16;
    const openAbove =
      window.innerHeight - triggerRect.bottom < menuHeight &&
      triggerRect.top > menuHeight + viewportPadding;

    const nextLeft = Math.min(
      Math.max(viewportPadding, triggerRect.right - menuWidth),
      window.innerWidth - menuWidth - viewportPadding
    );

    setOpenMenu((current) =>
      current?.sessionId === sessionId
        ? null
        : {
            sessionId,
            left: nextLeft,
            top: openAbove ? undefined : triggerRect.bottom + 8,
            bottom: openAbove ? window.innerHeight - triggerRect.top + 8 : undefined
          }
    );
  };

  const clearSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds([]);
  };

  const renderModelButton = (
    model: ModelInfo,
    active: boolean,
    extraLabel?: string,
    onClick?: () => void
  ) => (
    <button
      key={model.id}
      type="button"
      className={`sidebar-model-item ${active ? "active" : ""}`}
      onClick={onClick}
      style={{ "--chip-accent": model.accent } as CSSProperties}
    >
      <SidebarModelLogo model={model} />
      <span className="sidebar-model-item__copy">
        <strong>{model.label}</strong>
        <small>{extraLabel ?? model.providerLabel}</small>
      </span>
      {active ? <Check size={13} /> : null}
    </button>
  );

  const renderGroupedModelList = (renderRow: (model: ModelInfo) => ReactNode) => (
    <div className="sidebar-model-groups">
      {modelsByProvider.map(({ providerId, label, models: groupModels }) => {
        const expanded = isModelGroupExpanded(providerId);
        const groupAccent = groupModels[0]?.accent ?? "#4da4ff";
        return (
          <div key={providerId} className="sidebar-model-group">
            <button
              type="button"
              className="sidebar-model-group__trigger"
              onClick={() => toggleModelGroup(providerId)}
              aria-expanded={expanded}
            >
              <span className="sidebar-model-group__heading">
                <ModelAvatarMark
                  providerId={providerId}
                  providerLabel={label}
                  label={label}
                  accent={groupAccent}
                  size={18}
                  className="sidebar-model-group__mark"
                  alt={`${label} logo`}
                />
                <span className="sidebar-model-group__title">{label}</span>
              </span>
              <span className="sidebar-model-group__count">{groupModels.length}</span>
              <ChevronDown size={14} className={expanded ? "sidebar-model-group__chevron rotated" : "sidebar-model-group__chevron"} />
            </button>
            {expanded ? (
              <div className="sidebar-model-group__panel">
                <div className="sidebar-model-list sidebar-model-list--grouped">{groupModels.map((model) => renderRow(model))}</div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );

  const renderModelSection = () => {
    if (isMobile) {
      return renderGroupedModelList((model) =>
        renderModelButton(
          model,
          preferences.directModelId === model.id,
          undefined,
          () => onModelChange("directModelId", model.id)
        )
      );
    }

    if (mode === "direct") {
      return renderGroupedModelList((model) =>
        renderModelButton(
          model,
          preferences.directModelId === model.id,
          undefined,
          () => onModelChange("directModelId", model.id)
        )
      );
    }

    if (mode === "side-by-side") {
      return (
        <>
          <div className="sidebar-segmented">
            <button
              type="button"
              className={sideCompareTarget === "leftModelId" ? "active" : ""}
              onClick={() => setSideCompareTarget("leftModelId")}
            >
              Model A
            </button>
            <button
              type="button"
              className={sideCompareTarget === "rightModelId" ? "active" : ""}
              onClick={() => setSideCompareTarget("rightModelId")}
            >
              Model B
            </button>
          </div>
          {renderGroupedModelList((model) =>
            renderModelButton(
              model,
              preferences[sideCompareTarget] === model.id,
              sideCompareTarget === "leftModelId" ? "Cột bên trái" : "Cột bên phải",
              () => onModelChange(sideCompareTarget, model.id)
            )
          )}
        </>
      );
    }

    return renderGroupedModelList((model) => {
      const order = preferences.battlePoolIds.indexOf(model.id);
      return renderModelButton(
        model,
        order >= 0,
        order >= 0 ? `Vị trí ${order + 1}` : model.providerLabel,
        () => onBattleToggle(model.id)
      );
    });
  };

  const usageMetricMap = useMemo(
    () => new Map((usageSummary?.metrics ?? []).map((metric) => [metric.key, metric])),
    [usageSummary?.metrics]
  );

  const sidebarUsageMetrics = useMemo(
    () =>
      ["chat", "upload", "image_generation", "web_search"]
        .map((key) => usageMetricMap.get(key))
        .filter((metric): metric is UsageMetric => Boolean(metric)),
    [usageMetricMap]
  );

  const handleUpgradeLockedAction = () => {
    onOpenUpgrade();
    closeOnMobile();
  };

  if (!sidebarOpen) {
    return (
      <aside className="sidebar sidebar--chat-hub collapsed">
        <div className="sidebar-mini-top">
          <button
            type="button"
            className="brand-mark brand-mark--icon"
            onClick={onOpenMainSite}
            aria-label="Về trang chủ trungtammmo.vn"
            title="Về trang chủ trungtammmo.vn"
          >
            <img src={brandIconSrc} alt="AI TTM" />
          </button>
          <button
            type="button"
            className="sidebar-toggle"
            aria-label="Mở thanh bên"
            onClick={onToggleSidebar}
          >
            <ChevronDown size={18} />
          </button>
        </div>

        <div className="sidebar-mini-actions">
          <button type="button" className="sidebar-icon-button" onClick={() => onSelectTool("chat")} title="Không gian chat">
            <Compass size={16} />
          </button>
          <button
            type="button"
            className="sidebar-icon-button"
            onClick={() => (imageRequiresUpgrade ? handleUpgradeLockedAction() : onSelectTool("image-gen"))}
            title={imageRequiresUpgrade ? "Gói hiện tại cần nâng cấp để dùng chức năng này" : "Bộ tạo hình ảnh"}
          >
            <ImagePlus size={16} />
          </button>
          <button
            type="button"
            className="sidebar-icon-button"
            onClick={() => (translatorRequiresUpgrade ? handleUpgradeLockedAction() : onSelectTool("translator"))}
            title={translatorRequiresUpgrade ? "Gói hiện tại cần nâng cấp để dùng chức năng này" : "AI Biên dịch viên"}
          >
            <Languages size={16} />
          </button>
          <button
            type="button"
            className="sidebar-icon-button"
            onClick={() => (webSummaryRequiresUpgrade ? handleUpgradeLockedAction() : onSelectTool("web-summary"))}
            title={webSummaryRequiresUpgrade ? "Gói hiện tại cần nâng cấp để dùng chức năng này" : "Tóm tắt web"}
          >
            <Globe2 size={16} />
          </button>
          <button type="button" className="sidebar-icon-button" onClick={onNewChat} title="Cuộc trò chuyện mới">
            <Plus size={16} />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="sidebar sidebar--chat-hub">
      <div className="sidebar-topbar">
        <button
          type="button"
          className="brand-block brand-block--chat-hub brand-block--logo-only brand-block--main-site"
          onClick={onOpenMainSite}
          aria-label="Về trang chủ trungtammmo.vn"
          title="Về trang chủ trungtammmo.vn"
        >
          <img src={brandLogoSrc} alt="AI TTM" className="brand-logo brand-logo--sidebar" />
        </button>

        <button
          type="button"
          className="sidebar-toggle"
          aria-label="Thu gọn thanh bên"
          onClick={onToggleSidebar}
        >
          <AlignJustify size={17} />
        </button>
      </div>

      <button
        className="sidebar-nav-button is-primary sidebar-nav-button--chat-hub"
        onClick={() => {
          if (isFreePlanLocked) {
            handleUpgradeLockedAction();
            return;
          }
          onSelectTool("chat");
          onNewChat();
          closeOnMobile();
        }}
        type="button"
      >
        <Plus size={15} />
        Cuộc trò chuyện mới
      </button>

      <div className="sidebar-body">
        <div className="sidebar-section sidebar-section--compact">
          <div className="section-row">
            <p className="section-label">Không gian</p>
          </div>

          <div className="sidebar-mode-card">
            {isMobile && activeTool === "chat" ? (
              <button
                type="button"
                className="sidebar-mode-card__title sidebar-mode-card__title--trigger"
                onClick={handleWorkspaceTitleClick}
              >
                <Compass size={15} />
                <span>{workspaceTitle}</span>
              </button>
            ) : (
              <div className="sidebar-mode-card__title">
                <Compass size={15} />
                <span>{workspaceTitle}</span>
              </div>
            )}
            <div className="sidebar-mode-switcher">
              {modeItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.mode}
                    type="button"
                    className={mode === item.mode && activeTool === "chat" ? "active" : ""}
                    onClick={() => {
                      if (isFreePlanLocked) {
                        handleUpgradeLockedAction();
                        return;
                      }
                      onSelectTool("chat");
                      if (isMobile && item.mode !== "direct") {
                        onMobileFeatureNotice?.(
                          "Cần màn hình lớn hơn",
                          `Chế độ <strong>${item.mode === "battle" ? "Battle" : "So sánh song song"}</strong> cần màn hình lớn để hiển thị nhiều cột. Hãy mở trên laptop/desktop để trải nghiệm đầy đủ.`
                        );
                        return;
                      }
                      onModeChange(item.mode);
                    }}
                    title={item.label}
                  >
                    <Icon size={14} />
                  </button>
                );
              })}
            </div>
            {!isMobile && activeTool === "chat" && mode === "battle" && battleCountOptions.length > 0 ? (
              <div className="sidebar-battle-picker" ref={battlePickerRef}>
                <button
                  type="button"
                  className={`sidebar-battle-picker__trigger ${battleCountMenuOpen ? "is-open" : ""}`}
                  onClick={() => setBattleCountMenuOpen((current) => !current)}
                  aria-expanded={battleCountMenuOpen}
                  aria-label="Chọn số lượng model"
                >
                  <span className="sidebar-battle-picker__copy">
                    <small>Số model cùng lúc</small>
                    <strong>{activeBattleCount} model</strong>
                  </span>
                  <ChevronDown size={15} className={battleCountMenuOpen ? "rotated" : ""} />
                </button>

                <AnimatePresence>
                  {battleCountMenuOpen ? (
                    <motion.div
                      className="sidebar-battle-picker__menu"
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                    >
                      {battleCountOptions.map((count) => (
                        <button
                          key={count}
                          type="button"
                          className={activeBattleCount === count ? "active" : ""}
                          onClick={() => {
                            onBattleCountChange(count);
                            setBattleCountMenuOpen(false);
                          }}
                        >
                          {count} model
                        </button>
                      ))}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            ) : null}
          </div>
        </div>

        <div className="sidebar-section sidebar-section--compact sidebar-section--history">
          <div className="section-row">
            <button
              type="button"
              className="history-collapse-trigger"
              onClick={() => setHistoryExpanded((current) => !current)}
            >
              <span className="section-label">Lịch sử</span>
              <ChevronDown size={14} className={historyExpanded ? "rotated" : ""} />
            </button>
            <div className="section-actions">
              <span className="section-meta">{filteredSessions.length}</span>
              <button
                type="button"
                className="history-mini-action"
                onClick={() => setSelectionMode((current) => !current)}
                title="Chọn nhiều"
              >
                <CheckSquare size={13} />
              </button>
            </div>
          </div>

          {historyExpanded && (
            <>
              <label className="history-search history-search--compact">
                <Search size={14} />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Tìm lịch sử..."
                />
              </label>

              {selectionMode && (
                <div className="history-bulk-bar history-bulk-bar--compact">
                  <span>{selectedIds.length} mục</span>
                  <div>
                    <button type="button" className="ghost-button" onClick={() => clearSelectionMode()}>
                      Bỏ
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      disabled={!selectedIds.length}
                      onClick={() => void onBatchDelete(selectedIds).then(() => clearSelectionMode())}
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              )}

              <div className="session-list session-list--compact">
                {groupedSessions.map((group) => (
                  <section key={group.label} className="history-group history-group--compact">
                    <div className="history-group__label">{group.label}</div>

                    {group.items.slice(0, 8).map(({ session, displayIndex }) => {
                      const isEditing = editingSessionId === session.id;
                      const isSelected = selectedIds.includes(session.id);
                      return (
                        <motion.div
                          key={session.id}
                          className={`session-item session-item--compact ${activeSessionId === session.id ? "active" : ""}`}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                        >
                          {selectionMode ? (
                            <button
                              type="button"
                              className={`session-select ${isSelected ? "selected" : ""}`}
                              onClick={() =>
                                setSelectedIds((current) =>
                                  current.includes(session.id)
                                    ? current.filter((id) => id !== session.id)
                                    : [...current, session.id]
                                )
                              }
                            >
                              {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                            </button>
                          ) : null}

                          <button
                            type="button"
                            className="session-item__button"
                            onClick={() => {
                              onSelectTool("chat");
                              onSelectSession(session.id);
                              closeOnMobile();
                            }}
                          >
                            <div className="session-item__content">
                              {isEditing ? (
                                <input
                                  className="session-inline-input"
                                  value={editingValue}
                                  autoFocus
                                  onChange={(event) => setEditingValue(event.target.value)}
                                  onBlur={() => {
                                    const value = editingValue.trim();
                                    if (value && value !== session.title) {
                                      void onRenameSession(session.id, value);
                                    }
                                    setEditingSessionId("");
                                    setEditingValue("");
                                    setOpenMenu(null);
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      const value = editingValue.trim();
                                      if (value && value !== session.title) {
                                        void onRenameSession(session.id, value);
                                      }
                                      setEditingSessionId("");
                                      setEditingValue("");
                                      setOpenMenu(null);
                                    }
                                    if (event.key === "Escape") {
                                      setEditingSessionId("");
                                      setEditingValue("");
                                      setOpenMenu(null);
                                    }
                                  }}
                                />
                              ) : (
                                <strong>{truncate(session.title, 26)}</strong>
                              )}
                              <div className="session-item__meta">
                                <span>{formatTime(session.updatedAt)}</span>
                                <span>#{displayIndex}</span>
                              </div>
                            </div>
                          </button>

                          {!selectionMode && (
                            <div className="session-menu-shell">
                              <button
                                type="button"
                                className="session-menu-trigger"
                                aria-label={`Mở menu thao tác cho ${session.title}`}
                                onClick={(event) => handleOpenMenu(event, session.id)}
                              >
                                <MoreHorizontal size={15} />
                              </button>
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </section>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="sidebar-section sidebar-section--compact">
          <p className="section-label">Công cụ</p>
          <div className="sidebar-tool-list">
            <button
              type="button"
              className={`sidebar-tool-item ${activeTool === "image-gen" ? "active" : ""}`}
              onClick={() => (imageRequiresUpgrade ? handleUpgradeLockedAction() : onSelectTool("image-gen"))}
              title={imageRequiresUpgrade ? "Gói hiện tại cần nâng cấp để dùng chức năng này" : "Bộ tạo hình ảnh"}
            >
              <ImagePlus size={15} />
              <span>Bộ tạo hình ảnh</span>
            </button>
            <button
              type="button"
              className={`sidebar-tool-item ${activeTool === "translator" ? "active" : ""}`}
              onClick={() => (translatorRequiresUpgrade ? handleUpgradeLockedAction() : onSelectTool("translator"))}
              title={translatorRequiresUpgrade ? "Gói hiện tại cần nâng cấp để dùng chức năng này" : "AI Biên dịch viên"}
            >
              <Languages size={15} />
              <span>AI Biên dịch viên</span>
            </button>
            <button
              type="button"
              className={`sidebar-tool-item ${activeTool === "web-summary" ? "active" : ""}`}
              onClick={() => (webSummaryRequiresUpgrade ? handleUpgradeLockedAction() : onSelectTool("web-summary"))}
              title={webSummaryRequiresUpgrade ? "Gói hiện tại cần nâng cấp để dùng chức năng này" : "Trình tóm tắt web"}
            >
              <Globe2 size={15} />
              <span>Trình tóm tắt web</span>
            </button>
          </div>
        </div>

        {!hideModelsForPlan && !(activeTool === "chat" && mode === "battle" && !isMobile) ? (
          <div className="sidebar-section sidebar-section--compact sidebar-section--models">
            <div className="section-row">
              <p className="section-label">Mô hình</p>
              <span className="section-meta">{availableModels.length}</span>
            </div>
            {renderModelSection()}
          </div>
        ) : null}
      </div>

      {openMenuSession && openMenu && !selectionMode && (
        <div
          className="session-menu-popover"
          style={{
            left: openMenu.left,
            ...(openMenu.top !== undefined ? { top: openMenu.top } : {}),
            ...(openMenu.bottom !== undefined ? { bottom: openMenu.bottom } : {})
          }}
        >
          <button
            type="button"
            className="session-menu-item"
            onClick={() => {
              void onTogglePinSession(openMenuSession.id);
              setOpenMenu(null);
            }}
          >
            <Pin size={14} />
            {openMenuSession.isPinned ? "Bỏ ghim" : "Ghim cuộc trò chuyện"}
          </button>
          <button
            type="button"
            className="session-menu-item"
            onClick={() => {
              setEditingSessionId(openMenuSession.id);
              setEditingValue(openMenuSession.title);
              setOpenMenu(null);
            }}
          >
            <PencilLine size={14} />
            Đổi tên
          </button>
          <button
            type="button"
            className="session-menu-item"
            onClick={() => {
              void onShareSession(openMenuSession.id);
              setOpenMenu(null);
            }}
          >
            <Share2 size={14} />
            Chia sẻ
          </button>
          <button
            type="button"
            className="session-menu-item"
            onClick={() => {
              void onExportSession(openMenuSession.id, "markdown");
              setOpenMenu(null);
            }}
          >
            <Download size={14} />
            Xuất Markdown
          </button>
          <button
            type="button"
            className="session-menu-item danger"
            disabled={deletingSessionId === openMenuSession.id}
            onClick={() => {
              onRequestDeleteSession(openMenuSession);
              setOpenMenu(null);
            }}
          >
            <Trash2 size={14} />
            Xóa
          </button>
        </div>
      )}

      <div className="sidebar-footer sidebar-footer--chat-hub">
        {usageSummary ? (
          <div className="sidebar-usage-card">
            <div className="sidebar-usage-card__head">
              <div className="sidebar-usage-card__copy">
                <strong>Theo dõi quota</strong>
                <span>Giới hạn đang dùng theo gói hiện tại</span>
              </div>
              <span className="sidebar-usage-card__plan">
                {usageSummary.planName || currentPlanName || "Free"}
              </span>
            </div>

            <div className="sidebar-usage-card__list">
              {sidebarUsageMetrics.map((metric) => {
                const isUnlimited = metric.enabled && metric.limit == null;
                const progressWidth = isUnlimited ? 18 : Math.max(6, metric.percentUsed || 0);
                const statusText = !metric.enabled
                  ? "Tắt"
                  : metric.limit == null
                    ? `${metric.used} / ∞`
                    : `${metric.used} / ${metric.limit}`;
                return (
                  <div key={metric.key} className={`sidebar-usage-metric ${!metric.enabled ? "is-disabled" : ""}`}>
                    <div className="sidebar-usage-metric__top">
                      <span>{metric.label}</span>
                      <span>{statusText}</span>
                    </div>
                    <div className="sidebar-usage-metric__track" aria-hidden="true">
                      <span
                        className={`sidebar-usage-metric__fill ${isUnlimited ? "is-unlimited" : ""}`}
                        style={{ width: `${Math.min(100, progressWidth)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <button type="button" className="sidebar-usage-card__action" onClick={onOpenUpgrade}>
              <Sparkles size={14} />
              Nâng cấp
            </button>
          </div>
        ) : !currentPlanIsPaid ? (
          <div className="sidebar-upgrade-card">
            <div className="sidebar-upgrade-card__copy">
              <strong>Nâng cấp</strong>
              <span>Mở thêm quota và model mạnh hơn</span>
            </div>
            <button type="button" onClick={onOpenUpgrade}>
              <Sparkles size={14} />
              Upgrade
            </button>
          </div>
        ) : null}

        <div className="sidebar-profile">
          <div className="sidebar-profile__avatar">
            {userAvatarUrl && !avatarErrored ? (
              <img
                src={userAvatarUrl}
                alt={userName}
                className="sidebar-profile__avatar-image"
                onError={() => setAvatarErrored(true)}
              />
            ) : (
              userName.slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="sidebar-profile__content">
            <strong>{userName}</strong>
            <span>Phiên hiện tại</span>
          </div>
        </div>

        <button
          type="button"
          className="ghost-button sidebar-logout"
          onClick={() => {
            onResetSession();
            closeOnMobile();
          }}
        >
          <LogOut size={14} />
          Đăng xuất
        </button>
      </div>
    </aside>
  );
}
import { toAiAssetUrl } from "../lib/runtime";
