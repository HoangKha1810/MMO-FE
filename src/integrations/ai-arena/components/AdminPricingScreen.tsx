import { motion } from "framer-motion";
import {
  ArrowLeft,
  FileUp,
  Globe2,
  ImagePlus,
  Languages,
  LogOut,
  MessageSquareText,
  PackageSearch,
  Plus,
  ReceiptText,
  RotateCcw,
  Save,
  ScanSearch,
  Search,
  ShieldAlert,
  Trash2
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createAdminPricingPlan,
  deleteAdminPricingPlan,
  getAdminPricingOrders,
  getAdminPricingPlans,
  getCatalog,
  updateAdminPricingOrder,
  updateAdminPricingPlanAllowedModels,
  updateAdminPricingPlan
} from "../lib/api";
import type {
  ModelInfo,
  PricingCatalog,
  PricingLimits,
  PricingOrder,
  PricingOrderAdminUpdatePayload,
  PricingPlan,
  PricingPlanInput,
  PricingToolQuota,
  UsagePeriod,
  User
} from "../lib/types";
import { AuthScreen } from "./AuthScreen";
import { GradientLoader } from "./GradientLoader";

const createDefaultToolQuotas = (): PricingLimits["toolQuotas"] => ({
  chat: { enabled: true, limit: 1200, period: "month" },
  upload: { enabled: true, limit: 180, period: "month" },
  imageGeneration: { enabled: true, limit: 120, period: "month" },
  translator: { enabled: true, limit: 1200, period: "month" },
  webSearch: { enabled: true, limit: 120, period: "month" },
  webSummary: { enabled: true, limit: 60, period: "month" }
});

const usagePeriodLabel: Record<UsagePeriod, string> = {
  day: "Ngày",
  week: "Tuần",
  month: "Tháng"
};

const planToolFields: Array<{
  key: keyof PricingLimits["toolQuotas"];
  label: string;
  description: string;
  icon: typeof MessageSquareText;
}> = [
  {
    key: "chat",
    label: "Chat AI",
    description: "Giới hạn số lượt chat tiêu chuẩn của user.",
    icon: MessageSquareText
  },
  {
    key: "upload",
    label: "Tải tệp",
    description: "Cho phép upload tài liệu và hình ảnh vào cuộc trò chuyện.",
    icon: FileUp
  },
  {
    key: "imageGeneration",
    label: "Tạo ảnh",
    description: "Giới hạn số lần tạo ảnh bằng AI.",
    icon: ImagePlus
  },
  {
    key: "translator",
    label: "Biên dịch",
    description: "Giới hạn số lượt dùng công cụ dịch nhanh.",
    icon: Languages
  },
  {
    key: "webSearch",
    label: "Search Web",
    description: "Giới hạn số lượt lấy dữ liệu Tavily thời gian thực.",
    icon: Globe2
  },
  {
    key: "webSummary",
    label: "Tóm tắt web",
    description: "Giới hạn số lần tóm tắt URL bằng AI.",
    icon: ScanSearch
  }
];

const emptyDraft = (audience = "personal"): PricingPlanInput => ({
  audience,
  slug: "",
  name: "",
  summary: "",
  priceValue: 0,
  priceCurrency: "VND",
  billingPeriod: "month",
  priceNote: "",
  ctaLabel: "Nâng cấp",
  ctaUrl: "https://trungtammmo.vn",
  badgeText: "",
  footerNote: "",
  features: [],
  limits: {
    toolQuotas: createDefaultToolQuotas(),
    maxUploadMb: 8,
    maxCompareModels: 2,
    allowedModelIds: null
  },
  isActive: true,
  isCurrentPlan: false,
  isHighlighted: false,
  sortOrder: 0
});

const emptyOrderDraft = (): PricingOrderAdminUpdatePayload & { expiresAtInput: string } => ({
  status: "pending",
  paymentRef: "",
  adminNote: "",
  expiresAt: null,
  expiresAtInput: ""
});

const normalizeToolQuota = (
  quota: PricingToolQuota | undefined,
  fallback: PricingToolQuota
): PricingToolQuota => ({
  enabled: quota?.enabled ?? fallback.enabled,
  limit: quota?.limit ?? fallback.limit ?? null,
  period: quota?.period ?? fallback.period
});

const normalizeDraftLimits = (limits?: PricingLimits): PricingLimits => {
  const defaults = createDefaultToolQuotas();
  const incoming = limits?.toolQuotas;
  return {
    toolQuotas: {
      chat: normalizeToolQuota(incoming?.chat, defaults.chat),
      upload: normalizeToolQuota(incoming?.upload, defaults.upload),
      imageGeneration: normalizeToolQuota(incoming?.imageGeneration, defaults.imageGeneration),
      translator: normalizeToolQuota(incoming?.translator, defaults.translator),
      webSearch: normalizeToolQuota(incoming?.webSearch, defaults.webSearch),
      webSummary: normalizeToolQuota(incoming?.webSummary, defaults.webSummary)
    },
    maxUploadMb: limits?.maxUploadMb ?? 8,
    maxCompareModels: limits?.maxCompareModels ?? 2,
    allowedModelIds:
      Array.isArray(limits?.allowedModelIds)
        ? Array.from(
            new Set(
              limits?.allowedModelIds
                .map((item) => String(item).trim())
                .filter(Boolean)
            )
          )
        : null
  };
};

