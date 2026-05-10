"use client";

import { Download, Monitor, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { siteConfig } from "@vps/lib/site";

const VISIT_THRESHOLD = 10;
const REMIND_AFTER_VISITS = 3;
const VISIT_COUNT_KEY = "ttm_desktop_install_visit_count";
const SESSION_COUNTED_KEY = "ttm_desktop_install_counted";
const SESSION_DISMISSED_KEY = "ttm_desktop_install_dismissed";
const SNOOZE_UNTIL_VISIT_KEY = "ttm_desktop_install_snooze_until";
const INSTALLED_KEY = "ttm_desktop_install_installed";

type DeferredInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

function isDesktopViewport() {
  return (
    window.matchMedia("(min-width: 1024px)").matches &&
    window.matchMedia("(pointer: fine)").matches
  );
}

function isStandaloneMode() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    navigatorWithStandalone.standalone === true
  );
}

export function DesktopInstallPrompt() {
  const [open, setOpen] = useState(false);
  const [visitCount, setVisitCount] = useState(0);
  const [showInstructions, setShowInstructions] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<DeferredInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/vps/sw.js").catch(() => {
        // Install prompt still has a fallback message if SW registration fails.
      });
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      const installEvent = event as DeferredInstallPromptEvent;
      event.preventDefault();
      setDeferredPrompt(installEvent);
    };

    const handleInstalled = () => {
      try {
        window.localStorage.setItem(INSTALLED_KEY, "1");
      } catch {
        // no-op
      }

      setOpen(false);
      setDeferredPrompt(null);
      setShowInstructions(false);
    };

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt as EventListener,
    );
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt as EventListener,
      );
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      if (isStandaloneMode()) {
        window.localStorage.setItem(INSTALLED_KEY, "1");
        return;
      }

      if (!isDesktopViewport()) {
        return;
      }

      const alreadyInstalled = window.localStorage.getItem(INSTALLED_KEY) === "1";
      const alreadyCountedThisSession =
        window.sessionStorage.getItem(SESSION_COUNTED_KEY) === "1";
      const rawVisitCount = Number(window.localStorage.getItem(VISIT_COUNT_KEY) || "0");
      const nextVisitCount = alreadyCountedThisSession ? rawVisitCount : rawVisitCount + 1;
      const snoozeUntilVisit = Number(
        window.localStorage.getItem(SNOOZE_UNTIL_VISIT_KEY) || "0",
      );
      const dismissedThisSession =
        window.sessionStorage.getItem(SESSION_DISMISSED_KEY) === "1";

      if (!alreadyCountedThisSession) {
        window.localStorage.setItem(VISIT_COUNT_KEY, String(nextVisitCount));
        window.sessionStorage.setItem(SESSION_COUNTED_KEY, "1");
      }

      setVisitCount(nextVisitCount);

      if (
        nextVisitCount > VISIT_THRESHOLD &&
        nextVisitCount >= snoozeUntilVisit &&
        !alreadyInstalled &&
        !dismissedThisSession
      ) {
        setOpen(true);
      }
    } catch {
      // no-op
    }
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) {
      setShowInstructions(true);
      return;
    }

    setInstalling(true);

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;

      if (choice.outcome === "accepted") {
        try {
          window.localStorage.setItem(INSTALLED_KEY, "1");
        } catch {
          // no-op
        }

        setOpen(false);
        setShowInstructions(false);
      } else {
        handleLater(2);
      }
    } finally {
      setDeferredPrompt(null);
      setInstalling(false);
    }
  }

  function handleLater(extraVisits = REMIND_AFTER_VISITS) {
    try {
      window.sessionStorage.setItem(SESSION_DISMISSED_KEY, "1");
      window.localStorage.setItem(
        SNOOZE_UNTIL_VISIT_KEY,
        String(Math.max(visitCount + extraVisits, VISIT_THRESHOLD + 1)),
      );
    } catch {
      // no-op
    }

    setOpen(false);
    setShowInstructions(false);
  }

  if (!open) {
    return null;
  }

  return (
    <aside
      className="desktop-install-prompt"
      role="dialog"
      aria-live="polite"
      aria-label="Gợi ý cài website ra desktop"
    >
      <button
        type="button"
        className="desktop-install-prompt-close"
        onClick={() => handleLater()}
        aria-label="Đóng gợi ý cài website"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="desktop-install-prompt-icon">
        <Monitor className="h-5 w-5" />
        <Sparkles className="h-3.5 w-3.5" />
      </div>

      <div className="desktop-install-prompt-copy">
        <p className="desktop-install-prompt-kicker">Mở nhanh hơn trên desktop</p>
        <h3 className="desktop-install-prompt-title">
          Tải {siteConfig.shortName} ra màn hình desktop
        </h3>
        <p className="desktop-install-prompt-text">
          {showInstructions
            ? "Nếu trình duyệt chưa hiện cửa sổ cài đặt, anh hãy dùng Chrome hoặc Edge trên máy tính rồi bấm biểu tượng cài đặt cạnh thanh địa chỉ để thêm website ra desktop."
            : "Website có thể được thêm ra desktop như một app riêng để mở nhanh hơn ở những lần sau."}
        </p>
      </div>

      <div className="desktop-install-prompt-actions">
        <button
          type="button"
          className="desktop-install-prompt-primary"
          onClick={() => {
            void handleInstall();
          }}
          disabled={installing}
        >
          <Download className="h-4 w-4" />
          <span>{installing ? "Đang mở..." : "Tải xuống"}</span>
        </button>

        <button
          type="button"
          className="desktop-install-prompt-secondary"
          onClick={() => handleLater()}
        >
          Để sau
        </button>
      </div>
    </aside>
  );
}
