'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const NAVIGATION_EVENT = 'trungtammmo:navigation-start';
const NAVIGATION_FALLBACK_MS = 1800;

function isModifiedClick(event: MouseEvent) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

function isSameDocumentTarget(url: URL) {
  return `${url.pathname}${url.search}${url.hash}` === `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function startPageTransition() {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(NAVIGATION_EVENT));
}

function NavigationEffectsInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentRoute = useMemo(() => {
    const search = searchParams.toString();
    return search ? `${pathname}?${search}` : pathname;
  }, [pathname, searchParams]);
  const lastRouteRef = useRef(currentRoute);
  const mountedRef = useRef(false);
  const finishTimerRef = useRef<number | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);

  function clearTimers() {
    if (finishTimerRef.current) {
      window.clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }

    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }

    if (fallbackTimerRef.current) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }

  function markTransitioning(active: boolean) {
    document.documentElement.classList.toggle('route-transitioning', active);
  }

  function beginNavigation() {
    clearTimers();
    setIsNavigating(true);
    setProgress((current) => (current > 12 ? current : 12));
    markTransitioning(true);

    progressTimerRef.current = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 88) {
          return current;
        }

        return current + Math.max(3, (92 - current) * 0.14);
      });
    }, 120);

    fallbackTimerRef.current = window.setTimeout(() => {
      finishNavigation();
    }, NAVIGATION_FALLBACK_MS);
  }

  function finishNavigation() {
    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    if (fallbackTimerRef.current) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    if (finishTimerRef.current) {
      window.clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
    setIsNavigating(true);
    setProgress(100);
    markTransitioning(true);

    finishTimerRef.current = window.setTimeout(() => {
      setIsNavigating(false);
      setProgress(0);
      markTransitioning(false);
    }, 420);
  }

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || isModifiedClick(event)) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return;
      }

      if (anchor.target && anchor.target !== '_self') {
        return;
      }

      if (anchor.hasAttribute('download')) {
        return;
      }

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin || isSameDocumentTarget(url)) {
        return;
      }

      beginNavigation();
    };

    const handlePopState = () => {
      beginNavigation();
    };

    const handleCustomStart = () => {
      beginNavigation();
    };

    document.addEventListener('click', handleClick, true);
    window.addEventListener('popstate', handlePopState);
    window.addEventListener(NAVIGATION_EVENT, handleCustomStart);

    return () => {
      document.removeEventListener('click', handleClick, true);
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener(NAVIGATION_EVENT, handleCustomStart);
      clearTimers();
      markTransitioning(false);
    };
  }, []);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      lastRouteRef.current = currentRoute;
      return;
    }

    if (lastRouteRef.current !== currentRoute) {
      lastRouteRef.current = currentRoute;
      finishNavigation();
    }
  }, [currentRoute]);

  return (
    <>
      <div className={cn('route-progress-shell', isNavigating && 'opacity-100')}>
        <div className="route-progress-track">
          <div
            className="route-progress-bar"
            style={{ transform: `scaleX(${progress / 100})` }}
          />
        </div>
      </div>
      <div className={cn('route-curtain-overlay', isNavigating && 'route-curtain-overlay-active')} />
    </>
  );
}

export function NavigationEffects() {
  return (
    <Suspense fallback={null}>
      <NavigationEffectsInner />
    </Suspense>
  );
}

export function RouteStage({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="route-stage">
      {children}
    </div>
  );
}