const isAdminRole = (role?: string | null) =>
  ["admin", "administrator", "superadmin", "super_admin", "owner", "root"].includes(
    (role ?? "").toLowerCase()
  );

const toDraft = (plan: PricingPlan): PricingPlanInput => ({
  audience: plan.audience,
  slug: plan.slug,
  name: plan.name,
  summary: plan.summary,
  priceValue: plan.priceValue,
  priceCurrency: plan.priceCurrency,
  billingPeriod: plan.billingPeriod,
  priceNote: plan.priceNote ?? "",
  ctaLabel: plan.ctaLabel,
  ctaUrl: plan.ctaUrl ?? "",
  badgeText: plan.badgeText ?? "",
  footerNote: plan.footerNote ?? "",
  features: plan.features,
  limits: normalizeDraftLimits(plan.limits),
  isActive: plan.isActive,
  isCurrentPlan: plan.isCurrentPlan,
  isHighlighted: plan.isHighlighted,
  sortOrder: plan.sortOrder
});

const pad = (value: number) => String(value).padStart(2, "0");

const toDateTimeInputValue = (value?: string | null) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return "Chưa có";
  }
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value));
};

const orderStatusLabel: Record<string, string> = {
  pending: "Chờ xử lý",
  paid: "Đã thanh toán",
  cancelled: "Đã hủy",
  refunded: "Đã hoàn tiền",
  expired: "Hết hạn"
};

const LIVE_ORDERS_REFRESH_MS = 5000;
const PRICING_UPDATED_EVENT = "ttmmo-ai-pricing-updated";
const PRICING_UPDATED_STORAGE_KEY = "ttmmo-ai-pricing-updated";

const toOrderDraft = (
  order: PricingOrder
): PricingOrderAdminUpdatePayload & { expiresAtInput: string } => ({
  status: order.status,
  paymentRef: order.paymentRef ?? "",
  adminNote: order.adminNote ?? "",
  expiresAt: order.expiresAt ?? null,
  expiresAtInput: toDateTimeInputValue(order.expiresAt)
});

interface AdminPricingScreenProps {
  authUser?: User | null;
  onLogin: (payload: { identifier: string; password: string }) => Promise<void>;
  onLogout: () => Promise<void>;
  onBack: () => void;
}

const sortModelCatalog = (models: ModelInfo[]) =>
  models
    .slice()
    .sort(
      (left, right) =>
        left.providerLabel.localeCompare(right.providerLabel, "vi", { sensitivity: "base" }) ||
        left.label.localeCompare(right.label, "vi", { sensitivity: "base" })
    );

