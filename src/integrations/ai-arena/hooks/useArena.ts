import { useEffect, useMemo, useRef, useState } from "react";
import {
    batchDeleteConversations,
    createConversation,
    createConversationShare,
    deleteConversation,
    downloadConversationExport,
    getCatalog,
    getConversations,
    getHealth,
    getMe,
    getSharedConversation,
    loginAdminAi,
    loginAi,
    logoutAi,
    registerAi,
    revealBattleTurn,
    sendArenaTurnStream,
    stopArenaTurnStream,
    submitBattleVote,
    updateConversation,
    uploadAsset,
    waitForPricingUpdate
} from "../lib/api";
import {
    clearAuthToken,
    clearAuthUser,
    loadAuthUser,
    loadAuthToken,
    loadPreferences,
    saveAuthToken,
    saveAuthUser,
    savePreferences
} from "../lib/storage";
import {
  ArenaMode,
  ArenaPreferences,
  CatalogResponse,
  ChatSession,
  SessionTurn,
  StreamEvent,
  UploadedAsset,
  VoteChoice
} from "../lib/types";
import { sortSessions } from "../lib/utils";

const DEFAULT_BATTLE_MODEL_COUNT = 4;
const MIN_BATTLE_MODEL_COUNT = 2;
const MAX_BATTLE_MODEL_COUNT = 6;
const AUTH_PROFILE_SYNC_MS = 3000;
const PRICING_UPDATED_EVENT = "ttmmo-ai-pricing-updated";
const PRICING_UPDATED_STORAGE_KEY = "ttmmo-ai-pricing-updated";

const clampBattleModelCount = (
  count: number,
  availableCount: number,
  maxAllowedCount = MAX_BATTLE_MODEL_COUNT
) => {
  const safeAvailable = Math.max(availableCount, 0);
  const safeMaxAllowed = Math.max(
    MIN_BATTLE_MODEL_COUNT,
    Math.min(MAX_BATTLE_MODEL_COUNT, Number.isFinite(maxAllowedCount) ? Math.floor(maxAllowedCount) : MAX_BATTLE_MODEL_COUNT)
  );
  if (safeAvailable === 0) {
    return MIN_BATTLE_MODEL_COUNT;
  }
  if (safeAvailable < MIN_BATTLE_MODEL_COUNT) {
    return safeAvailable;
  }

  const parsed = Number.isFinite(count) ? Math.floor(count) : DEFAULT_BATTLE_MODEL_COUNT;
  return Math.max(
    MIN_BATTLE_MODEL_COUNT,
    Math.min(parsed, Math.min(safeMaxAllowed, safeAvailable))
  );
};

const normalizeBattlePool = (
  selectedIds: string[],
  models: CatalogResponse["models"],
  requestedCount: number,
  maxAllowedCount = MAX_BATTLE_MODEL_COUNT,
  options?: {
    fillMissing?: boolean;
  }
) => {
  const availableModels = models.filter((model) => model.available);
  const availableIds = availableModels.map((model) => model.id);
  const targetCount = clampBattleModelCount(requestedCount, availableIds.length, maxAllowedCount);
  const dedupedSelected = Array.from(
    new Set(selectedIds.filter((id) => availableIds.includes(id)))
  );
  const normalized = [...dedupedSelected];

  if (options?.fillMissing ?? true) {
    for (const modelId of availableIds) {
      if (normalized.length >= targetCount) {
        break;
      }
      if (!normalized.includes(modelId)) {
        normalized.push(modelId);
      }
    }
  }

  return {
    battleModelCount: targetCount,
    battlePoolIds: normalized.slice(0, Math.max(0, targetCount))
  };
};

const ensurePreferences = (
  preferences: ArenaPreferences,
  models: CatalogResponse["models"],
  maxAllowedCount = MAX_BATTLE_MODEL_COUNT
) => {
  const availableModels = models.filter((model) => model.available);
  const directFallback = availableModels[0]?.id ?? "";
  const leftFallback = availableModels[0]?.id ?? "";
  const rightFallback = availableModels[1]?.id ?? availableModels[0]?.id ?? "";
  const battleSettings = normalizeBattlePool(
    preferences.battlePoolIds,
    models,
    preferences.battleModelCount,
    maxAllowedCount
  );

  return {
    ...preferences,
    directModelId:
      availableModels.some((model) => model.id === preferences.directModelId)
        ? preferences.directModelId
        : directFallback,
    leftModelId:
      availableModels.some((model) => model.id === preferences.leftModelId)
        ? preferences.leftModelId
        : leftFallback,
    rightModelId:
      availableModels.some((model) => model.id === preferences.rightModelId)
        ? preferences.rightModelId
        : rightFallback,
    battleModelCount: battleSettings.battleModelCount,
    battlePoolIds: battleSettings.battlePoolIds
  };
};

