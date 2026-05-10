import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, LoaderCircle } from "lucide-react";

interface PopupDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  showCancel?: boolean;
  confirmVariant?: "danger" | "primary";
  confirmDisabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  error?: string | null;
  details?: ReactNode;
  icon?: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
}

export function PopupDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  showCancel = true,
  confirmVariant = "danger",
  confirmDisabled = false,
  loading = false,
  loadingLabel,
  error,
  details,
  icon,
  onConfirm,
  onClose
}: PopupDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="popup-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => {
            if (!loading) {
              onClose();
            }
          }}
        >
          <motion.div
            className="popup-dialog"
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 220, damping: 22 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="popup-dialog__icon">
              {icon ?? <AlertTriangle size={20} />}
            </div>

            <div className="popup-dialog__content">
              <h3>{title}</h3>
              <p>{description}</p>
              {details ? <div className="popup-dialog__details">{details}</div> : null}
              {error && <div className="popup-dialog__error">{error}</div>}
            </div>

            <div className={`popup-dialog__actions ${showCancel ? "" : "popup-dialog__actions--single"}`}>
              {showCancel ? (
                <button
                  className="ghost-button"
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                >
                  {cancelLabel}
                </button>
              ) : null}
              <button
                className={confirmVariant === "primary" ? "primary-button" : "danger-button"}
                type="button"
                onClick={onConfirm}
                disabled={loading || confirmDisabled}
              >
                {loading ? <LoaderCircle className="spin" size={16} /> : null}
                {loading ? loadingLabel ?? "Đang xử lý" : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
