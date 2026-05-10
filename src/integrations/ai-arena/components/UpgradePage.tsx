import { motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Crown,
  Gem,
  Leaf,
  ReceiptText,
  Rocket,
  ShieldCheck,
  type LucideIcon,
  ShieldUser,
  Sparkles,
  Wallet2
} from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createPricingOrder, getPricingPlans } from "../lib/api";
import { DEPOSIT_URL, MAIN_SITE_ORIGIN } from "../lib/siteUrls";
import type { PricingCatalog, PricingLimits, PricingPlan, PricingToolQuota, UsagePeriod, User } from "../lib/types";
import { BalanceDisplay } from "./BalanceDisplay";
import { GradientLoader } from "./GradientLoader";
import { ModelAvatarMark } from "./ModelAvatarMark";
import { PopupDialog } from "./PopupDialog";

const formatVndPrice = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0
  }).format(value);

const VAT_RATE = 0.08;
const PLAN_PROVIDER_SHOWCASE: Record<
  string,
  Array<{
    providerId: string;
    providerLabel: string;
    accent: string;
  }>
> = {
  free: [
    { providerId: "gemini", providerLabel: "Gemini", accent: "#67c587" },
    { providerId: "deepseek", providerLabel: "DeepSeek", accent: "#7da2ff" },
    { providerId: "qwen", providerLabel: "Qwen", accent: "#8dc2ff" }
  ],
  go: [
    { providerId: "openai", providerLabel: "OpenAI", accent: "#44c39a" },
    { providerId: "gemini", providerLabel: "Gemini", accent: "#67c587" },
    { providerId: "cohere", providerLabel: "Cohere", accent: "#d3a86d" },
    { providerId: "deepseek", providerLabel: "DeepSeek", accent: "#7da2ff" },
    { providerId: "mistral", providerLabel: "Mistral", accent: "#f8a24f" }
  ],
  standard: [
    { providerId: "openai", providerLabel: "OpenAI", accent: "#44c39a" },
    { providerId: "gemini", providerLabel: "Gemini", accent: "#67c587" },
    { providerId: "cohere", providerLabel: "Cohere", accent: "#d3a86d" },
    { providerId: "deepseek", providerLabel: "DeepSeek", accent: "#7da2ff" },
    { providerId: "qwen", providerLabel: "Qwen", accent: "#8dc2ff" },
    { providerId: "mistral", providerLabel: "Mistral", accent: "#f8a24f" }
  ],
  plus: [
    { providerId: "openai", providerLabel: "OpenAI", accent: "#44c39a" },
    { providerId: "cohere", providerLabel: "Cohere", accent: "#d3a86d" },
    { providerId: "gemini", providerLabel: "Gemini", accent: "#67c587" },
    { providerId: "deepseek", providerLabel: "DeepSeek", accent: "#7da2ff" },
    { providerId: "qwen", providerLabel: "Qwen", accent: "#8dc2ff" },
    { providerId: "xai", providerLabel: "Grok", accent: "#9c83ff" }
  ],
  pro: [
    { providerId: "openai", providerLabel: "OpenAI", accent: "#44c39a" },
    { providerId: "cohere", providerLabel: "Cohere", accent: "#d3a86d" },
    { providerId: "gemini", providerLabel: "Gemini", accent: "#67c587" },
    { providerId: "deepseek", providerLabel: "DeepSeek", accent: "#7da2ff" },
    { providerId: "qwen", providerLabel: "Qwen", accent: "#8dc2ff" },
    { providerId: "mistral", providerLabel: "Mistral", accent: "#f8a24f" },
    { providerId: "kimi", providerLabel: "Kimi", accent: "#c8ceda" },
    { providerId: "xai", providerLabel: "Grok", accent: "#9c83ff" }
  ]
};

const audienceLabelMap: Record<string, string> = {
  personal: "Personal",
  business: "Business"
};

const PLAN_ICON_MAP: Record<
  string,
  {
    icon: LucideIcon;
    tone: string;
  }