const sessionMatchesPreferences = (
  session: ChatSession,
  preferences: ArenaPreferences
) => {
  if (session.mode !== preferences.mode) {
    return false;
  }

  if (session.mode === "direct") {
    return session.directModelId === preferences.directModelId;
  }

  if (session.mode === "side-by-side") {
    return (
      session.leftModelId === preferences.leftModelId &&
      session.rightModelId === preferences.rightModelId
    );
  }

  return session.battlePoolIds.join("||") === preferences.battlePoolIds.join("||");
};

const syncPreferencesFromSession = (
  current: ArenaPreferences,
  session: ChatSession,
  maxAllowedCount = MAX_BATTLE_MODEL_COUNT
): ArenaPreferences => {
  const rawBattlePool = Array.from(
    new Set((session.battlePoolIds.length > 0 ? session.battlePoolIds : current.battlePoolIds).filter(Boolean))
  );
  const battleModelCount = clampBattleModelCount(
    session.battlePoolIds.length || current.battleModelCount || DEFAULT_BATTLE_MODEL_COUNT,
    Math.max(rawBattlePool.length, MIN_BATTLE_MODEL_COUNT),
    maxAllowedCount
  );

  return {
    ...current,
    mode: session.mode,
    directModelId: session.directModelId ?? current.directModelId,
    leftModelId: session.leftModelId ?? current.leftModelId,
    rightModelId: session.rightModelId ?? current.rightModelId,
    battleModelCount,
    battlePoolIds: rawBattlePool.slice(0, battleModelCount)
  };
};

const readFileAsBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Không thể đọc tệp tải lên."));
        return;
      }
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(new Error("Không thể đọc tệp tải lên."));
    reader.readAsDataURL(file);
  });

const sharedSlugFromLocation = () => {
  if (typeof window === "undefined") {
    return "";
  }

  const match = new RegExp(`^${AI_SHARED_BASE.replace(/\//g, "\\/")}\\/([^/]+)$`).exec(window.location.pathname);
  return match?.[1] ?? "";
};