export function AdminPricingScreen({
  authUser,
  onLogin,
  onLogout,
  onBack
}: AdminPricingScreenProps) {
  const [catalog, setCatalog] = useState<PricingCatalog | null>(null);
  const [modelCatalog, setModelCatalog] = useState<ModelInfo[]>([]);
  const [orders, setOrders] = useState<PricingOrder[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [saving, setSaving] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"plans" | "orders">("plans");
  const [selectedPlanId, setSelectedPlanId] = useState<number | "new">("new");
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [draft, setDraft] = useState<PricingPlanInput>(emptyDraft());
  const [featureText, setFeatureText] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [orderDraft, setOrderDraft] = useState<PricingOrderAdminUpdatePayload & { expiresAtInput: string }>(
    emptyOrderDraft()
  );
  const selectedPlanIdRef = useRef<number | "new">("new");
  const selectedOrderIdRef = useRef<number | null>(null);
  const orderDraftDirtyRef = useRef(false);
  const knownOrderIdsRef = useRef<number[]>([]);
  const liveNoticeTimerRef = useRef<number | null>(null);
  const modelAccessSaveTimerRef = useRef<number | null>(null);
  const modelAccessSaveSeqRef = useRef(0);

  const canManage = isAdminRole(authUser?.role);

  const plans = useMemo(
    () => (catalog?.plans ?? []).slice().sort((left, right) => left.sortOrder - right.sortOrder),
    [catalog?.plans]
  );

  const modelGroups = useMemo(() => {
    const grouped = new Map<string, { providerLabel: string; models: ModelInfo[] }>();
    for (const model of sortModelCatalog(modelCatalog)) {
      const bucket = grouped.get(model.providerId);
      if (bucket) {
        bucket.models.push(model);
        continue;
      }
      grouped.set(model.providerId, {
        providerLabel: model.providerLabel,
        models: [model]
      });
    }
    return Array.from(grouped.entries()).map(([providerId, value]) => ({
      providerId,
      providerLabel: value.providerLabel,
      models: value.models
    }));
  }, [modelCatalog]);

  const allModelIds = useMemo(
    () => modelCatalog.map((model) => model.id),
    [modelCatalog]
  );

  const effectiveAllowedModelIds = useMemo(
    () => draft.limits.allowedModelIds ?? allModelIds,
    [draft.limits.allowedModelIds, allModelIds]
  );

  const effectiveAllowedModelIdSet = useMemo(
    () => new Set(effectiveAllowedModelIds),
    [effectiveAllowedModelIds]
  );

  const selectedPlan =
    selectedPlanId === "new"
      ? null
      : plans.find((plan) => plan.id === selectedPlanId) ?? null;

  const selectedOrder =
    selectedOrderId == null
      ? null
      : orders.find((order) => order.id === selectedOrderId) ?? null;

  const orderDraftDirty = useMemo(() => {
    if (!selectedOrder) {
      return false;
    }
    return (
      orderDraft.status !== selectedOrder.status ||
      (orderDraft.paymentRef ?? "") !== (selectedOrder.paymentRef ?? "") ||
      (orderDraft.adminNote ?? "") !== (selectedOrder.adminNote ?? "") ||
      orderDraft.expiresAtInput !== toDateTimeInputValue(selectedOrder.expiresAt)
    );
  }, [orderDraft, selectedOrder]);

  const activeLoading = activeTab === "plans" ? loadingPlans : loadingOrders;

  const announcePricingUpdated = () => {
    if (typeof window === "undefined") {
      return;
    }
    const stamp = String(Date.now());
    window.dispatchEvent(new Event(PRICING_UPDATED_EVENT));
    try {
      window.localStorage.setItem(PRICING_UPDATED_STORAGE_KEY, stamp);
    } catch {
      // Ignore storage failures; same-tab event above is enough for local refresh.
    }
  };

  const showNewOrdersNotice = (message: string) => {
    if (typeof window !== "undefined" && liveNoticeTimerRef.current) {
      window.clearTimeout(liveNoticeTimerRef.current);
    }
    setNotice(message);
    if (typeof window !== "undefined") {
      liveNoticeTimerRef.current = window.setTimeout(() => {
        setNotice(null);
        liveNoticeTimerRef.current = null;
      }, 6000);
    }
  };

  const reloadPlans = async (nextSelectedId?: number | "new") => {
    setLoadingPlans(true);
    setError(null);
    try {
      const [pricingResult, modelResult] = await Promise.allSettled([
        getAdminPricingPlans(),
        getCatalog()
      ]);
      if (pricingResult.status !== "fulfilled") {
        throw pricingResult.reason;
      }
      const response = pricingResult.value;
      setCatalog(response);
      if (modelResult.status === "fulfilled") {
        setModelCatalog(sortModelCatalog(modelResult.value.models));
      }
      const targetId =
        nextSelectedId ?? (selectedPlanId === "new" ? response.plans[0]?.id ?? "new" : selectedPlanId);
      const targetPlan =
        targetId === "new" ? null : response.plans.find((plan) => plan.id === targetId) ?? null;
      if (targetPlan) {
        setSelectedPlanId(targetPlan.id);
        setDraft(toDraft(targetPlan));
        setFeatureText(targetPlan.features.join("\n"));
      } else {
        setSelectedPlanId("new");
        setDraft(emptyDraft(response.audiences[0] ?? "personal"));
        setFeatureText("");
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Không tải được danh sách gói nâng cấp."
      );
    } finally {
      setLoadingPlans(false);
    }
  };

  const reloadOrders = async (
    nextSelectedId?: number | null,
    options?: {
      silent?: boolean;
      preserveDraft?: boolean;
    }
  ) => {
    const silent = options?.silent ?? false;
    const preserveDraft = options?.preserveDraft ?? false;
    if (!silent) {
      setLoadingOrders(true);
      setError(null);
    }
    try {
      const response = await getAdminPricingOrders(orderSearch, orderStatus);
      const previousKnownIds = knownOrderIdsRef.current;
      const hadKnownOrders = previousKnownIds.length > 0;
      knownOrderIdsRef.current = response.map((order) => order.id);
      setOrders(response);
      if (silent && hadKnownOrders) {
        const newOrders = response.filter((order) => !previousKnownIds.includes(order.id));
        if (newOrders.length) {
          showNewOrdersNotice(
            newOrders.length === 1
              ? `Có đơn mới #${newOrders[0].id} từ ${newOrders[0].userDisplayName}.`
              : `Có ${newOrders.length} đơn mới vừa vào hệ thống.`
          );
        }
      }
      const currentSelectedId = selectedOrderIdRef.current;
      const nextId = nextSelectedId ?? currentSelectedId ?? response[0]?.id ?? null;
      const target = nextId == null ? null : response.find((order) => order.id === nextId) ?? null;
      if (target) {
        setSelectedOrderId(target.id);
        const shouldSyncDraft =
          !preserveDraft ||
          !orderDraftDirtyRef.current ||
          currentSelectedId == null ||
          currentSelectedId !== target.id ||
          nextSelectedId != null;
        if (shouldSyncDraft) {
          setOrderDraft(toOrderDraft(target));
        }
      } else {
        setSelectedOrderId(null);
        if (!preserveDraft || !orderDraftDirtyRef.current) {
          setOrderDraft(emptyOrderDraft());
        }
      }
    } catch (loadError) {
      if (!silent) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Không tải được danh sách đơn hàng."
        );
      }
    } finally {
      if (!silent) {
        setLoadingOrders(false);
      }
    }
  };

  useEffect(() => {
    if (!canManage) {
      return;
    }
    void reloadPlans();
  }, [canManage]);

  useEffect(() => {
    if (!canManage || activeTab !== "orders") {
      return;
    }
    void reloadOrders();
  }, [canManage, activeTab, orderSearch, orderStatus]);

  useEffect(() => {
    selectedPlanIdRef.current = selectedPlanId;
  }, [selectedPlanId]);

  useEffect(() => {
    selectedOrderIdRef.current = selectedOrderId;
  }, [selectedOrderId]);

  useEffect(() => {
    orderDraftDirtyRef.current = orderDraftDirty;
  }, [orderDraftDirty]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && liveNoticeTimerRef.current) {
        window.clearTimeout(liveNoticeTimerRef.current);
      }
      if (typeof window !== "undefined" && modelAccessSaveTimerRef.current) {
        window.clearTimeout(modelAccessSaveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!canManage || activeTab !== "orders" || typeof window === "undefined") {
      return;
    }

    const silentRefresh = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      void reloadOrders(undefined, { silent: true, preserveDraft: true });
    };

    const intervalId = window.setInterval(silentRefresh, LIVE_ORDERS_REFRESH_MS);
    const handleFocus = () => silentRefresh();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        silentRefresh();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [canManage, activeTab, orderSearch, orderStatus]);

  const updateToolQuota = (
    key: keyof PricingLimits["toolQuotas"],
    patch: Partial<PricingToolQuota>
  ) => {
    setDraft((current) => ({
      ...current,
      limits: {
        ...current.limits,
        toolQuotas: {
          ...current.limits.toolQuotas,
          [key]: {
            ...current.limits.toolQuotas[key],
            ...patch
          }
        }
      }
    }));
  };

  const persistAllowedModelIds = (planId: number, nextValue: string[] | null) => {
    if (typeof window === "undefined") {
      return;
    }

    if (modelAccessSaveTimerRef.current) {
      window.clearTimeout(modelAccessSaveTimerRef.current);
    }

    const normalizedAllowedModelIds =
      nextValue === null
        ? null
        : Array.from(
            new Set(
              nextValue
                .map((item) => String(item).trim())
                .filter(Boolean)
            )
          );

    const saveSeq = ++modelAccessSaveSeqRef.current;

    modelAccessSaveTimerRef.current = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await updateAdminPricingPlanAllowedModels(planId, {
            allowedModelIds: normalizedAllowedModelIds
          });
          if (saveSeq !== modelAccessSaveSeqRef.current) {
            return;
          }

          setCatalog((current) =>
            current
              ? {
                  ...current,
                  plans: current.plans.map((plan) =>
                    plan.id === response.id ? response : plan
                  )
                }
              : current
          );

          if (selectedPlanIdRef.current === response.id) {
            setDraft((current) => ({
              ...current,
              limits: {
                ...current.limits,
                allowedModelIds: normalizeDraftLimits(response.limits).allowedModelIds
              }
            }));
          }

          setError(null);
          announcePricingUpdated();
        } catch (saveError) {
          setError(
            saveError instanceof Error
              ? saveError.message
              : "Không thể lưu quyền model của gói."
          );
        }
      })();
    }, 250);
  };

  const updateAllowedModelIds = (nextValue: string[] | null) => {
    setDraft((current) => ({
      ...current,
      limits: {
        ...current.limits,
        allowedModelIds: nextValue
      }
    }));

    if (selectedPlan) {
      persistAllowedModelIds(selectedPlan.id, nextValue);
    }
  };

  const toggleAllowedModel = (modelId: string, enabled: boolean) => {
    const currentIds = draft.limits.allowedModelIds ?? allModelIds;
    const nextIds = enabled
      ? Array.from(new Set([...currentIds, modelId]))
      : currentIds.filter((item) => item !== modelId);
    updateAllowedModelIds(nextIds);
  };

  const toggleProviderModels = (modelIds: string[], enabled: boolean) => {
    const currentIds = draft.limits.allowedModelIds ?? allModelIds;
    const nextIds = enabled
      ? Array.from(new Set([...currentIds, ...modelIds]))
      : currentIds.filter((item) => !modelIds.includes(item));
    updateAllowedModelIds(nextIds);
  };

  const handleAdminLogin = async (payload: { identifier: string; password: string }) => {
    setAuthError(null);
    try {
      await onLogin(payload);
    } catch (loginError) {
      setAuthError(
        loginError instanceof Error
          ? loginError.message
          : "Không thể đăng nhập quản trị."
      );
    }
  };

  const handleSavePlan = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload: PricingPlanInput = {
        ...draft,
        features: featureText
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean)
      };

      let savedId: number | "new" = "new";
      if (selectedPlan) {
        const response = await updateAdminPricingPlan(selectedPlan.id, payload);
        savedId = response.id;
      } else {
        const response = await createAdminPricingPlan(payload);
        savedId = response.id;
      }
      await reloadPlans(savedId);
      announcePricingUpdated();
      setNotice("Đã lưu thay đổi cho bảng giá.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Không thể lưu gói nâng cấp."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!selectedPlan) {
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await deleteAdminPricingPlan(selectedPlan.id);
      await reloadPlans("new");
      announcePricingUpdated();
      setNotice("Đã xóa gói khỏi bảng giá.");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Không thể xóa gói nâng cấp."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOrder = async () => {
    if (!selectedOrder) {
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload: PricingOrderAdminUpdatePayload = {
        status: orderDraft.status,
        paymentRef: orderDraft.paymentRef ?? "",
        adminNote: orderDraft.adminNote ?? "",
        expiresAt: orderDraft.expiresAtInput
          ? new Date(orderDraft.expiresAtInput).toISOString()
          : null
      };
      const response = await updateAdminPricingOrder(selectedOrder.id, payload);
      await reloadOrders(response.id);
      announcePricingUpdated();
      setNotice(`Đã cập nhật đơn #${response.id}.`);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Không thể cập nhật đơn hàng."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleRefundOrder = async () => {
    if (!selectedOrder) {
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await updateAdminPricingOrder(selectedOrder.id, {
        status: "refunded",
        paymentRef: orderDraft.paymentRef ?? "",
        adminNote: orderDraft.adminNote ?? "",
        expiresAt: new Date().toISOString()
      });
      await reloadOrders(response.id);
      announcePricingUpdated();
      setNotice(`Đã hoàn tiền và hạ cấp user khỏi đơn #${response.id}.`);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Không thể hoàn tiền cho đơn hàng."
      );
    } finally {
      setSaving(false);
    }
  };

  if (!authUser) {
    return (
      <div className="marketing-shell">
        <motion.section
          className="admin-auth-shell"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="admin-auth-shell__topbar">
            <button type="button" className="ghost-button" onClick={onBack}>
              <ArrowLeft size={16} />
              Quay lại AI TTM
            </button>
          </div>
          <AuthScreen
            loading={loadingPlans}
            error={authError}
            title="Đăng nhập trang quản trị AI TTM"
            description="Dùng tài khoản quản trị đang có trong database TrungTamMMO để chỉnh gói, duyệt đơn và theo dõi nâng cấp."
            submitLabel="Vào trang quản trị"
            allowRegistration={false}
            onLogin={handleAdminLogin}
          />
        </motion.section>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="marketing-shell">
        <motion.section
          className="admin-denied-card"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <ShieldAlert size={28} />
          <h1>Tài khoản này chưa có quyền quản trị</h1>
          <p>Hãy đăng nhập bằng tài khoản admin để chỉnh bảng giá và quản lý đơn hàng.</p>
          <div className="admin-denied-card__actions">
            <button type="button" className="ghost-button" onClick={onBack}>
              <ArrowLeft size={16} />
              Quay lại
            </button>
            <button type="button" className="primary-button" onClick={() => void onLogout()}>
              <LogOut size={16} />
              Đăng xuất để đổi tài khoản
            </button>
          </div>
        </motion.section>
      </div>
    );
  }

  return (
    <div className="marketing-shell">
      <motion.section
        className="admin-pricing-shell"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <header className="admin-pricing-shell__header">
          <div>
            <p className="section-label">Trang quản trị</p>
            <h1>Quản lý gói và đơn nâng cấp</h1>
            <p>Theo dõi bảng giá, đơn user đã mua trên trang AI và duyệt trạng thái ngay tại đây.</p>
          </div>
          <div className="admin-pricing-shell__actions">
            <button type="button" className="ghost-button" onClick={onBack}>
              <ArrowLeft size={16} />
              Quay lại app
            </button>
            <button type="button" className="ghost-button" onClick={() => void onLogout()}>
              <LogOut size={16} />
              Đăng xuất
            </button>
          </div>
        </header>

        <div className="admin-view-switch">
          <button
            type="button"
            className={activeTab === "plans" ? "active" : ""}
            onClick={() => {
              setActiveTab("plans");
              setNotice(null);
              setError(null);
            }}
          >
            <ReceiptText size={16} />
            Bảng giá
          </button>
          <button
            type="button"
            className={activeTab === "orders" ? "active" : ""}
            onClick={() => {
              setActiveTab("orders");
              setNotice(null);
              setError(null);
            }}
          >
            <PackageSearch size={16} />
            Đơn hàng
          </button>
        </div>

        {activeLoading ? (
          <div className="upgrade-loader">
            <GradientLoader
              size={160}
              label={activeTab === "plans" ? "Đang tải dữ liệu gói..." : "Đang tải đơn hàng..."}
            />
          </div>
        ) : activeTab === "plans" ? (
          <div className="admin-pricing-grid">
            <aside className="admin-pricing-list">
              <button
                type="button"
                className={`admin-plan-list__create ${selectedPlanId === "new" ? "active" : ""}`}
                onClick={() => {
                  setSelectedPlanId("new");
                  setDraft(emptyDraft(draft.audience || "personal"));
                  setFeatureText("");
                  setNotice(null);
                  setError(null);
                }}
              >
                <Plus size={16} />
                Tạo gói mới
              </button>

              {plans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  className={`admin-plan-list__item ${selectedPlanId === plan.id ? "active" : ""}`}
                  onClick={() => {
                    setSelectedPlanId(plan.id);
                    setDraft(toDraft(plan));
                    setFeatureText(plan.features.join("\n"));
                    setNotice(null);
                    setError(null);
                  }}
                >
                  <div>
                    <strong>{plan.name}</strong>
                    <span>{plan.audience} • {plan.priceCurrency} {plan.priceValue.toLocaleString("vi-VN")}</span>
                  </div>
                  {plan.badgeText ? <small>{plan.badgeText}</small> : null}
                </button>
              ))}
            </aside>

            <div className="admin-pricing-editor">
              {error ? <div className="banner-error">{error}</div> : null}
              {notice ? <div className="banner-success">{notice}</div> : null}

              <div className="admin-form-grid">
                <label className="admin-field">
                  <span>Audience</span>
                  <select
                    value={draft.audience}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, audience: event.target.value }))
                    }
                  >
                    <option value="personal">personal</option>
                    <option value="business">business</option>
                  </select>
                </label>

                <label className="admin-field">
                  <span>Slug</span>
                  <input
                    value={draft.slug}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, slug: event.target.value }))
                    }
                    placeholder="plus"
                  />
                </label>

                <label className="admin-field admin-field--wide">
                  <span>Tên gói</span>
                  <input
                    value={draft.name}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="Plus"
                  />
                </label>

                <label className="admin-field admin-field--wide">
                  <span>Mô tả ngắn</span>
                  <textarea
                    rows={3}
                    value={draft.summary}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, summary: event.target.value }))
                    }
                    placeholder="Mở khóa trải nghiệm đầy đủ hơn..."
                  />
                </label>

                <label className="admin-field">
                  <span>Giá tiền</span>
                  <input
                    type="number"
                    value={draft.priceValue}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        priceValue: Number(event.target.value || 0)
                      }))
                    }
                  />
                </label>

                <label className="admin-field">
                  <span>Tiền tệ</span>
                  <input
                    value={draft.priceCurrency}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, priceCurrency: event.target.value }))
                    }
                  />
                </label>

                <label className="admin-field">
                  <span>Chu kỳ</span>
                  <input
                    value={draft.billingPeriod}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, billingPeriod: event.target.value }))
                    }
                    placeholder="month"
                  />
                </label>

                <label className="admin-field">
                  <span>Ghi chú giá</span>
                  <input
                    value={draft.priceNote ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, priceNote: event.target.value }))
                    }
                    placeholder="đã gồm VAT"
                  />
                </label>

                <label className="admin-field admin-field--wide">
                  <span>Nhãn nút</span>
                  <input
                    value={draft.ctaLabel}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, ctaLabel: event.target.value }))
                    }
                  />
                </label>

                <label className="admin-field admin-field--wide">
                  <span>Link nút</span>
                  <input
                    value={draft.ctaUrl ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, ctaUrl: event.target.value }))
                    }
                    placeholder="https://trungtammmo.vn"
                  />
                </label>

                <label className="admin-field">
                  <span>Badge</span>
                  <input
                    value={draft.badgeText ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, badgeText: event.target.value }))
                    }
                    placeholder="Phổ biến"
                  />
                </label>

                <label className="admin-field">
                  <span>Thứ tự</span>
                  <input
                    type="number"
                    value={draft.sortOrder}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        sortOrder: Number(event.target.value || 0)
                      }))
                    }
                  />
                </label>

                <label className="admin-field admin-field--wide">
                  <span>Ghi chú cuối thẻ</span>
                  <textarea
                    rows={2}
                    value={draft.footerNote ?? ""}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, footerNote: event.target.value }))
                    }
                  />
                </label>

                <div className="admin-field admin-field--wide">
                  <span className="admin-field__section-title">Giới hạn / quota của gói</span>
                  <div className="admin-tool-quota-grid">
                    {planToolFields.map((tool) => {
                      const Icon = tool.icon;
                      const quota = draft.limits.toolQuotas[tool.key];
                      return (
                        <div key={tool.key} className={`admin-tool-quota-card ${quota.enabled ? "" : "is-disabled"}`}>
                          <div className="admin-tool-quota-card__head">
                            <div className="admin-tool-quota-card__title">
                              <span className="admin-tool-quota-card__icon">
                                <Icon size={16} />
                              </span>
                              <div>
                                <strong>{tool.label}</strong>
                                <p>{tool.description}</p>
                              </div>
                            </div>
                            <label className="admin-tool-quota-card__toggle">
                              <input
                                type="checkbox"
                                checked={quota.enabled}
                                onChange={(event) =>
                                  updateToolQuota(tool.key, { enabled: event.target.checked })
                                }
                              />
                              <span>{quota.enabled ? "Đang bật" : "Đang tắt"}</span>
                            </label>
                          </div>

                          <div className="admin-limit-grid">
                            <label className="admin-field">
                              <span>Số lượt tối đa</span>
                              <input
                                type="number"
                                min={0}
                                disabled={!quota.enabled}
                                value={quota.limit ?? ""}
                                placeholder="Để trống = không giới hạn"
                                onChange={(event) =>
                                  updateToolQuota(tool.key, {
                                    limit: event.target.value === "" ? null : Number(event.target.value || 0)
                                  })
                                }
                              />
                            </label>

                            <label className="admin-field">
                              <span>Chu kỳ reset</span>
                              <select
                                value={quota.period}
                                disabled={!quota.enabled}
                                onChange={(event) =>
                                  updateToolQuota(tool.key, {
                                    period: event.target.value as UsagePeriod
                                  })
                                }
                              >
                                {Object.entries(usagePeriodLabel).map(([value, label]) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="admin-limit-grid admin-limit-grid--secondary">
                    <label className="admin-field">
                      <span>Dung lượng tệp tối đa (MB)</span>
                      <input
                        type="number"
                        value={draft.limits.maxUploadMb ?? 0}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            limits: {
                              ...current.limits,
                              maxUploadMb: Number(event.target.value || 0)
                            }
                          }))
                        }
                      />
                    </label>
                    <label className="admin-field">
                      <span>Model so sánh tối đa</span>
                      <input
                        type="number"
                        min={2}
                        max={6}
                        value={draft.limits.maxCompareModels ?? 2}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            limits: {
                              ...current.limits,
                              maxCompareModels: Number(event.target.value || 2)
                            }
                          }))
                        }
                      />
                    </label>
                  </div>

                  <div className="admin-model-access-card">
                    <div className="admin-model-access-card__head">
                      <div className="admin-model-access-card__title">
                        <span className="admin-field__section-title">Model được phép dùng theo gói</span>
                        <p>
                          Khóa gói vào một danh sách model cụ thể. User ngoài admin sẽ chỉ nhìn
                          thấy và sử dụng được các model được chọn ở đây.
                        </p>
                      </div>
                      <label className="admin-tool-quota-card__toggle">
                        <input
                          type="checkbox"
                          checked={draft.limits.allowedModelIds === null}
                          onChange={(event) =>
                            updateAllowedModelIds(
                              event.target.checked ? null : modelCatalog.map((model) => model.id)
                            )
                          }
                        />
                        <span>Mở toàn bộ model</span>
                      </label>
                    </div>

                    <p className="admin-model-access-card__hint">
                      {draft.limits.allowedModelIds === null
                        ? "Gói này hiện được phép dùng toàn bộ model. Chỉ cần bỏ tick những model muốn khóa."
                        : "Gói này đang bị giới hạn theo danh sách tick bên dưới. Admin chỉ cần bật hoặc tắt tick để chỉnh quyền."}
                    </p>
                    {draft.limits.allowedModelIds !== null && effectiveAllowedModelIds.length === 0 ? (
                      <p className="admin-model-access-card__warning">
                        Chưa chọn model nào. Nếu lưu ở trạng thái này, user của gói này sẽ
                        không dùng được model nào cho tới khi admin mở quyền lại.
                      </p>
                    ) : null}

                    {modelGroups.length ? (
                      <div className="admin-model-provider-grid">
                        {modelGroups.map((group) => {
                          const providerModelIds = group.models.map((model) => model.id);
                          const selectedCount = providerModelIds.filter((modelId) =>
                            effectiveAllowedModelIdSet.has(modelId)
                          ).length;
                          const allChecked =
                            providerModelIds.length > 0 &&
                            selectedCount === providerModelIds.length;
                          return (
                            <section key={group.providerId} className="admin-model-provider">
                              <div className="admin-model-provider__head">
                                <div>
                                  <strong>{group.providerLabel}</strong>
                                  <small>
                                    {selectedCount}/{providerModelIds.length} model được mở
                                  </small>
                                </div>
                                <div className="admin-model-provider__actions">
                                  <button
                                    type="button"
                                    className="ghost-button ghost-button--small"
                                    onClick={() =>
                                      toggleProviderModels(providerModelIds, !allChecked)
                                    }
                                  >
                                    {allChecked ? "Bỏ nhóm" : "Chọn hết"}
                                  </button>
                                </div>
                              </div>

                              <div className="admin-model-provider__list">
                                {group.models.map((model) => {
                                  const checked = effectiveAllowedModelIdSet.has(model.id);
                                  return (
                                    <label
                                      key={model.id}
                                      className={`admin-model-checkbox ${checked ? "is-active" : ""} ${model.available ? "" : "is-unavailable"}`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(event) =>
                                          toggleAllowedModel(model.id, event.target.checked)
                                        }
                                      />
                                      <div className="admin-model-checkbox__body">
                                        <strong>{model.label}</strong>
                                        <span>
                                          {model.modelName}
                                          {!model.available ? " • Chưa hoạt động" : ""}
                                        </span>
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            </section>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="admin-empty-state">
                        <PackageSearch size={18} />
                        <span>Chưa tải được danh sách model để phân quyền cho gói.</span>
                      </div>
                    )}
                  </div>
                </div>

                <label className="admin-field admin-field--wide">
                  <span>Tính năng (mỗi dòng 1 ý)</span>
                  <textarea
                    rows={8}
                    value={featureText}
                    onChange={(event) => setFeatureText(event.target.value)}
                    placeholder={"Giải quyết bài toán phức tạp hơn\nLưu và nối dài hội thoại qua nhiều phiên"}
                  />
                </label>

                <div className="admin-switches">
                  <label><input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft((current) => ({ ...current, isActive: event.target.checked }))} /> Hiển thị</label>
                  <label><input type="checkbox" checked={draft.isCurrentPlan} onChange={(event) => setDraft((current) => ({ ...current, isCurrentPlan: event.target.checked }))} /> Gói mặc định</label>
                  <label><input type="checkbox" checked={draft.isHighlighted} onChange={(event) => setDraft((current) => ({ ...current, isHighlighted: event.target.checked }))} /> Nổi bật</label>
                </div>
              </div>

              <div className="admin-pricing-editor__actions">
                {selectedPlan ? (
                  <button
                    type="button"
                    className="danger-button"
                    disabled={saving}
                    onClick={() => void handleDeletePlan()}
                  >
                    <Trash2 size={16} />
                    Xóa gói
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  className="primary-button"
                  disabled={saving || !draft.name.trim()}
                  onClick={() => void handleSavePlan()}
                >
                  <Save size={16} />
                  {saving ? "Đang lưu..." : "Lưu thay đổi"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="admin-pricing-grid">
            <aside className="admin-pricing-list">
              <label className="admin-order-filter">
                <Search size={15} />
                <input
                  value={orderSearch}
                  onChange={(event) => setOrderSearch(event.target.value)}
                  placeholder="Tìm theo user, email, gói..."
                />
              </label>

              <label className="admin-order-filter">
                <span>Trạng thái</span>
                <select value={orderStatus} onChange={(event) => setOrderStatus(event.target.value)}>
                  <option value="">Tất cả</option>
                  <option value="pending">Chờ xử lý</option>
                  <option value="paid">Đã thanh toán</option>
                  <option value="cancelled">Đã hủy</option>
                  <option value="refunded">Đã hoàn tiền</option>
                  <option value="expired">Hết hạn</option>
                </select>
              </label>

              {orders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  className={`admin-plan-list__item admin-order-list__item ${selectedOrderId === order.id ? "active" : ""}`}
                  onClick={() => {
                    setSelectedOrderId(order.id);
                    setOrderDraft(toOrderDraft(order));
                    setNotice(null);
                    setError(null);
                  }}
                >
                  <div>
                    <strong>#{order.id} • {order.planName}</strong>
                    <span>{order.userDisplayName}</span>
                  </div>
                  <small>{orderStatusLabel[order.status] ?? order.status}</small>
                </button>
              ))}

              {!orders.length ? (
                <div className="admin-empty-state">
                  <PackageSearch size={18} />
                  <span>Chưa có đơn nào khớp bộ lọc.</span>
                </div>
              ) : null}
            </aside>

            <div className="admin-pricing-editor">
              {error ? <div className="banner-error">{error}</div> : null}
              {notice ? <div className="banner-success">{notice}</div> : null}

              {selectedOrder ? (
                <>
                  <div className="admin-order-summary">
                    <div className="admin-order-summary__card">
                      <span>Người mua</span>
                      <strong>{selectedOrder.userDisplayName}</strong>
                      <small>{selectedOrder.userEmail}</small>
                    </div>
                    <div className="admin-order-summary__card">
                      <span>Gói</span>
                      <strong>{selectedOrder.planName}</strong>
                      <small>{selectedOrder.priceCurrency} {selectedOrder.priceValue.toLocaleString("vi-VN")} / {selectedOrder.billingPeriod}</small>
                    </div>
                    <div className="admin-order-summary__card">
                      <span>Tạo lúc</span>
                      <strong>{formatDateTime(selectedOrder.createdAt)}</strong>
                      <small>Nguồn: {selectedOrder.source}</small>
                    </div>
                  </div>

                  <div className="admin-form-grid">
                    <label className="admin-field">
                      <span>Trạng thái</span>
                      <select
                        value={orderDraft.status}
                        onChange={(event) =>
                          setOrderDraft((current) => ({ ...current, status: event.target.value }))
                        }
                      >
                        {Object.entries(orderStatusLabel).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="admin-field">
                      <span>Mã thanh toán</span>
                      <input
                        value={orderDraft.paymentRef ?? ""}
                        onChange={(event) =>
                          setOrderDraft((current) => ({ ...current, paymentRef: event.target.value }))
                        }
                        placeholder="BANK-123456"
                      />
                    </label>

                    <label className="admin-field">
                      <span>Kích hoạt lúc</span>
                      <input value={formatDateTime(selectedOrder.activatedAt)} disabled />
                    </label>

                    <label className="admin-field">
                      <span>Hết hạn lúc</span>
                      <input
                        type="datetime-local"
                        value={orderDraft.expiresAtInput}
                        onChange={(event) =>
                          setOrderDraft((current) => ({
                            ...current,
                            expiresAtInput: event.target.value
                          }))
                        }
                      />
                    </label>

                    <label className="admin-field admin-field--wide">
                      <span>Link thanh toán / CTA</span>
                      <input value={selectedOrder.paymentUrl ?? ""} disabled />
                    </label>

                    <label className="admin-field admin-field--wide">
                      <span>Ghi chú admin</span>
                      <textarea
                        rows={5}
                        value={orderDraft.adminNote ?? ""}
                        onChange={(event) =>
                          setOrderDraft((current) => ({ ...current, adminNote: event.target.value }))
                        }
                        placeholder="Ghi chú xác nhận chuyển khoản, lý do hủy, thời hạn dùng..."
                      />
                    </label>
                  </div>

                  <div className="admin-pricing-editor__actions">
                    <div className="admin-order-meta">
                      <span>Cập nhật gần nhất: {formatDateTime(selectedOrder.updatedAt)}</span>
                    </div>
                    <div className="admin-order-actions">
                      {selectedOrder.status === "paid" ? (
                        <button
                          type="button"
                          className="danger-button"
                          disabled={saving}
                          onClick={() => void handleRefundOrder()}
                        >
                          <RotateCcw size={16} />
                          {saving ? "Đang hoàn tiền..." : "Hoàn tiền & hạ cấp"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="primary-button"
                        disabled={saving}
                        onClick={() => void handleSaveOrder()}
                      >
                        <Save size={16} />
                        {saving ? "Đang lưu..." : "Lưu trạng thái đơn"}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="admin-empty-state admin-empty-state--editor">
                  <PackageSearch size={20} />
                  <span>Chọn một đơn ở bên trái để xem và cập nhật trạng thái.</span>
                </div>
              )}
            </div>
          </div>
        )}
      </motion.section>
    </div>
  );
}