> = {
  free: { icon: Leaf, tone: "is-free" },
  go: { icon: Rocket, tone: "is-go" },
  standard: { icon: ShieldCheck, tone: "is-standard" },
  plus: { icon: Gem, tone: "is-plus" },
  pro: { icon: Crown, tone: "is-pro" }
};

const usagePeriodText: Record<UsagePeriod, string> = {
  day: "ngày",
  week: "tuần",
  month: "tháng"
};

const toolLimitMeta: Array<{
  key: keyof PricingLimits["toolQuotas"];
  label: string;
}> = [
  { key: "chat", label: "lượt chat" },
  { key: "webSearch", label: "lượt search web" },
  { key: "imageGeneration", label: "ảnh" },
  { key: "upload", label: "tệp" },
  { key: "translator", label: "lượt dịch" },
  { key: "webSummary", label: "lượt tóm tắt web" }
];

const formatLimitValue = (value?: number | null) => {
  if (value === null || value === undefined) {
    return "Không giới hạn";
  }
  return value.toLocaleString("vi-VN");
};

const formatToolQuotaPill = (label: string, quota?: PricingToolQuota | null) => {
  if (!quota?.enabled) {
    return null;
  }
  const periodText = usagePeriodText[quota.period] ?? usagePeriodText.month;
  if (quota.limit == null) {
    return `${label} không giới hạn/${periodText}`;
  }
  return `${formatLimitValue(quota.limit)} ${label}/${periodText}`;
};

const buildLimitPills = (limits: PricingLimits) => {
  const pills = toolLimitMeta
    .map((tool) => formatToolQuotaPill(tool.label, limits.toolQuotas[tool.key]))
    .filter((value): value is string => Boolean(value));

  if (limits.maxUploadMb == null) {
    pills.push("Tệp tải lên không giới hạn dung lượng");
  } else {
    pills.push(`Tệp tối đa ${formatLimitValue(limits.maxUploadMb)} MB`);
  }

  if (limits.maxCompareModels == null) {
    pills.push("So sánh không giới hạn model");
  } else {
    pills.push(`So sánh tối đa ${formatLimitValue(limits.maxCompareModels)} model`);
  }

  return pills;
};

const buildCheckoutSummary = (subtotal: number) => {
  const normalizedSubtotal = Math.max(0, Math.round(subtotal || 0));
  const taxValue = Math.round(normalizedSubtotal * VAT_RATE);
  const totalValue = normalizedSubtotal + taxValue;
  return {
    subtotal: normalizedSubtotal,
    taxValue,
    totalValue
  };
};

const isAdminRole = (role?: string | null) =>
  ["admin", "administrator", "superadmin", "super_admin", "owner", "root"].includes(
    (role ?? "").toLowerCase()
  );

interface UpgradePageProps {
  authUser?: User | null;
  onBack: () => void;
  onOpenAdmin: () => void;
  onPurchaseSuccess?: () => Promise<void> | void;
}