export const useArena = () => {
  const [catalog, setCatalog] = useState<CatalogResponse>({
    providers: [],
    models: []
  });
  const [preferences, setPreferences] = useState<ArenaPreferences>(loadPreferences);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [backendOnline, setBackendOnline] = useState(false);
  const [sending, setSending] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState(loadAuthUser);
  const [authReady, setAuthReady] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<UploadedAsset[]>([]);
  const [sharedSession, setSharedSession] = useState<ChatSession | null>(null);
  const [sharedSlug] = useState(sharedSlugFromLocation);
  const [streamingTurnId, setStreamingTurnId] = useState("");
  const pricingRevisionRef = useRef(0);
  const currentMaxCompareModels = authUser?.currentLimits?.maxCompareModels ?? MAX_BATTLE_MODEL_COUNT;
  const allowedModelIdsFingerprint = JSON.stringify(
    authUser?.currentLimits?.allowedModelIds ?? null
  );

  const activeSession =
    sessions.find((session) => session.id === activeSessionId) ?? null;

  const availableModels = useMemo(
    () => catalog.models.filter((model) => model.available),
    [catalog.models]
  );

  const replaceSession = (updatedSession: ChatSession) => {
    setSessions((current) => {
      const exists = current.some((item) => item.id === updatedSession.id);
      return sortSessions(
        exists
          ? current.map((item) =>
              item.id === updatedSession.id ? updatedSession : item
            )
          : [updatedSession, ...current]
      );
    });
  };

  const updateTurnInSession = (
    conversationId: string,
    turnId: string,
    updater: (turn: SessionTurn) => SessionTurn
  ) => {
    setSessions((current) =>
      current.map((session) =>
        session.id !== conversationId
          ? session
          : {
              ...session,
              turns: session.turns.map((turn) =>
                turn.id === turnId ? updater(turn) : turn
              ),
              updatedAt: new Date().toISOString()
            }
      )
    );
  };

  const replaceTurnInActiveSession = (updatedTurn: SessionTurn) => {
    if (!activeSession) {
      return;
    }

    setSessions((current) =>
      current.map((session) =>
        session.id === activeSession.id
          ? {
              ...session,
              turns: session.turns.map((turn) =>
                turn.id === updatedTurn.id ? updatedTurn : turn
              ),
              updatedAt: updatedTurn.timestamp
            }
          : session
      )
    );
  };

  const loadAuthedData = async () => {
    const [meResult, sessionsResult, catalogResult] = await Promise.allSettled([
      getMe(),
      getConversations(),
      getCatalog()
    ]);

    if (meResult.status === "fulfilled") {
      setAuthUser(meResult.value);
      saveAuthUser(meResult.value);
    } else {
      clearAuthUser();
      setAuthUser(null);
      setSessions([]);
      setActiveSessionId("");
      throw (
        meResult.reason instanceof Error
          ? meResult.reason
          : new Error("Không đọc được phiên đăng nhập AI hiện tại.")
      );
    }

    if (sessionsResult.status === "fulfilled") {
      const orderedSessions = sortSessions(sessionsResult.value);
      setSessions(orderedSessions);
      setActiveSessionId((current) => current || orderedSessions[0]?.id || "");
    } else {
      setError(
        sessionsResult.reason instanceof Error
          ? sessionsResult.reason.message
          : "Không tải được lịch sử trò chuyện từ backend."
      );
    }

    if (catalogResult.status === "fulfilled") {
      setCatalog(catalogResult.value);
      setPreferences((current) =>
        ensurePreferences(current, catalogResult.value.models, currentMaxCompareModels)
      );
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      setLoadingCatalog(true);

      const healthPromise = getHealth();
      const catalogPromise = getCatalog();

      if (sharedSlug) {
        const [catalogResult, healthResult, sharedResult] = await Promise.allSettled([
          catalogPromise,
          healthPromise,
          getSharedConversation(sharedSlug)
        ]);

        setBackendOnline(healthResult.status === "fulfilled");

        if (catalogResult.status === "fulfilled") {
          setCatalog(catalogResult.value);
          setPreferences((current) =>
            ensurePreferences(current, catalogResult.value.models, currentMaxCompareModels)
          );
        }

        if (sharedResult.status === "fulfilled") {
          setSharedSession(sharedResult.value);
        } else {
          setError(
            sharedResult.reason instanceof Error
              ? sharedResult.reason.message
              : "Không tải được cuộc trò chuyện chia sẻ."
          );
        }

        setAuthReady(true);
        setLoadingCatalog(false);
        return;
      }

      const [catalogResult, healthResult] = await Promise.allSettled([
        catalogPromise,
        healthPromise
      ]);

      setBackendOnline(healthResult.status === "fulfilled");

      if (catalogResult.status === "fulfilled") {
        setCatalog(catalogResult.value);
        setPreferences((current) =>
          ensurePreferences(current, catalogResult.value.models, currentMaxCompareModels)
        );
      } else {
        setError(
          catalogResult.reason instanceof Error
            ? catalogResult.reason.message
            : "Không tải được danh sách model từ backend."
        );
      }

      if (loadAuthToken()) {
        try {
          await loadAuthedData();
        } catch (authError) {
          clearAuthToken();
          clearAuthUser();
          setAuthUser(null);
          setError(
            authError instanceof Error
              ? authError.message
              : "Không đọc được phiên đăng nhập AI hiện tại."
          );
        }
      } else {
        clearAuthUser();
        setAuthUser(null);
        setSessions([]);
        setActiveSessionId("");
      }

      setAuthReady(true);
      setLoadingCatalog(false);
    };

    void bootstrap();
  }, [sharedSlug]);

  useEffect(() => {
    if (!catalog.models.length) {
      return;
    }
    setPreferences((current) => ensurePreferences(current, catalog.models, currentMaxCompareModels));
  }, [catalog.models, currentMaxCompareModels]);

  useEffect(() => {
    savePreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    const handleAuthExpired = () => {
      clearAuthToken();
      clearAuthUser();
      setAuthUser(null);
      setSessions([]);
      setActiveSessionId("");
      setPendingAttachments([]);
      setStreamingTurnId("");
      setSending(false);
      setStopping(false);
    };

    window.addEventListener("ttmmo-ai-auth-expired", handleAuthExpired);
    return () => window.removeEventListener("ttmmo-ai-auth-expired", handleAuthExpired);
  }, []);

  useEffect(() => {
    if (!authReady || !authUser || typeof window === "undefined") {
      return;
    }

    const syncProfile = () => {
      if (document.hidden) {
        return;
      }
      void refreshAuthProfile();
    };

    const intervalId = window.setInterval(syncProfile, AUTH_PROFILE_SYNC_MS);
    const handleFocus = () => syncProfile();
    const handleVisibilityChange = () => syncProfile();
    const handlePricingUpdated = () => syncProfile();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === PRICING_UPDATED_STORAGE_KEY && event.newValue) {
        syncProfile();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener(PRICING_UPDATED_EVENT, handlePricingUpdated);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener(PRICING_UPDATED_EVENT, handlePricingUpdated);
      window.removeEventListener("storage", handleStorage);
    };
  }, [authReady, authUser]);

  const reloadUserContext = async () => {
    setError(null);
    await loadAuthedData();
  };

  const refreshAuthProfile = async () => {
    if (!loadAuthToken()) {
      return;
    }
    try {
      const me = await getMe();
      setAuthUser(me);
      saveAuthUser(me);
    } catch {
      /* ignore */
    }
  };

  const refreshCatalogForCurrentPlan = async () => {
    if (!loadAuthToken()) {
      return;
    }
    try {
      const nextCatalog = await getCatalog();
      setCatalog(nextCatalog);
      setPreferences((current) =>
        ensurePreferences(current, nextCatalog.models, currentMaxCompareModels)
      );
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (!authUser || !loadAuthToken()) {
      return;
    }

    void refreshCatalogForCurrentPlan();
  }, [authUser?.id, allowedModelIdsFingerprint, currentMaxCompareModels]);

  useEffect(() => {
    if (!authReady || !authUser || typeof window === "undefined" || !loadAuthToken()) {
      return;
    }

    let cancelled = false;

    const listenPricingUpdates = async () => {
      while (!cancelled && loadAuthToken()) {
        try {
          const response = await waitForPricingUpdate(pricingRevisionRef.current, 25);
          pricingRevisionRef.current = response.revision;
          if (response.changed) {
            await refreshAuthProfile();
          }
        } catch {
          if (cancelled) {
            break;
          }
          await new Promise((resolve) => window.setTimeout(resolve, 2000));
        }
      }
    };

    void listenPricingUpdates();

    return () => {
      cancelled = true;
    };
  }, [authReady, authUser?.id]);

  const clearError = () => {
    setError(null);
  };

  const login = async ({
    identifier,
    password
  }: {
    identifier: string;
    password: string;
  }) => {
    setError(null);
    try {
      const response = await loginAi({ identifier, password });
      saveAuthToken(response.token);
      saveAuthUser(response.user);
      setAuthUser(response.user);
      await loadAuthedData();
      setAuthReady(true);
    } catch (loginError) {
      const message =
        loginError instanceof Error &&
        /không chính xác|incorrect|unauthorized|401/i.test(loginError.message)
          ? "Sai thông tin đăng nhập hoặc tài khoản chưa tồn tại."
          : loginError instanceof Error
            ? loginError.message
            : "Không thể đăng nhập vào AI TTM.";
      setError(message);
    }
  };

  const register = async ({
    username,
    email,
    password
  }: {
    username: string;
    email: string;
    password: string;
  }) => {
    setError(null);
    try {
      const response = await registerAi({ username, email, password });
      saveAuthToken(response.token);
      saveAuthUser(response.user);
      setAuthUser(response.user);
      await loadAuthedData();
      setAuthReady(true);
    } catch (registerError) {
      const message =
        registerError instanceof Error
          ? registerError.message
          : "Không thể tạo tài khoản AI TTM mới.";
      setError(message);
    }
  };

  const loginAdmin = async ({
    identifier,
    password
  }: {
    identifier: string;
    password: string;
  }) => {
    setError(null);
    try {
      const response = await loginAdminAi({ identifier, password });
      saveAuthToken(response.token);
      saveAuthUser(response.user);
      setAuthUser(response.user);
      await loadAuthedData();
      setAuthReady(true);
    } catch (loginError) {
      const message =
        loginError instanceof Error &&
        /không chính xác|incorrect|unauthorized|401/i.test(loginError.message)
          ? "Sai thông tin đăng nhập admin hoặc tài khoản chưa có quyền quản trị."
          : loginError instanceof Error
            ? loginError.message
            : "Không thể đăng nhập admin vào AI TTM.";
      setError(message);
    }
  };

  const logout = async () => {
    try {
      await logoutAi();
    } catch {
      // Dọn local state ngay cả khi session ở server đã hết hạn.
    }

    clearAuthToken();
    clearAuthUser();
    setAuthUser(null);
    setSessions([]);
    setActiveSessionId("");
    setPendingAttachments([]);
    setStreamingTurnId("");
    setSending(false);
    setStopping(false);
    setError(null);
    setAuthReady(true);
  };

  const createNewSession = (mode = preferences.mode) => {
    setActiveSessionId("");
    setPendingAttachments([]);
    setPreferences((current) => ({
      ...current,
      mode
    }));
    setError(null);
  };

  const updateMode = (mode: ArenaMode) => {
    setPreferences((current) => ({
      ...current,
      mode
    }));

    if (activeSession && activeSession.mode !== mode) {
      setActiveSessionId("");
    }
    setError(null);
  };

  const updateModelPreference = (
    key: "directModelId" | "leftModelId" | "rightModelId",
    value: string
  ) => {
    setPreferences((current) => ({
      ...current,
      [key]: value
    }));

    if (activeSession && activeSession.turns.length > 0) {
      setActiveSessionId("");
    }
  };

  const updateBattleModelCount = (count: number) => {
    setPreferences((current) => ({
      ...current,
      mode: "battle",
      ...normalizeBattlePool(current.battlePoolIds, catalog.models, count, currentMaxCompareModels)
    }));

    if (activeSession && activeSession.turns.length > 0) {
      setActiveSessionId("");
    }
  };

  const toggleBattlePoolModel = (modelId: string) => {
    setPreferences((current) => {
      const exists = current.battlePoolIds.includes(modelId);
      const currentCount = clampBattleModelCount(
        current.battleModelCount,
        availableModels.length,
        currentMaxCompareModels
      );
      const nextSelected = exists
        ? current.battlePoolIds.filter((id) => id !== modelId)
        : [...current.battlePoolIds.filter((id) => id !== modelId), modelId].slice(-currentCount);

      return {
        ...current,
        mode: "battle",
        ...normalizeBattlePool(
          nextSelected,
          catalog.models,
          currentCount,
          currentMaxCompareModels,
          { fillMissing: false }
        )
      };
    });

    if (activeSession && activeSession.turns.length > 0) {
      setActiveSessionId("");
    }
  };

  const setBattlePoolModelAt = (index: number, modelId: string) => {
    setPreferences((current) => {
      const currentCount = clampBattleModelCount(
        current.battleModelCount,
        availableModels.length,
        currentMaxCompareModels
      );
      const nextSelected = [...current.battlePoolIds];
      const existingIndex = nextSelected.indexOf(modelId);

      if (existingIndex >= 0) {
        nextSelected.splice(existingIndex, 1);
      }

      while (nextSelected.length < currentCount) {
        const fallback = availableModels.find((model) => !nextSelected.includes(model.id));
        if (!fallback) {
          break;
        }
        nextSelected.push(fallback.id);
      }

      nextSelected[index] = modelId;

      return {
        ...current,
        mode: "battle",
        ...normalizeBattlePool(nextSelected, catalog.models, currentCount, currentMaxCompareModels, {
          fillMissing: true
        })
      };
    });

    if (activeSession && activeSession.turns.length > 0) {
      setActiveSessionId("");
    }
  };

  const selectSession = (sessionId: string) => {
    const session = sessions.find((item) => item.id === sessionId);
    setActiveSessionId(sessionId);
    setPendingAttachments([]);
    if (session) {
      setPreferences((current) => syncPreferencesFromSession(current, session, currentMaxCompareModels));
    }
    setError(null);
  };

  const ensureConversation = async () => {
    if (activeSession && sessionMatchesPreferences(activeSession, preferences)) {
      return activeSession;
    }

    const created = await createConversation({
      mode: preferences.mode,
      directModelId: preferences.directModelId,
      leftModelId: preferences.leftModelId,
      rightModelId: preferences.rightModelId,
      battlePoolIds: preferences.battlePoolIds
    });
    replaceSession(created);
    setActiveSessionId(created.id);
    return created;
  };

  const applyStreamEvent = (conversationId: string, event: StreamEvent) => {
    if (event.type === "turn_init" && event.turn) {
      setStreamingTurnId(event.turnId || event.turn.id);
      setSessions((current) =>
        current.map((session) =>
          session.id !== conversationId
            ? session
            : {
                ...session,
                turns: [...session.turns, event.turn!],
                updatedAt: event.turn!.timestamp
              }
        )
      );
      return;
    }

    if (!event.slot) {
      if (event.type === "complete" && event.conversation) {
        replaceSession(event.conversation);
        setActiveSessionId(event.conversation.id);
        setStreamingTurnId("");
        setStopping(false);
      }
      if (event.type === "error") {
        setStreamingTurnId("");
        setStopping(false);
      }
      return;
    }

    setSessions((current) =>
      current.map((session) => {
        if (session.id !== conversationId) {
          return session;
        }

        const turns = [...session.turns];
        const lastTurn = turns[turns.length - 1];
        if (!lastTurn) {
          return session;
        }

        const updatedTurn: SessionTurn = {
          ...lastTurn,
          isStreaming: true,
          results: lastTurn.results.map((result) => {
            if (result.slot !== event.slot) {
              return result;
            }

            if (event.type === "slot_status") {
              return {
                ...result,
                statusText: event.statusText,
                isStreaming: true
              };
            }

            if (event.type === "slot_chunk") {
              return {
                ...result,
                content: `${result.content}${event.content ?? ""}`,
                statusText: "Đang trả lời...",
                isStreaming: true
              };
            }

            if (event.type === "slot_complete") {
              return {
                ...result,
                responseMs: event.responseMs ?? result.responseMs,
                error: event.error ?? result.error,
                finishReason: event.finishReason ?? result.finishReason,
                isStreaming: false,
                statusText: event.statusText
              };
            }

            return result;
          })
        };
        updatedTurn.isStreaming = updatedTurn.results.some((result) => result.isStreaming);

        turns[turns.length - 1] = updatedTurn;
        return {
          ...session,
          turns,
          updatedAt: new Date().toISOString()
        };
      })
    );

    if (event.type === "complete" && event.conversation) {
      replaceSession(event.conversation);
      setActiveSessionId(event.conversation.id);
      setStreamingTurnId("");
      setStopping(false);
    }
  };

  const dispatchStreamPrompt = async ({
    prompt,
    attachmentIds = [],
    regeneratedFromTurnId,
    useWebSearch = false
  }: {
    prompt: string;
    attachmentIds?: string[];
    regeneratedFromTurnId?: string;
    useWebSearch?: boolean;
  }) => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      return;
    }

    setSending(true);
    setError(null);

    try {
      const conversation = await ensureConversation();

      await sendArenaTurnStream(
        {
          conversationId: conversation.id,
          prompt: trimmed,
          attachmentIds,
          regeneratedFromTurnId,
          useWebSearch
        },
        (event) => {
          if (event.type === "error") {
            setError(event.error || "Không thể stream câu trả lời từ backend.");
            return;
          }
          applyStreamEvent(conversation.id, event);
        }
      );
      await refreshAuthProfile();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Không thể gửi tin nhắn tới backend."
      );
      throw requestError;
    } finally {
      setSending(false);
      setStopping(false);
    }
  };

  const sendPrompt = async (
    prompt: string,
    options?: {
      useWebSearch?: boolean;
    }
  ) => {
    const attachmentIds = pendingAttachments.map((asset) => asset.id);
    await dispatchStreamPrompt({
      prompt,
      attachmentIds,
      useWebSearch: options?.useWebSearch
    });
    setPendingAttachments([]);
  };

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) {
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const uploaded = await Promise.all(
        list.map(async (file) =>
          uploadAsset({
            fileName: file.name,
            contentType: file.type || "application/octet-stream",
            dataBase64: await readFileAsBase64(file)
          })
        )
      );
      setPendingAttachments((current) => [...current, ...uploaded]);
      await refreshAuthProfile();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Không thể tải tệp lên."
      );
      throw uploadError;
    } finally {
      setUploading(false);
    }
  };

  const removePendingAttachment = (assetId: string) => {
    setPendingAttachments((current) =>
      current.filter((asset) => asset.id !== assetId)
    );
  };

  const revealTurn = async (turnId: string) => {
    try {
      const updatedTurn = await revealBattleTurn({ turnId });
      replaceTurnInActiveSession(updatedTurn);
      setError(null);
    } catch (revealError) {
      setError(
        revealError instanceof Error
          ? revealError.message
          : "Không thể mở danh tính model."
      );
      throw revealError;
    }
  };

  const voteTurn = async (turnId: string, choice: VoteChoice) => {
    try {
      const response = await submitBattleVote(turnId, choice);
      replaceTurnInActiveSession({
        ...response.turn,
        tally: response.tally
      });
      setError(null);
    } catch (voteError) {
      setError(
        voteError instanceof Error
          ? voteError.message
          : "Không thể gửi vote battle."
      );
      throw voteError;
    }
  };

  const deleteSession = async (conversationId: string) => {
    setDeletingSessionId(conversationId);
    try {
      await deleteConversation(conversationId);
      setSessions((current) =>
        current.filter((session) => session.id !== conversationId)
      );
      setActiveSessionId((current) =>
        current === conversationId ? "" : current
      );
      setError(null);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Không thể xóa cuộc trò chuyện."
      );
      throw deleteError;
    } finally {
      setDeletingSessionId(null);
    }
  };

  const deleteMultipleSessions = async (conversationIds: string[]) => {
    if (!conversationIds.length) {
      return;
    }

    const deleted = await batchDeleteConversations(conversationIds);
    setSessions((current) =>
      current.filter((session) => !deleted.deletedIds.includes(session.id))
    );
    if (deleted.deletedIds.includes(activeSessionId)) {
      setActiveSessionId("");
    }
  };

  const renameSession = async (conversationId: string, title: string) => {
    const updated = await updateConversation(conversationId, { title });
    replaceSession(updated);
    if (activeSessionId === conversationId) {
      setPreferences((current) => syncPreferencesFromSession(current, updated, currentMaxCompareModels));
    }
  };

  const togglePinSession = async (conversationId: string) => {
    const target = sessions.find((session) => session.id === conversationId);
    if (!target) {
      return;
    }
    const updated = await updateConversation(conversationId, {
      isPinned: !target.isPinned
    });
    replaceSession(updated);
  };

  const shareSession = async (conversationId: string) => {
    const response = await createConversationShare(conversationId);
    await navigator.clipboard.writeText(response.shareUrl);
    const updated = await updateConversation(conversationId, {});
    replaceSession(updated);
    return response.shareUrl;
  };

  const exportSession = async (
    conversationId: string,
    format: "markdown" | "pdf"
  ) => {
    await downloadConversationExport(conversationId, format);
  };

  const regenerateTurn = async (turnId: string) => {
    if (!activeSession) {
      return;
    }
    const sourceTurn = activeSession.turns.find((turn) => turn.id === turnId);
    if (!sourceTurn) {
      return;
    }
    await dispatchStreamPrompt({
      prompt: sourceTurn.prompt,
      attachmentIds: sourceTurn.attachments.map((asset) => asset.id),
      regeneratedFromTurnId: turnId
    });
  };

  const continueTurn = async (turnId: string) => {
    if (!activeSession) {
      return;
    }
    const sourceTurn = activeSession.turns.find((turn) => turn.id === turnId);
    if (!sourceTurn) {
      return;
    }
    const attachmentIds = sourceTurn.attachments.map((asset) => asset.id);
    await dispatchStreamPrompt({
      prompt:
        "Tiếp tục trả lời phần còn dang dở ở lượt ngay trước đó. Không lặp lại ý đã nói; chỉ nối tiếp phần còn thiếu một cách liền mạch.",
      attachmentIds
    });
  };

  const stopStreaming = async () => {
    if (!streamingTurnId) {
      return;
    }
    setStopping(true);
    try {
      await stopArenaTurnStream({ turnId: streamingTurnId });
      setError(null);
    } catch (stopError) {
      setStopping(false);
      setError(
        stopError instanceof Error
          ? stopError.message
          : "Không thể dừng luồng trả lời hiện tại."
      );
      throw stopError;
    }
  };

  return {
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
    streamingTurnId,
    uploading,
    deletingSessionId,
    error,
    clearError,
    authUser,
    authReady,
    sharedSession,
    isSharedView: Boolean(sharedSlug),
    pendingAttachments,
    selectSession,
    createNewSession,
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
    login,
    register,
    loginAdmin,
    logout,
    reloadUserContext,
    refreshAuthProfile
  };
};
import { AI_SHARED_BASE } from "../lib/runtime";
