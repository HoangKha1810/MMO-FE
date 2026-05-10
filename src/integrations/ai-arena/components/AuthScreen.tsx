import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { AlertTriangle, LockKeyhole, Mail, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { GradientLoader } from "./GradientLoader";
import { PopupDialog } from "./PopupDialog";

interface AuthScreenProps {
  loading?: boolean;
  error?: string | null;
  title?: string;
  description?: string;
  submitLabel?: string;
  allowRegistration?: boolean;
  onLogin: (payload: {
    identifier: string;
    password: string;
  }) => Promise<void>;
  onRegister?: (payload: {
    username: string;
    email: string;
    password: string;
  }) => Promise<void>;
  onClearError?: () => void;
}

const easeOut = [0.22, 1, 0.36, 1] as const;

const panelTransition = {
  duration: 0.32,
  ease: easeOut,
};

export function AuthScreen({
  loading = false,
  error,
  title = "Đăng nhập vào AI TTM",
  description = "Dùng tài khoản TrungTamMMO để tiếp tục và giữ lịch sử chat AI theo đúng tài khoản của bạn.",
  submitLabel = "Vào AI TTM",
  allowRegistration = true,
  onLogin,
  onRegister,
  onClearError
}: AuthScreenProps) {
  const canRegister = allowRegistration && Boolean(onRegister);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [identifier, setIdentifier] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const effectiveError = localError ?? error;

  useEffect(() => {
    if (effectiveError) {
      setShowErrorPopup(true);
    }
  }, [effectiveError]);

  const clearErrors = () => {
    setLocalError(null);
    onClearError?.();
  };

  const handleModeChange = (nextMode: "login" | "register") => {
    clearErrors();
    setShowErrorPopup(false);
    setMode(nextMode);
  };

  const handleSubmit = async () => {
    if (mode === "register") {
      const normalizedUsername = username.trim();
      const normalizedEmail = email.trim();
      if (!normalizedUsername || !normalizedEmail || !password.trim() || !confirmPassword.trim()) {
        setLocalError("Vui lòng điền đầy đủ tên đăng nhập, email và mật khẩu.");
        return;
      }
      if (password !== confirmPassword) {
        setLocalError("Mật khẩu nhập lại chưa khớp.");
        return;
      }
      if (!onRegister) {
        setLocalError("Đăng ký hiện chưa sẵn sàng. Vui lòng thử lại sau.");
        return;
      }
    } else if (!identifier.trim() || !password.trim()) {
      return;
    }

    setSubmitting(true);
    try {
      clearErrors();
      if (mode === "register" && onRegister) {
        await onRegister({
          username: username.trim(),
          email: email.trim(),
          password
        });
      } else {
        await onLogin({
          identifier,
          password
        });
      }
    } catch {
      // Lỗi đã được chuẩn hóa và đẩy vào state chung để hiển thị trên form.
    } finally {
      setSubmitting(false);
    }
  };

  const errorPopupTitle =
    effectiveError && /mật khẩu nhập lại/i.test(effectiveError)
      ? "Mật khẩu chưa khớp"
      : effectiveError && /sai thông tin đăng nhập|không chính xác/i.test(effectiveError)
      ? "Sai tên đăng nhập hoặc mật khẩu"
      : effectiveError && /quyền quản trị/i.test(effectiveError)
        ? "Không có quyền đăng nhập admin"
        : mode === "register"
          ? "Đăng ký chưa thành công"
          : "Đăng nhập chưa thành công";

  const direction = mode === "register" ? 1 : -1;

  const crossFade = {
    initial: { opacity: 0, x: direction * 14 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: direction * -10 },
  };

  const fieldStagger = (index: number) => ({
    initial: { opacity: 0, y: 10 },
    animate: {
      opacity: 1,
      y: 0,
      transition: { delay: 0.04 + index * 0.05, duration: 0.28, ease: easeOut },
    },
    exit: { opacity: 0, y: -6, transition: { duration: 0.15 } },
  });

  return (
    <>
      <div className="auth-shell">
        <motion.section
          className="auth-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: easeOut }}
        >
          <div className="auth-card__glow" aria-hidden />

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit();
            }}
          >
            <div className="auth-card__hero">
              <motion.img
                src={toAiAssetUrl("logo.gif")}
                alt="AI TTM"
                className="auth-brand-logo"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: easeOut }}
              />

              {canRegister && (
                <LayoutGroup id="auth-mode-tabs">
                  <div className="auth-switch" role="tablist" aria-label="Chọn chế độ tài khoản">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={mode === "login"}
                      className={mode === "login" ? "active" : ""}
                      onClick={() => handleModeChange("login")}
                    >
                      {mode === "login" ? (
                        <motion.span
                          layoutId="auth-tab-pill"
                          className="auth-switch__highlight"
                          transition={{ type: "spring", stiffness: 380, damping: 34 }}
                        />
                      ) : null}
                      <span className="auth-switch__label">Đăng nhập</span>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={mode === "register"}
                      className={mode === "register" ? "active" : ""}
                      onClick={() => handleModeChange("register")}
                    >
                      {mode === "register" ? (
                        <motion.span
                          layoutId="auth-tab-pill"
                          className="auth-switch__highlight"
                          transition={{ type: "spring", stiffness: 380, damping: 34 }}
                        />
                      ) : null}
                      <span className="auth-switch__label">Đăng ký</span>
                    </button>
                  </div>
                </LayoutGroup>
              )}

              <AnimatePresence mode="wait">
                <motion.h1
                  key={`${mode}-title`}
                  initial={crossFade.initial}
                  animate={crossFade.animate}
                  exit={crossFade.exit}
                  transition={panelTransition}
                >
                  {mode === "register" ? "Tạo tài khoản AI TTM" : title}
                </motion.h1>
              </AnimatePresence>

              <AnimatePresence mode="wait">
                <motion.p
                  key={`${mode}-desc`}
                  initial={crossFade.initial}
                  animate={crossFade.animate}
                  exit={crossFade.exit}
                  transition={{ ...panelTransition, delay: 0.03 }}
                >
                  {mode === "register"
                    ? "Chưa có tài khoản? Tạo mới ngay để bắt đầu dùng AI TTM và lưu lịch sử chat theo riêng tài khoản của bạn."
                    : description}
                </motion.p>
              </AnimatePresence>
            </div>

            <AnimatePresence mode="wait">
              <motion.div key={mode} className="auth-fields" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
                {mode === "register" ? (
                  <>
                    <motion.label className="auth-field" {...fieldStagger(0)}>
                      <span>Tên đăng nhập</span>
                      <div className="auth-input-shell">
                        <UserRound size={16} aria-hidden />
                        <input
                          type="text"
                          value={username}
                          onChange={(event) => {
                            clearErrors();
                            setUsername(event.target.value);
                          }}
                          placeholder="Nhập tên đăng nhập mới"
                          autoComplete="username"
                        />
                      </div>
                    </motion.label>

                    <motion.label className="auth-field" {...fieldStagger(1)}>
                      <span>Email</span>
                      <div className="auth-input-shell">
                        <Mail size={16} aria-hidden />
                        <input
                          type="email"
                          value={email}
                          onChange={(event) => {
                            clearErrors();
                            setEmail(event.target.value);
                          }}
                          placeholder="Nhập email của bạn"
                          autoComplete="email"
                        />
                      </div>
                    </motion.label>
                  </>
                ) : (
                  <motion.label className="auth-field" {...fieldStagger(0)}>
                    <span>Tên đăng nhập hoặc email</span>
                    <div className="auth-input-shell">
                      <UserRound size={16} aria-hidden />
                      <input
                        type="text"
                        value={identifier}
                        onChange={(event) => {
                          clearErrors();
                          setIdentifier(event.target.value);
                        }}
                        placeholder="Nhập username hoặc email của bạn"
                        autoComplete="username"
                      />
                    </div>
                  </motion.label>
                )}

                <motion.label className="auth-field" {...fieldStagger(mode === "register" ? 2 : 1)}>
                  <span>Mật khẩu</span>
                  <div className="auth-input-shell">
                    <LockKeyhole size={16} aria-hidden />
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => {
                        clearErrors();
                        setPassword(event.target.value);
                      }}
                      placeholder={mode === "register" ? "Tạo mật khẩu mới" : "Nhập mật khẩu TrungTamMMO"}
                      autoComplete={mode === "register" ? "new-password" : "current-password"}
                    />
                  </div>
                </motion.label>

                {mode === "register" && (
                  <motion.label className="auth-field" {...fieldStagger(3)}>
                    <span>Nhập lại mật khẩu</span>
                    <div className="auth-input-shell">
                      <LockKeyhole size={16} aria-hidden />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(event) => {
                          clearErrors();
                          setConfirmPassword(event.target.value);
                        }}
                        placeholder="Nhập lại mật khẩu để xác nhận"
                        autoComplete="new-password"
                      />
                    </div>
                  </motion.label>
                )}
              </motion.div>
            </AnimatePresence>

            {effectiveError && (
              <motion.div
                className="auth-error"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }}
              >
                {effectiveError}
              </motion.div>
            )}

            <motion.button
              type="submit"
              className="primary-button wide auth-submit"
              disabled={loading || submitting}
              whileHover={loading || submitting ? undefined : { scale: 1.01 }}
              whileTap={loading || submitting ? undefined : { scale: 0.99 }}
              transition={{ type: "spring", stiffness: 500, damping: 28 }}
            >
              {submitting || loading ? (
                <>
                  <GradientLoader size={24} className="gradient-loader--button" />
                  {mode === "register" ? "Đang tạo tài khoản..." : "Đang xác thực..."}
                </>
              ) : mode === "register" ? (
                "Tạo tài khoản và vào AI TTM"
              ) : (
                submitLabel
              )}
            </motion.button>
          </form>
        </motion.section>
      </div>

      <PopupDialog
        open={Boolean(effectiveError) && showErrorPopup}
        title={errorPopupTitle}
        description={effectiveError ?? ""}
        confirmLabel="Đã hiểu"
        cancelLabel="Đóng"
        showCancel={false}
        confirmVariant="primary"
        icon={<AlertTriangle size={20} />}
        onConfirm={() => setShowErrorPopup(false)}
        onClose={() => setShowErrorPopup(false)}
      />
    </>
  );
}
import { toAiAssetUrl } from "../lib/runtime";
