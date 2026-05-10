import { Crown, Monitor } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AdminPricingScreen } from "./components/AdminPricingScreen";
import { AuthScreen } from "./components/AuthScreen";
import { BackgroundDecor } from "./components/BackgroundDecor";
import { ChatBoard } from "./components/ChatBoard";
import { Composer } from "./components/Composer";
import { GradientLoader } from "./components/GradientLoader";
import { HeaderBar } from "./components/HeaderBar";
import { PopupDialog } from "./components/PopupDialog";
import { SeoMeta } from "./components/SeoMeta";
import { Sidebar } from "./components/Sidebar";
import { UpgradePage } from "./components/UpgradePage";
import { WelcomeSplash } from "./components/WelcomeSplash";
import { ImageGenPanel } from "./components/ImageGenPanel";
import { TranslatorPanel } from "./components/TranslatorPanel";
import { WebSummaryPanel } from "./components/WebSummaryPanel";
import { useArena } from "./hooks/useArena";
import { generateImageTool, summarizeWebsite, translateTextTool } from "./lib/api";
import { AI_ADMIN_BASE, AI_ROUTE_BASE, AI_SHARED_BASE, AI_UPGRADE_BASE, normalizeAiPath, shouldReduceAiMotion, toAiAssetUrl } from "./lib/runtime";
import { loadTheme, saveTheme, type ThemeMode } from "./lib/storage";
import { DEPOSIT_URL, MAIN_SITE_ORIGIN } from "./lib/siteUrls";
import {
  ChatSession,
  PricingToolQuota,
  ToolImageGenerateResponse,
  User,
  WebSummaryResponse,
  WorkspaceTool
} from "./lib/types";

const describeSession = (session?: ChatSession | null) => {
  if (!session) {
    return "Không gian chat AI đa mô hình của TrungTamMMO với trò chuyện trực tiếp, so sánh song song và battle mode.";
  }

  const firstTurn = session.turns[0];
  const firstPrompt = firstTurn?.prompt?.trim();
  if (firstPrompt) {
    return `Cuộc trò chuyện "${session.title}" trên AI TTM. Nội dung mở đầu: ${firstPrompt.slice(0, 140)}${firstPrompt.length > 140 ? "..." : ""}`;
  }

  return `Cuộc trò chuyện "${session.title}" trên AI TTM.`;
};

const normalizePathname = (value: string) => {
  const normalized = (value || "/").replace(/\/+$/, "");
  return normalized || "/";
};

const SIDEBAR_WIDTH_STORAGE_KEY = "ttmmo-ai-arena-sidebar-width";
const DEFAULT_SIDEBAR_WIDTH = 260;
const MIN_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH = 420;
const FREE_PLAN_UPGRADE_POPUP_KEY_PREFIX = "ttmmo-ai-free-plan-upgrade-popup-seen";

const clampSidebarWidth = (value: number) =>
  Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, Math.round(value)));

const ADMIN_ROLES = new Set(["admin", "administrator", "superadmin", "super_admin", "owner", "root"]);

const isAdminUser = (authUser?: User | null) => {
  const role = (authUser?.role ?? "").trim().toLowerCase();
  return ADMIN_ROLES.has(role);
};

const isFreePlanUser = (authUser?: User | null) => {
  if (!authUser) {
    return false;
  }
  if (isAdminUser(authUser)) {
    return false;
  }

  const currentPlanLabel = (
    authUser.currentPlanName ??
    authUser.usageSummary?.planName ??
    ""
  )
    .trim()
    .toLowerCase();
  const isPaidPlan = authUser.currentPlanIsPaid ?? authUser.usageSummary?.isPaid ?? false;
  return !isPaidPlan && (!currentPlanLabel || currentPlanLabel === "free");
};

const toolQuotaFor = (
  authUser: User | null | undefined,
  key: keyof NonNullable<NonNullable<User["currentLimits"]>["toolQuotas"]>
): PricingToolQuota | null => {
  return authUser?.currentLimits?.toolQuotas?.[key] ?? null;
};