export function UpgradePage({
  authUser,
  onBack,
  onOpenAdmin,
  onPurchaseSuccess
}: UpgradePageProps) {
  const [catalog, setCatalog] = useState<PricingCatalog | null>(null);
  const [audience, setAudience] = useState("personal");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [orderingPlanId, setOrderingPlanId] = useState<number | null>(null);
  const [purchaseDialogPlan, setPurchaseDialogPlan] = useState<PricingPlan | null>(null);
  const [purchaseDialogError, setPurchaseDialogError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      setNotice(null);
      try {
        const response = await getPricingPlans();
        if (cancelled) {
          return;
        }
        setCatalog(response);
        if (response.audiences.length && !response.audiences.includes(audience)) {
          setAudience(response.audiences[0]);
        }
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Không tải được bảng giá nâng cấp."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [audience]);

  const audiences = catalog?.audiences?.length ? catalog.audiences : ["personal", "business"];
  const plans = useMemo(
    () =>
      (catalog?.plans ?? [])
        .filter((plan) => plan.audience === audience && plan.isActive)
        .slice()
        .sort(
          (left, right) =>
            left.priceValue - right.priceValue ||
            left.sortOrder - right.sortOrder ||
            left.name.localeCompare(right.name, "vi", { sensitivity: "base" })
        ),
    [audience, catalog?.plans]
  );
  const upgradeGridStyle = useMemo(
    () =>
      ({
        "--plan-count": Math.max(plans.length, 1)
      }) as CSSProperties,
    [plans.length]
  );
  const currentBalance = typeof authUser?.balance === "number" ? authUser.balance : 0;
  const checkoutPreview = purchaseDialogPlan
    ? buildCheckoutSummary(purchaseDialogPlan.priceValue)
    : null;
  const purchaseShortfall = checkoutPreview
    ? Math.max(0, checkoutPreview.totalValue - currentBalance)
    : 0;
  const purchaseHasEnoughBalance = Boolean(
    checkoutPreview && currentBalance >= checkoutPreview.totalValue
  );
  const openTopUp = () => {
    if (typeof window === "undefined") {
      return;
    }
    window.open(DEPOSIT_URL, "_blank", "noopener,noreferrer");
  };

  const goToMainSiteHome = () => {
    if (typeof window === "undefined") {
      return;
    }
    window.location.assign(MAIN_SITE_ORIGIN);
  };

  const handlePurchaseConfirm = async () => {
    if (!purchaseDialogPlan) {
      return;
    }
    if (!authUser) {
      setPurchaseDialogError("Vui lòng đăng nhập để mua gói nâng cấp.");
      return;
    }

    const summary = buildCheckoutSummary(purchaseDialogPlan.priceValue);
    if (currentBalance < summary.totalValue) {
      setPurchaseDialogError("Số dư chưa đủ. Hãy nạp thêm tiền rồi quay lại thanh toán nhé.");
      return;
    }

    setError(null);
    setNotice(null);
    setPurchaseDialogError(null);
    setOrderingPlanId(purchaseDialogPlan.id);

    try {
      const order = await createPricingOrder({ planId: purchaseDialogPlan.id });
      await onPurchaseSuccess?.();
      setNotice(`Thanh toán thành công gói ${order.planName}. Đang quay về trang chính...`);
      setPurchaseDialogPlan(null);
      window.setTimeout(() => {
        onBack();
      }, 900);
    } catch (orderError) {
      const message =
        orderError instanceof Error
          ? orderError.message
          : "Không thể mua gói nâng cấp.";
      setPurchaseDialogError(message);
      if (/số dư không đủ|nạp thêm/i.test(message)) {
        setError(null);
        return;
      }
      setError(message);
    } finally {
      setOrderingPlanId(null);
    }
  };

  return (
    <div className="marketing-shell">
      <div className="marketing-shell__backdrop" />
      <motion.section
        className="upgrade-page"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
      >
        <header className="upgrade-page__topbar">
          <div className="upgrade-page__topbar-lead">
            <button type="button" className="ghost-button" onClick={onBack}>
              <ArrowLeft size={16} />
              Quay lại AI TTM
            </button>
            <button type="button" className="ghost-button" onClick={goToMainSiteHome}>
              Trang chủ trungtammmo.vn
            </button>
          </div>

          <div className="upgrade-page__topbar-actions">
            <BalanceDisplay
              balanceVnd={authUser?.balance}
              planLabel={authUser?.currentPlanName}
              onTopUp={openTopUp}
              className="balance-display--upgrade"
            />
            {isAdminRole(authUser?.role) && (
              <button type="button" className="ghost-button" onClick={onOpenAdmin}>
                <ShieldUser size={16} />
                Quản trị gói
              </button>
            )}
          </div>
        </header>

        <div className="upgrade-page__hero">
          <p className="section-label">Bảng giá nâng cấp</p>
          <h1>Upgrade your plan</h1>
          <p>
            Chọn gói phù hợp để mở rộng dung lượng chat, số model, độ dài ngữ cảnh
            và quyền dùng các tính năng nâng cao trong AI TTM.
          </p>

          <div className="upgrade-toggle">
            {audiences.map((item) => (
              <button
                key={item}
                type="button"
                className={`upgrade-toggle__pill ${audience === item ? "active" : ""}`}
                onClick={() => setAudience(item)}
              >
                {audienceLabelMap[item] ?? item}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="upgrade-loader">
            <GradientLoader size={180} label="Đang tải bảng giá..." />
          </div>
        ) : error ? (
          <div className="banner-error">{error}</div>
        ) : (
          <>
            {notice ? <div className="banner-success">{notice}</div> : null}
            <div className="upgrade-grid" style={upgradeGridStyle}>
              {plans.map((plan, index) => {
                const planIcon = PLAN_ICON_MAP[plan.slug] ?? {
                  icon: Sparkles,
                  tone: "is-default"
                };
                const PlanGlyph = planIcon.icon;

                return (
                <motion.article
                  key={plan.id}
                  className={`upgrade-card ${plan.isHighlighted ? "is-highlighted" : ""} ${
                    plan.isCurrentPlan ? "is-current" : ""
                  }`}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.25, ease: "easeOut" }}
                >
                  <div className="upgrade-card__head">
                    <div>
                      <div className="upgrade-card__title-row">
                        <span className={`upgrade-card__plan-icon ${planIcon.tone}`} aria-hidden="true">
                          <PlanGlyph size={15} />
                        </span>
                        <h2>{plan.name}</h2>
                      </div>
                      <p>{plan.summary}</p>
                    </div>
                    {plan.badgeText ? (
                      <span className="upgrade-card__badge">{plan.badgeText}</span>
                    ) : null}
                  </div>

                  <div className="upgrade-card__price">
                    <div className="upgrade-card__price-main">
                      <strong>{formatVndPrice(plan.priceValue)}</strong>
                      <span className="upgrade-card__currency">đ</span>
                    </div>
                    <div className="upgrade-card__price-copy">
                      <span>{plan.priceCurrency} / {plan.billingPeriod}</span>
                      <small>+ VAT 8% khi thanh toán</small>
                    </div>
                  </div>

                  <div className="upgrade-card__showcase">
                    <div className="upgrade-card__model-strip">
                      {(PLAN_PROVIDER_SHOWCASE[plan.slug] ?? PLAN_PROVIDER_SHOWCASE.plus).map((provider) => (
                        <span key={`${plan.id}-${provider.providerId}`} className="upgrade-card__model-badge">
                          <ModelAvatarMark
                            providerId={provider.providerId}
                            providerLabel={provider.providerLabel}
                            label={provider.providerLabel}
                            accent={provider.accent}
                            size={18}
                            alt={`${provider.providerLabel} logo`}
                          />
                        </span>
                      ))}
                    </div>
                    <div className="upgrade-card__showcase-copy">
                      <Sparkles size={14} />
                      <span>Kế hoạch này bao gồm</span>
                    </div>
                  </div>

                  <div className="upgrade-card__cta-row">
                    <button
                      type="button"
                      className={`upgrade-card__cta ${plan.isHighlighted ? "is-highlighted" : ""}`}
                      disabled={plan.isCurrentPlan || orderingPlanId === plan.id}
                      onClick={() => {
                        if (plan.isCurrentPlan) {
                          return;
                        }
                        if (!authUser) {
                          setError("Vui lòng đăng nhập để mua gói nâng cấp.");
                          return;
                        }
                        setPurchaseDialogError(null);
                        setPurchaseDialogPlan(plan);
                      }}
                    >
                      {plan.isCurrentPlan
                        ? "Gói hiện tại của bạn"
                        : orderingPlanId === plan.id
                          ? "Đang xử lý..."
                          : plan.ctaLabel}
                    </button>
                  </div>

                  <ul className="upgrade-card__features">
                    {plan.features.map((feature) => (
                      <li key={feature}>
                        <span className="upgrade-card__feature-icon">
                          {plan.isHighlighted ? <Sparkles size={15} /> : <Check size={15} />}
                        </span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="upgrade-card__limits">
                    {buildLimitPills(plan.limits).map((pill) => (
                      <div key={`${plan.id}-${pill}`} className="upgrade-card__limit-pill">
                        {pill}
                      </div>
                    ))}
                  </div>

                  {plan.footerNote ? (
                    <div className="upgrade-card__footer-note">
                      {plan.isHighlighted ? <Crown size={14} /> : null}
                      <span>{plan.footerNote}</span>
                    </div>
                  ) : null}
                </motion.article>
                );
              })}
            </div>
          </>
        )}
      </motion.section>

      <PopupDialog
        open={Boolean(purchaseDialogPlan)}
        title={
          purchaseHasEnoughBalance
            ? `Xác nhận nâng cấp ${purchaseDialogPlan?.name ?? ""}`
            : "Số dư chưa đủ để thanh toán"
        }
        description={
          purchaseHasEnoughBalance
            ? "Đơn nâng cấp sẽ trừ trực tiếp từ số dư tài khoản của bạn ngay sau khi xác nhận."
            : "Số dư hiện tại chưa đủ cho đơn hàng này. Hãy nạp thêm rồi quay lại thanh toán nhé."
        }
        confirmLabel={purchaseHasEnoughBalance ? "Đồng ý thanh toán" : "Đã hiểu"}
        cancelLabel={purchaseHasEnoughBalance ? "Suy nghĩ thêm" : "Đóng"}
        showCancel={false}
        confirmVariant="primary"
        loading={Boolean(
          purchaseDialogPlan && orderingPlanId === purchaseDialogPlan.id
        )}
        loadingLabel="Đang trừ tiền..."
        error={purchaseDialogError}
        icon={purchaseHasEnoughBalance ? <ReceiptText size={20} /> : <Wallet2 size={20} />}
        details={
          checkoutPreview && purchaseDialogPlan ? (
            <div className="purchase-popup">
              <div className="purchase-popup__plan">
                <div>
                  <strong>{purchaseDialogPlan.name}</strong>
                  <span>{purchaseDialogPlan.summary}</span>
                </div>
                <CheckCircle2 size={18} />
              </div>

              <div className="purchase-popup__breakdown">
                <div>
                  <span>Giá gói</span>
                  <strong>{formatVndPrice(checkoutPreview.subtotal)}đ</strong>
                </div>
                <div>
                  <span>Thuế VAT (8%)</span>
                  <strong>{formatVndPrice(checkoutPreview.taxValue)}đ</strong>
                </div>
                <div className="is-total">
                  <span>Tổng thanh toán</span>
                  <strong>{formatVndPrice(checkoutPreview.totalValue)}đ</strong>
                </div>
              </div>

              <div className={`purchase-popup__balance ${purchaseHasEnoughBalance ? "" : "is-warning"}`}>
                <span>Số dư hiện có</span>
                <strong>{formatVndPrice(currentBalance)}đ</strong>
              </div>

              {!purchaseHasEnoughBalance && purchaseShortfall > 0 ? (
                <div className="purchase-popup__shortfall">
                  Bạn đang thiếu {formatVndPrice(purchaseShortfall)}đ để thanh toán đơn này.
                </div>
              ) : null}
            </div>
          ) : null
        }
        onConfirm={() => {
          if (!purchaseHasEnoughBalance) {
            setPurchaseDialogPlan(null);
            setPurchaseDialogError(null);
            return;
          }
          void handlePurchaseConfirm();
        }}
        onClose={() => {
          if (orderingPlanId) {
            return;
          }
          setPurchaseDialogPlan(null);
          setPurchaseDialogError(null);
        }}
      />
    </div>
  );
}
