"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { shouldReducePortalMotion } from "@vps/lib/motion";
import { siteConfig } from "@vps/lib/site";

const SPLASH_KEY = "ttm_welcome_splash_done";
const DISPLAY_MS = 5000;

function shouldSkipSplash() {
  if (typeof window === "undefined") {
    return false;
  }

  return new URLSearchParams(window.location.search).get("skip-splash") === "1";
}

export function WelcomeSplash() {
  const [phase, setPhase] = useState<"idle" | "show" | "fade">(() => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return "idle";
    }

    if (shouldSkipSplash()) {
      document.documentElement.removeAttribute("data-welcome-splash");
      return "idle";
    }

    if (document.documentElement.dataset.welcomeSplash === "show") {
      return "show";
    }

    try {
      if (!window.sessionStorage.getItem(SPLASH_KEY)) {
        document.documentElement.dataset.welcomeSplash = "show";
        return "show";
      }
    } catch {
      return document.documentElement.dataset.welcomeSplash === "show" ? "show" : "idle";
    }

    return "idle";
  });

  const clearSplashFlags = useCallback(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.documentElement.removeAttribute("data-welcome-splash");
  }, []);

  const finish = useCallback(() => {
    try {
      sessionStorage.setItem(SPLASH_KEY, "1");
    } catch {
      /* ignore */
    }
    setPhase("fade");
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    let shouldShow = root.dataset.welcomeSplash === "show";

    if (shouldSkipSplash()) {
      clearSplashFlags();
      try {
        sessionStorage.setItem(SPLASH_KEY, "1");
      } catch {
        /* ignore */
      }
      return;
    }

    try {
      if (!shouldShow && !sessionStorage.getItem(SPLASH_KEY)) {
        root.dataset.welcomeSplash = "show";
        shouldShow = true;
      }
    } catch {
      shouldShow = root.dataset.welcomeSplash === "show";
    }

    if (!shouldShow) {
      clearSplashFlags();
      return;
    }

    const reduceMotion = shouldReducePortalMotion();

    if (reduceMotion) {
      const id = window.setTimeout(() => {
        try {
          sessionStorage.setItem(SPLASH_KEY, "1");
        } catch {
          /* ignore */
        }
        clearSplashFlags();
        setPhase("idle");
      }, 350);
      return () => window.clearTimeout(id);
    }

    const id = window.setTimeout(finish, DISPLAY_MS);
    return () => window.clearTimeout(id);
  }, [clearSplashFlags, finish]);

  useEffect(() => {
    if (phase !== "show" && phase !== "fade") {
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [phase]);

  const handleTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || phase !== "fade") {
      return;
    }
    clearSplashFlags();
    setPhase("idle");
  };

  useEffect(() => {
    if (phase !== "fade") {
      return;
    }
    const id = window.setTimeout(() => {
      clearSplashFlags();
      setPhase("idle");
    }, 800);
    return () => window.clearTimeout(id);
  }, [clearSplashFlags, phase]);

  if (phase === "idle") {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Chào mừng"
      className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-[#08111d] transition-opacity duration-500 ease-out"
      style={{ opacity: phase === "fade" ? 0 : 1 }}
      onTransitionEnd={handleTransitionEnd}
    >
      <button
        type="button"
        onClick={finish}
        className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-white/90 transition hover:bg-white/10 hover:text-white"
        aria-label="Đóng màn hình chào mừng"
      >
        <X className="h-5 w-5" strokeWidth={2} />
      </button>

      {/* eslint-disable-next-line @next/next/no-img-element -- splash should use direct gif asset */}
      <img
        src={siteConfig.splashLogoPath}
        alt={siteConfig.name}
        className="max-h-[min(42vh,220px)] w-auto max-w-[min(92vw,480px)] object-contain drop-shadow-[0_20px_60px_rgba(53,109,255,0.25)]"
        width={480}
        height={160}
        decoding="async"
        loading="eager"
        fetchPriority="high"
      />
      <p className="mt-8 max-w-[min(90vw,28rem)] text-center text-sm font-medium text-white/55">
        {siteConfig.title}
      </p>
    </div>
  );
}
