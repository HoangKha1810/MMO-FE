import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { shouldReduceAiMotion, toAiAssetUrl } from "../lib/runtime";

interface WelcomeSplashProps {
  open: boolean;
  onComplete?: () => void;
}

export function WelcomeSplash({ open, onComplete }: WelcomeSplashProps) {
  useEffect(() => {
    if (!open || !onComplete) {
      return;
    }

    const timeout = window.setTimeout(() => {
      onComplete();
    }, shouldReduceAiMotion() ? 420 : 2100);

    return () => window.clearTimeout(timeout);
  }, [open, onComplete]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="welcome-splash"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.34, ease: "easeOut" }}
        >
          <motion.div
            className="welcome-splash__panel"
            initial={{ opacity: 0, y: 18, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 0.98 }}
            transition={{ duration: 0.42, ease: "easeOut" }}
          >
            <img
              src={toAiAssetUrl("logo.gif")}
              alt="AI TTM"
              className="welcome-splash__gif"
            />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
