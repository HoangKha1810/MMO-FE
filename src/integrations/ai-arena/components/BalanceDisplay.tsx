import { AnimatePresence, motion } from "framer-motion";
import { Plus, Wallet2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const formatBalanceVnd = (value: number) =>
  `${new Intl.NumberFormat("vi-VN").format(Math.round(value))} đ`;

interface BalanceDisplayProps {
  balanceVnd?: number | null;
  planLabel?: string | null;
  className?: string;
  onTopUp?: () => void;
  showTopUpButton?: boolean;
}

export function BalanceDisplay({
  balanceVnd,
  planLabel,
  className = "",
  onTopUp,
  showTopUpButton = true
}: BalanceDisplayProps) {
  const targetBalance = typeof balanceVnd === "number" && Number.isFinite(balanceVnd) ? balanceVnd : 0;
  const [displayBalance, setDisplayBalance] = useState(targetBalance);
  const [delta, setDelta] = useState<number | null>(null);
  const previousBalanceRef = useRef(targetBalance);
  const deltaTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const previousBalance = previousBalanceRef.current;
    const nextBalance = targetBalance;

    if (previousBalance === nextBalance) {
      setDisplayBalance(nextBalance);
      return;
    }

    const startedAt = performance.now();
    const duration = 580;
    let frameId = 0;

    if (nextBalance < previousBalance) {
      setDelta(previousBalance - nextBalance);
      if (deltaTimeoutRef.current) {
        window.clearTimeout(deltaTimeoutRef.current);
      }
      deltaTimeoutRef.current = window.setTimeout(() => {
        setDelta(null);
      }, 1450);
    } else {
      setDelta(null);
    }

    const animate = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setDisplayBalance(previousBalance + (nextBalance - previousBalance) * eased);
      if (progress < 1) {
        frameId = window.requestAnimationFrame(animate);
      } else {
        setDisplayBalance(nextBalance);
      }
    };

    frameId = window.requestAnimationFrame(animate);
    previousBalanceRef.current = nextBalance;

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [targetBalance]);

  useEffect(
    () => () => {
      if (deltaTimeoutRef.current) {
        window.clearTimeout(deltaTimeoutRef.current);
      }
    },
    []
  );

  const normalizedPlanLabel = useMemo(() => {
    const trimmed = (planLabel || "").trim();
    return trimmed || "Free";
  }, [planLabel]);

  return (
    <div className={`balance-display ${className}`.trim()}>
      <div className="balance-display__icon">
        <Wallet2 size={16} />
      </div>

      <div className="balance-display__content">
        <span className="balance-display__label">Số dư</span>
        <strong>{formatBalanceVnd(displayBalance)}</strong>
      </div>

      <span className="balance-display__plan">{normalizedPlanLabel}</span>

      {showTopUpButton ? (
        <button
          type="button"
          className="balance-display__action"
          onClick={onTopUp}
          aria-label="Nạp thêm số dư"
          title="Nạp thêm số dư"
        >
          <Plus size={15} />
        </button>
      ) : null}

      <AnimatePresence>
        {delta ? (
          <motion.span
            className="balance-display__delta"
            initial={{ opacity: 0, y: 10, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.94 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
          >
            -{formatBalanceVnd(delta)}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
