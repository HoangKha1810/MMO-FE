import { AnimatePresence, motion } from "framer-motion";
import {
  Boxes,
  Compass,
  Globe2,
  ImagePlus,
  Languages,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldUser,
  Sparkles,
  Swords
} from "lucide-react";
import type { ThemeMode } from "../lib/storage";
import { ArenaMode, ModelInfo, WorkspaceTool } from "../lib/types";
import { getModeLabel } from "../lib/utils";
import { BalanceDisplay } from "./BalanceDisplay";
import { AnimatedThemeToggler } from "./ui/AnimatedThemeToggler";
import { ModelDropdown } from "./ModelDropdown";

interface HeaderBarProps {
  currentTool: WorkspaceTool;
  mode: ArenaMode;
  balanceVnd?: number | null;
  currentPlanName?: string | null;
  isFreePlanLocked?: boolean;
  hideModelsForPlan?: boolean;
  sidebarOpen: boolean;
  theme: ThemeMode;
  isMobile?: boolean;
  models?: ModelInfo[];
  selectedModelId?: string;
  onModelChange?: (key: "directModelId" | "leftModelId" | "rightModelId", value: string) => void;
  showAdminButton?: boolean;
  onToggleSidebar: () => void;
  onToggleTheme: () => void;
  onOpenUpgrade: () => void;
  onOpenAdmin: () => void;
  onBalanceTopUp: () => void;
  onModeChange?: (mode: ArenaMode) => void;
  onMobileFeatureNotice?: (title: string, message: string) => void;
}

export function HeaderBar({
  currentTool,
  mode,
  balanceVnd,
  currentPlanName,
  isFreePlanLocked = false,
  hideModelsForPlan = false,
  sidebarOpen,
  theme,
  isMobile = false,
  models = [],
  selectedModelId,
  onModelChange,
  showAdminButton = false,
  onToggleSidebar,
  onToggleTheme,
  onOpenUpgrade,
  onOpenAdmin,
  onBalanceTopUp,
  onModeChange,
  onMobileFeatureNotice
}: HeaderBarProps) {
  const SidebarToggleIcon = sidebarOpen ? PanelLeftClose : PanelLeftOpen;
  const currentToolLabel =
    currentTool === "web-summary"
      ? "Trình tóm tắt web"
      : currentTool === "image-gen"
        ? "Bộ tạo hình ảnh"
        : currentTool === "translator"
          ? "AI Biên dịch viên"
          : "All-In-One";
  const CurrentToolIcon =
    currentTool === "web-summary"
      ? Globe2
      : currentTool === "image-gen"
        ? ImagePlus
        : currentTool === "translator"
          ? Languages
          : Compass;
  const availableModels = models.filter((model) => model.available);
  const selectedMobileModel =
    availableModels.find((model) => model.id === selectedModelId) ??
    models.find((model) => model.id === selectedModelId) ??
    null;

  const modeItems = [
    { mode: "direct" as const, icon: Compass, label: "1 nguồn" },
    { mode: "side-by-side" as const, icon: Boxes, label: "Song song" },
    { mode: "battle" as const, icon: Swords, label: "Battle" }
  ];

  const handleModeClick = (targetMode: ArenaMode) => {
    if (isMobile && targetMode !== "direct") {
      onMobileFeatureNotice?.(
        "Cần màn hình lớn hơn",
        `Chế độ <strong>${targetMode === "battle" ? "Battle" : "So sánh song song"}</strong> cần màn hình lớn để hiển thị nhiều cột. Hãy mở trên laptop/desktop để trải nghiệm đầy đủ.`
      );
      return;
    }
    onModeChange?.(targetMode);
  };

  return (
    <motion.header
      className="header-bar header-bar--chat-hub"
      layout
      transition={{ type: "spring", stiffness: 180, damping: 24 }}
    >
      <div className="header-bar__compact">
        <div className="compact-navbar-left compact-navbar-left--chat-hub">
          <button
            type="button"
            className="navbar-toggle-button navbar-toggle-button--mobile"
            onClick={onToggleSidebar}
            aria-label={sidebarOpen ? "Thu gọn thanh bên" : "Mở thanh bên"}
          >
            <SidebarToggleIcon size={16} />
          </button>

          {(isMobile || currentTool !== "chat") && (
            <div className="header-bar__tool-pill">
              <CurrentToolIcon size={14} />
              {isMobile && currentTool === "chat" && !hideModelsForPlan ? (
                <div className="header-bar__mobile-model-wrap">
                  <ModelDropdown
                    variant="mobile-header"
                    model={selectedMobileModel}
                    models={models}
                    onChange={(id) => onModelChange?.("directModelId", id)}
                    placeholderLabel="Chọn model"
                    placeholderMeta="Trò chuyện 1 nguồn"
                    ariaLabel="Chọn model trên điện thoại"
                  />
                </div>
              ) : (
                <>
                  <span>{currentToolLabel}</span>
                  {currentTool === "chat" ? (
                    <small>{isFreePlanLocked ? "Vui lòng nâng cấp để dùng" : getModeLabel(mode)}</small>
                  ) : null}
                </>
              )}
            </div>
          )}

          {currentTool === "chat" && isMobile && (
            <div className="header-bar__mode-selector">
              {modeItems.map((item) => {
                const isActive = mode === item.mode;
                const Icon = item.icon;
                return (
                  <button
                    key={item.mode}
                    type="button"
                    className={`mode-button ${isActive ? "mode-button--active" : ""}`}
                    onClick={() => handleModeClick(item.mode)}
                    title={item.label}
                  >
                    <Icon size={14} />
                    {!isMobile && <span>{item.label}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="header-bar__actions">
          <BalanceDisplay
            balanceVnd={balanceVnd}
            planLabel={currentPlanName}
            onTopUp={onBalanceTopUp}
            showTopUpButton={false}
          />

          <button
            type="button"
            className="upgrade-trigger-button upgrade-trigger-button--compact"
            onClick={onOpenUpgrade}
            title="Mở trang nâng cấp"
          >
            <Sparkles size={14} />
            Upgrade
          </button>

          {showAdminButton && (
            <button
              type="button"
              className="ghost-button ghost-button--header"
              onClick={onOpenAdmin}
              title="Mở trang quản trị"
            >
              <ShieldUser size={14} />
              Admin
            </button>
          )}

          <AnimatedThemeToggler className="theme-toggle-button" />
        </div>
      </div>
    </motion.header>
  );
}