const isUpgradeRequiredForTool = (
  authUser: User | null | undefined,
  key: keyof NonNullable<NonNullable<User["currentLimits"]>["toolQuotas"]>
) => {
  if (!authUser || isAdminUser(authUser)) {
    return false;
  }
  const quota = toolQuotaFor(authUser, key);
  if (!quota) {
    return false;
  }
  return quota.enabled === false || quota.limit === 0;
};

function App() {
  const [input, setInput] = useState("");
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [activeTool, setActiveTool] = useState<WorkspaceTool>("chat");
  const [webSummaryUrl, setWebSummaryUrl] = useState("");
  const [webSummaryLoading, setWebSummaryLoading] = useState(false);
  const [webSummaryResult, setWebSummaryResult] = useState<WebSummaryResponse | null>(null);
  const [webSummaryError, setWebSummaryError] = useState<string | null>(null);
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageModelId, setImageModelId] = useState("gemini:gemini-3.1-flash-image-preview");
  const [imageSize, setImageSize] = useState("auto");
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageResult, setImageResult] = useState<ToolImageGenerateResponse | null>(null);
  const [translatorText, setTranslatorText] = useState("");
  const [translatorSourceLang, setTranslatorSourceLang] = useState("auto");
  const [translatorTargetLang, setTranslatorTargetLang] = useState("en");
  const [translatorModelId, setTranslatorModelId] = useState("");
  const [translatorLoading, setTranslatorLoading] = useState(false);
  const [translatorError, setTranslatorError] = useState<string | null>(null);
  const [translatorResult, setTranslatorResult] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChatSession | null>(null);
  const [deleteDialogError, setDeleteDialogError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }

    return window.innerWidth > 960;
  });
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window === "undefined") {
      return DEFAULT_SIDEBAR_WIDTH;
    }

    const stored = window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
    const parsed = stored ? Number(stored) : Number.NaN;
    return Number.isFinite(parsed) ? clampSidebarWidth(parsed) : DEFAULT_SIDEBAR_WIDTH;
  });
  const [theme, setTheme] = useState<ThemeMode>(loadTheme);
  const [themeTransitionKey, setThemeTransitionKey] = useState<number | null>(null);
  const [showWelcomeSplash, setShowWelcomeSplash] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth <= 768;
  });
  const [mobileWarningMessage, setMobileWarningMessage] = useState<{ title: string; message: string } | null>(null);
  const [showFreePlanUpgradePrompt, setShowFreePlanUpgradePrompt] = useState(false);
  const [pathname, setPathname] = useState(() =>
    typeof window === "undefined" ? AI_ROUTE_BASE : normalizePathname(window.location.pathname)
  );
  const welcomeCompletedRef = useRef(false);
  const sidebarResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const {
    catalog,
    availableModels,
    preferences,
    sessions,
    activeSession,
    activeSessionId,
    loadingCatalog,
    backendOnline,
    sending,
    stopping,
    uploading,
    deletingSessionId,
    error,
    clearError,
    authUser,
    authReady,
    sharedSession,
    isSharedView,
    pendingAttachments,
    selectSession,
    createNewSession,
    login,
    register,
    loginAdmin,
    updateMode,
    updateModelPreference,
    toggleBattlePoolModel,
    updateBattleModelCount,
    setBattlePoolModelAt,
    deleteSession,
    deleteMultipleSessions,
    renameSession,
    togglePinSession,
    shareSession,
    exportSession,
    sendPrompt,
    stopStreaming,
    revealTurn,
    voteTurn,
    regenerateTurn,
    continueTurn,
    uploadFiles,
    removePendingAttachment,
    logout,
    refreshAuthProfile
  } = useArena();
  const currentPath = normalizePathname(pathname);
  const isUpgradeRoute = currentPath === AI_UPGRADE_BASE;
  const isAdminRoute = currentPath === AI_ADMIN_BASE;
  const freePlanUser = isFreePlanUser(authUser);
  const isFreePlanLocked = isUpgradeRequiredForTool(authUser, "chat");
  const isImageUpgradeRequired = isUpgradeRequiredForTool(authUser, "imageGeneration");
  const isTranslatorUpgradeRequired = isUpgradeRequiredForTool(authUser, "translator");
  const isUploadUpgradeRequired = isUpgradeRequiredForTool(authUser, "upload");
  const isWebSummaryUpgradeRequired = isUpgradeRequiredForTool(authUser, "webSummary");
  const isWebSearchUpgradeRequired = isUpgradeRequiredForTool(authUser, "webSearch");

  const canSend =
    backendOnline &&
    authReady &&
    Boolean(authUser) &&
    !isFreePlanLocked &&
    !loadingCatalog &&
    !sending &&
    (preferences.mode === "direct"
      ? Boolean(preferences.directModelId)
      : preferences.mode === "side-by-side"
        ? Boolean(preferences.leftModelId) && Boolean(preferences.rightModelId)
        : preferences.battlePoolIds.length >= 2);
  const canStopStreaming =
    sending || Boolean(activeSession?.turns.some((turn) => turn.isStreaming));

  const isConversationActive = Boolean(activeSession?.turns.length) || sending;
  const isChatWorkspace = activeTool === "chat";
  const shellChatActive = isChatWorkspace && isConversationActive;

  useEffect(() => {
    if (translatorModelId) {
      return;
    }
    const available = catalog.models.filter((model) => model.available);
    const preferred = preferences.directModelId;
    if (preferred && available.some((model) => model.id === preferred)) {
      setTranslatorModelId(preferred);
    } else if (available[0]) {
      setTranslatorModelId(available[0].id);
    }
  }, [catalog.models, preferences.directModelId, translatorModelId]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    saveTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    const handlePopState = () => {
      setPathname(normalizePathname(window.location.pathname));
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!sidebarResizeRef.current) {
        return;
      }

      const delta = event.clientX - sidebarResizeRef.current.startX;
      setSidebarWidth(clampSidebarWidth(sidebarResizeRef.current.startWidth + delta));
    };

    const stopResize = () => {
      if (!sidebarResizeRef.current) {
        return;
      }

      sidebarResizeRef.current = null;
      document.body.classList.remove("is-resizing-sidebar");
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("pointercancel", stopResize);
    };
  }, []);

  useEffect(() => {
    if (!themeTransitionKey) {
      return;
    }

    const timeout = window.setTimeout(() => setThemeTransitionKey(null), 560);
    return () => window.clearTimeout(timeout);
  }, [themeTransitionKey]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const updateMotionPreference = () => {
      setReduceMotion(shouldReduceAiMotion());
    };

    updateMotionPreference();
    window.addEventListener("resize", updateMotionPreference);
    window.addEventListener("orientationchange", updateMotionPreference);

    return () => {
      window.removeEventListener("resize", updateMotionPreference);
      window.removeEventListener("orientationchange", updateMotionPreference);
    };
  }, []);

  useEffect(() => {
    if (isMobile && preferences.mode !== "direct") {
      updateMode("direct");
    }
  }, [isMobile, preferences.mode, updateMode]);

  useEffect(() => {
    if (preferences.mode !== "direct" && useWebSearch) {
      setUseWebSearch(false);
    }
  }, [preferences.mode, useWebSearch]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!authReady || !authUser || isUpgradeRoute || isAdminRoute) {
      setShowFreePlanUpgradePrompt(false);
      return;
    }

    if (!freePlanUser) {
      setShowFreePlanUpgradePrompt(false);
      return;
    }

    const popupStorageKey = `${FREE_PLAN_UPGRADE_POPUP_KEY_PREFIX}:${authUser.id}`;
    if (window.sessionStorage.getItem(popupStorageKey) === "1") {
      return;
    }

    window.sessionStorage.setItem(popupStorageKey, "1");
    setShowFreePlanUpgradePrompt(true);
  }, [
    authReady,
    authUser,
    isAdminRoute,
    isUpgradeRoute
  ]);

  const handleWelcomeComplete = () => {
    if (welcomeCompletedRef.current) {
      return;
    }

    welcomeCompletedRef.current = true;
    setShowWelcomeSplash(false);
  };

  const handleSidebarResizeStart = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (typeof window === "undefined" || !sidebarOpen) {
      return;
    }

    if (window.matchMedia("(max-width: 960px)").matches) {
      return;
    }

    sidebarResizeRef.current = {
      startX: event.clientX,
      startWidth: sidebarWidth
    };
    document.body.classList.add("is-resizing-sidebar");
  };

  const toggleTheme = () => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
    setThemeTransitionKey(Date.now());
  };

  const navigateTo = (nextPath: string) => {
    if (typeof window === "undefined") {
      return;
    }

    const normalized = normalizeAiPath(nextPath);
    if (normalized === normalizePathname(window.location.pathname)) {
      setPathname(normalized);
      return;
    }

    window.history.pushState({}, "", normalized);
    setPathname(normalized);
  };

  const goToDeposit = () => {
    if (typeof window === "undefined") {
      return;
    }
    window.location.assign(DEPOSIT_URL);
  };

  const goToMainSite = () => {
    if (typeof window === "undefined") {
      return;
    }
    window.location.assign(MAIN_SITE_ORIGIN);
  };

  const themeTransitionOverlay = (
    <AnimatePresence>
      {themeTransitionKey ? (
        <motion.div
          key={themeTransitionKey}
          className="theme-transition-overlay"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: [0, 0.32, 0], scale: [0.94, 1.01, 1.06] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.56, ease: "easeInOut" }}
        />
      ) : null}
    </AnimatePresence>
  );

  const handleConfirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    try {
      setDeleteDialogError(null);
      await deleteSession(deleteTarget.id);
      setDeleteTarget(null);
    } catch (deleteError) {
      setDeleteDialogError(
        deleteError instanceof Error
          ? deleteError.message
          : "Không thể xóa cuộc trò chuyện này."
      );
    }
  };

  const handleRunWebSummary = async () => {
    if (!authUser || !webSummaryUrl.trim()) {
      return;
    }

    setWebSummaryLoading(true);
    setWebSummaryError(null);
    try {
      const response = await summarizeWebsite({
        url: webSummaryUrl.trim(),
        mode: preferences.mode,
        directModelId: preferences.directModelId,
        leftModelId: preferences.leftModelId,
        rightModelId: preferences.rightModelId,
        battlePoolIds: preferences.battlePoolIds
      });
      setWebSummaryResult(response);
      void refreshAuthProfile();
    } catch (summaryError) {
      setWebSummaryError(
        summaryError instanceof Error
          ? summaryError.message
          : "Không thể tóm tắt trang web này."
      );
    } finally {
      setWebSummaryLoading(false);
    }
  };

  const handleRunImageGen = async () => {
    if (!authUser || !imagePrompt.trim()) {
      return;
    }

    setImageLoading(true);
    setImageError(null);
    try {
      const response = await generateImageTool({
        prompt: imagePrompt.trim(),
        modelId: imageModelId,
        imageSize
      });
      setImageResult(response);
      void refreshAuthProfile();
    } catch (imageErr) {
      setImageError(
        imageErr instanceof Error ? imageErr.message : "Không tạo được ảnh."
      );
    } finally {
      setImageLoading(false);
    }
  };

  const handleRunTranslate = async () => {
    if (!authUser || !translatorText.trim() || !translatorModelId) {
      return;
    }

    setTranslatorLoading(true);
    setTranslatorError(null);
    try {
      const response = await translateTextTool({
        text: translatorText.trim(),
        targetLang: translatorTargetLang,
        sourceLang: translatorSourceLang,
        modelId: translatorModelId
      });
      setTranslatorResult(response.translatedText);
      void refreshAuthProfile();
    } catch (translateErr) {
      setTranslatorError(
        translateErr instanceof Error ? translateErr.message : "Không dịch được."
      );
    } finally {
      setTranslatorLoading(false);
    }
  };

  if (isSharedView) {
    return (
      <div className="shared-shell">
        <SeoMeta
          title={
            sharedSession?.title
              ? `Chia sẻ cuộc trò chuyện: ${sharedSession.title}`
              : "Chia sẻ cuộc trò chuyện"
          }
          description={describeSession(sharedSession)}
          path={typeof window !== "undefined" ? window.location.pathname : "/"}
          type="article"
          robots="noindex,follow"
        />
        <BackgroundDecor />
        {themeTransitionOverlay}
        <WelcomeSplash open={showWelcomeSplash} onComplete={handleWelcomeComplete} />
        <main className="main-shell shared-shell__main">
          <motion.section
            className="arena-stage is-active shared-stage"
            layout
            transition={{ type: "spring", stiffness: 170, damping: 24 }}
          >
            <ChatBoard
              session={sharedSession}
              mode={sharedSession?.mode ?? "direct"}
              sending={false}
              error={error}
            pendingPrompt=""
            isConversationActive
            readOnly
            models={catalog.models}
            preferences={preferences}
            onReveal={async () => {}}
            onVote={async () => {}}
            onQuickPrompt={() => {}}
            />
          </motion.section>
        </main>
      </div>
    );
  }

  if (!authReady) {
    return (
      <div className="shared-shell">
        <SeoMeta
          title="Đang chuẩn bị AI TTM"
          description="Đang chuẩn bị không gian chat AI đa mô hình của AI TTM."
          robots="noindex,nofollow"
        />
        <BackgroundDecor />
        {themeTransitionOverlay}
        <WelcomeSplash open={showWelcomeSplash} onComplete={handleWelcomeComplete} />
        <main className="main-shell shared-shell__main auth-main">
          <div className="boot-loader-shell">
            <GradientLoader
              size={180}
              className="gradient-loader--hero"
              label="Đang chuẩn bị AI TTM..."
            />
          </div>
        </main>
      </div>
    );
  }

  if (isUpgradeRoute) {
    return (
      <div className="shared-shell">
        <SeoMeta
          title="Nâng cấp gói"
          description="Xem bảng giá và nâng cấp gói sử dụng AI TTM."
          path={AI_UPGRADE_BASE}
          robots="index,follow"
        />
        <BackgroundDecor />
        {themeTransitionOverlay}
        <WelcomeSplash open={showWelcomeSplash} onComplete={handleWelcomeComplete} />
        <main className="main-shell shared-shell__main">
          <UpgradePage
            authUser={authUser}
            onBack={() => navigateTo(AI_ROUTE_BASE)}
            onOpenAdmin={() => navigateTo(AI_ADMIN_BASE)}
            onPurchaseSuccess={refreshAuthProfile}
          />
        </main>
      </div>
    );
  }

  if (isAdminRoute) {
    return (
      <div className="shared-shell">
        <SeoMeta
          title="Quản trị bảng giá"
          description="Quản trị nội dung, số tiền và CTA cho trang nâng cấp AI TTM."
          path={AI_ADMIN_BASE}
          robots="noindex,nofollow"
        />
        <BackgroundDecor />
        {themeTransitionOverlay}
        <WelcomeSplash open={showWelcomeSplash} onComplete={handleWelcomeComplete} />
        <main className="main-shell shared-shell__main">
          <AdminPricingScreen
            authUser={authUser}
            onLogin={loginAdmin}
            onLogout={logout}
            onBack={() => navigateTo("/")}
          />
        </main>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="shared-shell">
        <SeoMeta
          title="Đăng nhập"
          description="Đăng nhập vào AI TTM để sử dụng không gian chat AI đa mô hình, so sánh song song và battle mode."
          robots="index,follow"
        />
        <BackgroundDecor />
        {themeTransitionOverlay}
        <WelcomeSplash open={showWelcomeSplash} onComplete={handleWelcomeComplete} />
        <main className="main-shell shared-shell__main auth-main">
          <AuthScreen
            loading={loadingCatalog}
            error={error}
            onLogin={login}
            onRegister={register}
            onClearError={clearError}
          />
        </main>
      </div>
    );
  }

  const authDisplayName = authUser?.displayName ?? "Người dùng hiện tại";

  return (
    <MotionConfig reducedMotion={reduceMotion ? "always" : "user"}>
      <div
        className={`app-shell ${shellChatActive ? "is-chat-active" : "is-chat-idle"} ${
          sidebarOpen ? "" : "sidebar-collapsed"
        }`}
        style={
          {
            "--sidebar-width": `${sidebarWidth}px`,
            "--sidebar-collapsed-width": "88px"
          } as CSSProperties
        }
      >
        <SeoMeta
          title={activeSession?.title || "Không gian làm việc AI"}
          description={describeSession(activeSession)}
          robots="noindex,nofollow"
        />
        <BackgroundDecor />
        {themeTransitionOverlay}
        <WelcomeSplash open={showWelcomeSplash} onComplete={handleWelcomeComplete} />
        {sidebarOpen && (
          <button
            type="button"
            className="sidebar-backdrop"
            aria-label="Đóng thanh bên"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <AnimatePresence>
          {mobileWarningMessage && (
            <motion.div
              className="mobile-feature-popup"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileWarningMessage(null)}
            >
              <motion.div
                className="mobile-feature-popup__card"
                initial={{ opacity: 0, scale: 0.88, y: 24 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 16 }}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="mobile-feature-popup__close"
                  onClick={() => setMobileWarningMessage(null)}
                  aria-label="Đóng thông báo"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>

                <div className="mobile-feature-popup__icon">
                  <Monitor size={32} />
                </div>

                <h3 className="mobile-feature-popup__title">
                  {mobileWarningMessage.title}
                </h3>

                <p
                  className="mobile-feature-popup__message"
                  dangerouslySetInnerHTML={{ __html: mobileWarningMessage.message }}
                />

                <div className="mobile-feature-popup__actions">
                  <button
                    type="button"
                    className="mobile-feature-popup__btn mobile-feature-popup__btn--secondary"
                    onClick={() => setMobileWarningMessage(null)}
                  >
                    Đã hiểu
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <Sidebar
          sidebarOpen={sidebarOpen}
          isMobile={isMobile}
          userName={authDisplayName}
          userAvatarUrl={authUser?.avatarUrl}
          currentPlanName={authUser?.currentPlanName}
          currentPlanIsPaid={authUser?.currentPlanIsPaid}
          usageSummary={authUser?.usageSummary}
          maxCompareModels={authUser?.currentLimits?.maxCompareModels}
          isFreePlanLocked={isFreePlanLocked}
          imageRequiresUpgrade={isImageUpgradeRequired}
          translatorRequiresUpgrade={isTranslatorUpgradeRequired}
          webSummaryRequiresUpgrade={isWebSummaryUpgradeRequired}
          hideModelsForPlan={freePlanUser}
          sessions={sessions}
          activeSessionId={activeSessionId}
          deletingSessionId={deletingSessionId}
          activeTool={activeTool}
          mode={preferences.mode}
          preferences={preferences}
          models={catalog.models}
          onToggleSidebar={() => setSidebarOpen((current) => !current)}
          onSelectTool={(tool) => {
            setActiveTool(tool);
            setWebSummaryError(null);
            setImageError(null);
            setTranslatorError(null);
          }}
          onSelectSession={selectSession}
          onModeChange={(nextMode) => {
            if (isMobile && nextMode !== "direct") {
              setMobileWarningMessage({
                title: "Chế độ này cần màn hình lớn hơn",
                message: `So sánh <strong>${nextMode === "battle" ? "nhiều nguồn" : "song song"}</strong> hoạt động tốt nhất trên máy tính. Hãy mở trang web trên laptop/desktop để trải nghiệm đầy đủ.`
              });
              return;
            }
            setActiveTool("chat");
            updateMode(nextMode);
          }}
          onModelChange={updateModelPreference}
          onBattleToggle={toggleBattlePoolModel}
          onBattleCountChange={updateBattleModelCount}
          onRequestDeleteSession={(session) => {
            setDeleteDialogError(null);
            setDeleteTarget(session);
          }}
          onRenameSession={renameSession}
          onTogglePinSession={togglePinSession}
          onShareSession={async (conversationId) => {
            await shareSession(conversationId);
          }}
          onExportSession={exportSession}
          onBatchDelete={deleteMultipleSessions}
          onNewChat={() => {
            setActiveTool("chat");
            createNewSession(isMobile ? "direct" : preferences.mode);
          }}
          onOpenUpgrade={() => navigateTo(AI_UPGRADE_BASE)}
          onOpenMainSite={goToMainSite}
          onResetSession={logout}
          onMobileFeatureNotice={(title, message) => setMobileWarningMessage({ title, message })}
        />

        {sidebarOpen ? (
          <button
            type="button"
            className="sidebar-resize-handle"
            aria-label="Điều chỉnh độ rộng thanh bên"
            onPointerDown={handleSidebarResizeStart}
          />
        ) : null}

        <main className="main-shell">
          <HeaderBar
            currentTool={activeTool}
            mode={preferences.mode}
            balanceVnd={authUser?.balance}
            currentPlanName={authUser?.currentPlanName}
            isFreePlanLocked={isFreePlanLocked}
            hideModelsForPlan={freePlanUser}
            sidebarOpen={sidebarOpen}
            theme={theme}
            isMobile={isMobile}
            models={catalog.models}
            selectedModelId={preferences.directModelId}
            onModelChange={updateModelPreference}
            onToggleSidebar={() => setSidebarOpen((current) => !current)}
            onToggleTheme={toggleTheme}
            onModeChange={(mode) => {
              setActiveTool("chat");
              updateMode(mode);
            }}
            onMobileFeatureNotice={(title, message) => setMobileWarningMessage({ title, message })}
            showAdminButton={["admin", "administrator", "superadmin", "super_admin", "owner", "root"].includes((authUser?.role ?? "").toLowerCase())}
            onOpenUpgrade={() => navigateTo(AI_UPGRADE_BASE)}
            onOpenAdmin={() => navigateTo(AI_ADMIN_BASE)}
            onBalanceTopUp={goToDeposit}
          />

          <motion.section
            className={`arena-stage ${
              isChatWorkspace
                ? isConversationActive
                  ? "is-active"
                  : preferences.mode === "battle" || preferences.mode === "side-by-side"
                    ? "is-idle is-idle--compare"
                    : "is-idle"
                : "is-tool-stage"
            }`}
            layout={false}
            transition={{ type: "spring", stiffness: 170, damping: 24 }}
          >
            {isChatWorkspace ? (
              <>
                <ChatBoard
                  session={activeSession}
                  mode={preferences.mode}
                  isMobile={isMobile}
                  sending={sending}
                  error={error}
                  pendingPrompt={input}
                  isConversationActive={isConversationActive}
                  models={catalog.models}
                  preferences={preferences}
                  onReveal={revealTurn}
                  onVote={voteTurn}
                  onQuickPrompt={setInput}
                  onEditPrompt={setInput}
                  onFrameModelChange={setBattlePoolModelAt}
                  onSideFrameModelChange={updateModelPreference}
                  onRegenerateTurn={regenerateTurn}
                  onContinueTurn={continueTurn}
                  onExportConversation={
                    activeSession ? (format) => exportSession(activeSession.id, format) : undefined
                  }
                />

                <Composer
                  mode={preferences.mode}
                  value={input}
                  sending={sending}
                  uploading={uploading}
                  stopping={stopping}
                  canStop={canStopStreaming}
                  useWebSearch={useWebSearch}
                  attachments={pendingAttachments}
                  disabled={!canSend}
                  requiresUpgrade={isFreePlanLocked}
                  uploadRequiresUpgrade={isUploadUpgradeRequired}
                  imageRequiresUpgrade={isImageUpgradeRequired}
                  translatorRequiresUpgrade={isTranslatorUpgradeRequired}
                  webSearchRequiresUpgrade={isWebSearchUpgradeRequired}
                  expanded={isConversationActive}
                  onChange={setInput}
                  onUploadFiles={uploadFiles}
                  onRemoveAttachment={removePendingAttachment}
                  onToggleWebSearch={() => {
                    if (preferences.mode !== "direct") {
                      setUseWebSearch(false);
                      return;
                    }
                    setUseWebSearch((current) => !current);
                  }}
                  onOpenImageTool={() => {
                    if (isImageUpgradeRequired) {
                      navigateTo(AI_UPGRADE_BASE);
                      return;
                    }
                    setActiveTool("image-gen");
                  }}
                  onOpenTranslatorTool={() => {
                    if (isTranslatorUpgradeRequired) {
                      navigateTo(AI_UPGRADE_BASE);
                      return;
                    }
                    setActiveTool("translator");
                  }}
                  onOpenUpgrade={() => navigateTo(AI_UPGRADE_BASE)}
                  onStop={stopStreaming}
                  onSubmit={async () => {
                    if (!input.trim() || !canSend) {
                      return;
                    }

                    try {
                      await sendPrompt(input, {
                        useWebSearch: preferences.mode === "direct" ? useWebSearch : false
                      });
                      setInput("");
                    } catch {
                      return;
                    }
                  }}
                />
              </>
            ) : activeTool === "web-summary" ? (
              <WebSummaryPanel
                url={webSummaryUrl}
                mode={preferences.mode}
                preferences={preferences}
                models={catalog.models}
                loading={webSummaryLoading}
                error={webSummaryError}
                result={webSummaryResult}
                onUrlChange={setWebSummaryUrl}
                onSubmit={() => void handleRunWebSummary()}
              />
            ) : activeTool === "image-gen" ? (
              <ImageGenPanel
                prompt={imagePrompt}
                modelId={imageModelId}
                imageSize={imageSize}
                loading={imageLoading}
                error={imageError}
                result={imageResult}
                onPromptChange={setImagePrompt}
                onModelIdChange={setImageModelId}
                onImageSizeChange={setImageSize}
                onSubmit={() => void handleRunImageGen()}
              />
            ) : (
              <TranslatorPanel
                text={translatorText}
                sourceLang={translatorSourceLang}
                targetLang={translatorTargetLang}
                modelId={translatorModelId}
                models={catalog.models}
                loading={translatorLoading}
                error={translatorError}
                translated={translatorResult}
                onTextChange={setTranslatorText}
                onSourceLangChange={setTranslatorSourceLang}
                onTargetLangChange={setTranslatorTargetLang}
                onModelIdChange={setTranslatorModelId}
                onSubmit={() => void handleRunTranslate()}
              />
            )}
          </motion.section>
        </main>

        <PopupDialog
          open={Boolean(deleteTarget)}
          title="Xóa cuộc trò chuyện?"
          description={
            deleteTarget
              ? `Mục "${deleteTarget.title}" sẽ bị xóa khỏi lịch sử đã lưu của bạn.`
              : ""
          }
          confirmLabel="Xóa cuộc trò chuyện"
          cancelLabel="Giữ lại"
          loading={Boolean(deleteTarget && deletingSessionId === deleteTarget.id)}
          error={deleteDialogError}
          onConfirm={() => void handleConfirmDelete()}
          onClose={() => {
            if (deletingSessionId) {
              return;
            }
            setDeleteDialogError(null);
            setDeleteTarget(null);
          }}
        />
        <PopupDialog
          open={showFreePlanUpgradePrompt}
          title="Vui lòng nâng cấp để tiếp tục dùng đầy đủ"
          description="Tài khoản của bạn hiện đang ở gói Free. Hãy nâng lên các gói khác để mở thêm model, quota và tính năng phù hợp hơn với nhu cầu sử dụng."
          confirmLabel="Xem trang nâng cấp"
          cancelLabel="Để sau"
          confirmVariant="primary"
          icon={<Crown size={20} />}
          onConfirm={() => {
            setShowFreePlanUpgradePrompt(false);
            navigateTo(AI_UPGRADE_BASE);
          }}
          onClose={() => setShowFreePlanUpgradePrompt(false)}
        />
      </div>
    </MotionConfig>
  );
}

export default App;
