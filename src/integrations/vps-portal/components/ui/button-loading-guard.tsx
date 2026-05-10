"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { API_ACTIVITY_EVENT, getPendingApiRequestCount } from "@vps/lib/api";

const BUTTON_LOADING_SELECTOR = [
  'button:not([data-loading-ignore="true"])',
  'a.action-button:not([data-loading-ignore="true"])',
  'a.ghost-button:not([data-loading-ignore="true"])',
  'a.landing-buy-button:not([data-loading-ignore="true"])',
].join(", ");

const MIN_LOADING_MS = 650;
const REQUEST_DETECTION_MS = 320;

type ButtonLock = {
  baselinePending: number;
  startedAt: number;
  requestDetected: boolean;
  releaseTimer: number | null;
  detectionTimer: number | null;
  form: HTMLFormElement | null;
};

function getEligibleElement(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return null;
  }

  const element = target.closest(BUTTON_LOADING_SELECTOR);

  return element instanceof HTMLElement ? element : null;
}

function isModifiedClick(event: MouseEvent) {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

export function ButtonLoadingGuard() {
  const pathname = usePathname();
  const locksRef = useRef(new Map<HTMLElement, ButtonLock>());

  useEffect(() => {
    const locks = locksRef.current;

    const clearLock = (element: HTMLElement) => {
      const lock = locks.get(element);

      if (!lock) {
        return;
      }

      if (lock.releaseTimer) {
        window.clearTimeout(lock.releaseTimer);
      }

      if (lock.detectionTimer) {
        window.clearTimeout(lock.detectionTimer);
      }

      element.removeAttribute("data-auto-loading");
      element.removeAttribute("aria-busy");

      if (lock.form?.dataset.autoLoadingSubmitter === "true") {
        lock.form.removeAttribute("data-auto-loading-submitter");
      }

      locks.delete(element);
    };

    const clearAllLocks = () => {
      Array.from(locks.keys()).forEach(clearLock);
    };

    const scheduleRelease = (element: HTMLElement, delay = 0) => {
      const lock = locks.get(element);

      if (!lock) {
        return;
      }

      if (lock.releaseTimer) {
        window.clearTimeout(lock.releaseTimer);
      }

      lock.releaseTimer = window.setTimeout(() => {
        clearLock(element);
      }, Math.max(0, delay));
    };

    const activate = (element: HTMLElement, form: HTMLFormElement | null = null) => {
      if (locks.has(element)) {
        return;
      }

      const lock: ButtonLock = {
        baselinePending: getPendingApiRequestCount(),
        startedAt: performance.now(),
        requestDetected: false,
        releaseTimer: null,
        detectionTimer: null,
        form,
      };

      element.setAttribute("data-auto-loading", "true");
      element.setAttribute("aria-busy", "true");

      if (form) {
        form.setAttribute("data-auto-loading-submitter", "true");
      }

      lock.detectionTimer = window.setTimeout(() => {
        const activeLock = locks.get(element);

        if (!activeLock || activeLock.requestDetected) {
          return;
        }

        const elapsed = performance.now() - activeLock.startedAt;

        scheduleRelease(element, MIN_LOADING_MS - elapsed);
      }, REQUEST_DETECTION_MS);

      locks.set(element, lock);
    };

    const syncLocksWithRequests = () => {
      const pendingCount = getPendingApiRequestCount();

      locks.forEach((lock, element) => {
        if (!element.isConnected) {
          clearLock(element);
          return;
        }

        if (!lock.requestDetected && pendingCount > lock.baselinePending) {
          lock.requestDetected = true;

          if (lock.detectionTimer) {
            window.clearTimeout(lock.detectionTimer);
            lock.detectionTimer = null;
          }
        }

        if (lock.requestDetected && pendingCount <= lock.baselinePending) {
          const elapsed = performance.now() - lock.startedAt;

          scheduleRelease(element, MIN_LOADING_MS - elapsed);
        }
      });
    };

    const handleClickCapture = (event: MouseEvent) => {
      const element = getEligibleElement(event.target);

      if (!element) {
        return;
      }

      if (locks.has(element)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const handleClickBubble = (event: MouseEvent) => {
      const element = getEligibleElement(event.target);

      if (!element || event.defaultPrevented || locks.has(element)) {
        return;
      }

      if (element instanceof HTMLAnchorElement && isModifiedClick(event)) {
        return;
      }

      if (element instanceof HTMLButtonElement && element.type === "submit") {
        return;
      }

      queueMicrotask(() => {
        if (element.isConnected && !locks.has(element)) {
          activate(element);
        }
      });
    };

    const handleSubmitCapture = (event: Event) => {
      const form = event.target instanceof HTMLFormElement ? event.target : null;

      if (!form) {
        return;
      }

      if (form.dataset.autoLoadingSubmitter === "true") {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const handleSubmitBubble = (event: Event) => {
      const form = event.target instanceof HTMLFormElement ? event.target : null;

      if (!form || event.defaultPrevented || form.dataset.autoLoadingSubmitter === "true") {
        return;
      }

      const submitEvent = event as SubmitEvent;
      const element = getEligibleElement(submitEvent.submitter);

      if (!element || locks.has(element)) {
        return;
      }

      queueMicrotask(() => {
        if (element.isConnected && !locks.has(element)) {
          activate(element, form);
        }
      });
    };

    document.addEventListener("click", handleClickCapture, true);
    document.addEventListener("click", handleClickBubble);
    document.addEventListener("submit", handleSubmitCapture, true);
    document.addEventListener("submit", handleSubmitBubble);
    window.addEventListener(API_ACTIVITY_EVENT, syncLocksWithRequests as EventListener);

    return () => {
      clearAllLocks();
      document.removeEventListener("click", handleClickCapture, true);
      document.removeEventListener("click", handleClickBubble);
      document.removeEventListener("submit", handleSubmitCapture, true);
      document.removeEventListener("submit", handleSubmitBubble);
      window.removeEventListener(API_ACTIVITY_EVENT, syncLocksWithRequests as EventListener);
    };
  }, []);

  useEffect(() => {
    locksRef.current.forEach((lock, element) => {
      element.removeAttribute("data-auto-loading");
      element.removeAttribute("aria-busy");
      lock.form?.removeAttribute("data-auto-loading-submitter");
    });
    locksRef.current.clear();
  }, [pathname]);

  return null;
}
