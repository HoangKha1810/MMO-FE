'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

const SUSPICIOUS_CLIPBOARD_PATTERNS = [
  /document\.cookie/i,
  /localStorage|sessionStorage/i,
  /fetch\s*\(|XMLHttpRequest|axios\./i,
  /eval\s*\(|new\s+Function/i,
  /<script|javascript:/i,
  /process\.env|__NEXT_DATA__/i,
  /union\s+select|information_schema|drop\s+table/i,
  /curl\s+|wget\s+|powershell|cmd\.exe|bash\s+-c/i,
];

const SUSPICIOUS_RUNTIME_MARKERS = [
  '__selenium_unwrapped',
  '__webdriver_evaluate',
  '__driver_evaluate',
  '__playwright',
  '_phantom',
  'callPhantom',
];

const SERVICE_PATH_PATTERN = /^\/user\/(smm|automxh|resources|game-accounts|random-game-accounts|game-market|support-tiktok|meta-support|proxy|vps-gpu|vibe-code|web-service|press|card|deposit|cart|orders)(?:\/|$)/;

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || target.isContentEditable;
}

function containsSuspiciousCode(value: string) {
  return SUSPICIOUS_CLIPBOARD_PATTERNS.some((pattern) => pattern.test(value));
}

export function ClientSecurityObserver() {
  const lastReportRef = useRef<Record<string, number>>({});
  const forcedLogoutRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const originalFetch = window.fetch.bind(window);
    const originalXhrOpen = XMLHttpRequest.prototype.open;
    const originalXhrSend = XMLHttpRequest.prototype.send;

    const isProtectedArea = () => /^\/(?:user|admin)(?:\/|$)/.test(window.location.pathname);
    const isServiceArea = () => SERVICE_PATH_PATTERN.test(window.location.pathname);

    const isLogoutExemptApi = (url: string) => {
      try {
        const pathname = new URL(url || '/', window.location.origin).pathname;
        return [
          '/api/auth/login',
          '/api/auth/admin-login',
          '/api/auth/2fa',
          '/api/auth/logout',
          '/api/security/event',
        ].includes(pathname);
      } catch {
        return false;
      }
    };

    const forceSecurityLogout = (reason = 'security-blocked') => {
      if (forcedLogoutRef.current) {
        return;
      }
      forcedLogoutRef.current = true;

      try {
        window.localStorage.setItem('ttmmo_security_logout_reason', reason);
      } catch {
        // Ignore storage failures; logout is the important part.
      }

      const loginUrl = new URL('/auth/login', window.location.origin);
      loginUrl.searchParams.set('reason', reason);
      loginUrl.searchParams.set('security', 'blocked');

      originalFetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        keepalive: true,
      }).finally(() => {
        window.location.replace(loginUrl.toString());
      });
    };

    const inspectSecurityPayload = (payload: unknown, fallbackStatus = 0, responseUrl = '') => {
      if ((fallbackStatus === 401 || fallbackStatus === 403) && isProtectedArea() && !isLogoutExemptApi(responseUrl)) {
        forceSecurityLogout(fallbackStatus === 403 ? 'security-banned' : 'session-ended');
        return;
      }

      if (!payload || typeof payload !== 'object') {
        return;
      }

      const data = payload as {
        autoBanned?: unknown;
        bannedUser?: unknown;
        blocked?: unknown;
        code?: unknown;
        severity?: unknown;
        riskScore?: unknown;
      };
      const code = String(data.code || '').toUpperCase();
      const severity = String(data.severity || '').toUpperCase();
      const riskScore = Number(data.riskScore || 0);
      const shouldLogout =
        data.autoBanned === true ||
        data.bannedUser === true ||
        data.blocked === true ||
        code === 'SECURITY_BLOCKED' ||
        code === 'ACCOUNT_BANNED' ||
        code === 'USER_BANNED' ||
        code === 'IP_BLOCKED' ||
        code === 'INVALID_SESSION' ||
        (fallbackStatus === 403 && severity === 'CRITICAL' && riskScore >= 95);

      if (shouldLogout) {
        forceSecurityLogout(code === 'INVALID_SESSION' ? 'session-ended' : 'security-banned');
      }
    };

    const inspectSecurityResponse = async (response: Response) => {
      if ((response.status === 401 || response.status === 403) && isProtectedArea() && !isLogoutExemptApi(response.url)) {
        forceSecurityLogout(response.status === 403 ? 'security-banned' : 'session-ended');
        return;
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return;
      }

      const payload = await response.clone().json().catch(() => null);
      inspectSecurityPayload(payload, response.status, response.url);
    };

    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const response = await originalFetch(...args);
      inspectSecurityResponse(response).catch(() => undefined);
      return response;
    };

    const patchedOpen = function patchedOpen(
      this: XMLHttpRequest,
      method: string,
      url: string | URL,
      async?: boolean,
      username?: string | null,
      password?: string | null
    ) {
      (this as XMLHttpRequest & { __ttmmoSecurityUrl?: string }).__ttmmoSecurityUrl = String(url || '');
      return originalXhrOpen.call(this, method, url, async ?? true, username ?? null, password ?? null);
    } as typeof XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = patchedOpen;
    XMLHttpRequest.prototype.send = function patchedSend(this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
      this.addEventListener('load', () => {
        const xhr = this as XMLHttpRequest & { __ttmmoSecurityUrl?: string };
        const responseUrl = xhr.__ttmmoSecurityUrl || '';
        if ((xhr.status === 401 || xhr.status === 403) && isProtectedArea() && !isLogoutExemptApi(responseUrl)) {
          forceSecurityLogout(xhr.status === 403 ? 'security-banned' : 'session-ended');
          return;
        }

        const contentType = xhr.getResponseHeader('content-type') || '';
        if (!contentType.includes('application/json')) {
          return;
        }

        try {
          inspectSecurityPayload(JSON.parse(String(xhr.responseText || '')), xhr.status, responseUrl);
        } catch {
          // Ignore non-JSON API responses.
        }
      });
      return originalXhrSend.call(this, body ?? null);
    };

    const report = (eventType: string, payload = '', signal = '') => {
      const key = `${eventType}:${signal}:${payload.slice(0, 80)}`;
      const now = Date.now();
      if ((lastReportRef.current[key] || 0) + 10_000 > now) {
        return;
      }
      lastReportRef.current[key] = now;

      const body = JSON.stringify({
        eventType,
        payload: payload.slice(0, 1200),
        signal,
        path: window.location.pathname,
        href: window.location.href,
        source: 'client-security-observer',
      });

      fetch('/api/security/event', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        keepalive: true,
        body,
      }).catch(() => {
        navigator.sendBeacon?.('/api/security/event', new Blob([body], { type: 'application/json' }));
      });
    };

    const collectNetworkSignal = () => {
      const nav = navigator as Navigator & {
        connection?: { effectiveType?: string; rtt?: number; downlink?: number; saveData?: boolean };
        deviceMemory?: number;
      };
      const parts = [
        `tz:${Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown'}`,
        `lang:${navigator.language || 'unknown'}`,
        `platform:${navigator.platform || 'unknown'}`,
        `cores:${navigator.hardwareConcurrency || 0}`,
        `mem:${nav.deviceMemory || 0}`,
        `conn:${nav.connection?.effectiveType || 'unknown'}`,
        `rtt:${nav.connection?.rtt || 0}`,
        `down:${nav.connection?.downlink || 0}`,
        nav.connection?.saveData ? 'save-data' : '',
        navigator.webdriver ? 'automation' : '',
      ];

      if ((nav.deviceMemory || 8) <= 1 || navigator.hardwareConcurrency <= 2) {
        parts.push('low-memory');
      }

      return parts.filter(Boolean).join('|');
    };

    const checkNetworkRisk = (() => {
      let inFlight = false;
      let lastCheckedAt = 0;
      return async (action: string) => {
        if (!isServiceArea() || inFlight || forcedLogoutRef.current) {
          return;
        }

        const now = Date.now();
        if (lastCheckedAt + 2_500 > now) {
          return;
        }
        lastCheckedAt = now;
        inFlight = true;

        try {
          const response = await originalFetch('/api/security/network-risk', {
            method: 'POST',
            credentials: 'include',
            cache: 'no-store',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              action,
              path: window.location.pathname,
              href: window.location.href,
              signal: collectNetworkSignal(),
            }),
          });
          const payload = await response.clone().json().catch(() => null);
          inspectSecurityPayload(payload, response.status, response.url);
          if (payload?.warning && payload?.message) {
            toast.warning(String(payload.message), {
              duration: 7000,
              id: `network-risk-${payload.warnings || 1}`,
            });
          }
        } catch {
          // Network risk checks should never break normal UI events.
        } finally {
          inFlight = false;
        }
      };
    })();

    const onPaste = (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData('text') || '';
      if (!text) {
        return;
      }

      if (containsSuspiciousCode(text)) {
        event.preventDefault();
        report('CONSOLE_OR_TOOL_PASTE_BLOCKED', text, isEditableTarget(event.target) ? 'editable' : 'document');
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const devtoolsShortcut =
        key === 'f12' ||
        (event.ctrlKey && event.shiftKey && ['i', 'j', 'c'].includes(key)) ||
        (event.metaKey && event.altKey && ['i', 'j', 'c'].includes(key));

      if (devtoolsShortcut) {
        report('DEVTOOLS_SHORTCUT', key, 'keyboard');
      }
    };

    const onServiceInteraction = (event: Event) => {
      const target = event.target instanceof HTMLElement
        ? event.target.closest('button,a,input,select,textarea,[role="button"],[data-security-action]')
        : null;
      if (!target) {
        return;
      }
      checkNetworkRisk(target.getAttribute('aria-label') || target.textContent?.slice(0, 80) || event.type);
    };

    const inspectRuntime = () => {
      const win = window as unknown as Window & Record<string, unknown> & { webdriver?: boolean };
      if (navigator.webdriver) {
        report('AUTOMATION_RUNTIME_DETECTED', 'navigator.webdriver=true', 'webdriver');
      }

      for (const marker of SUSPICIOUS_RUNTIME_MARKERS) {
        if (win[marker] !== undefined) {
          report('AUTOMATION_RUNTIME_DETECTED', marker, 'runtime-marker');
          break;
        }
      }

      const widthGap = Math.abs(window.outerWidth - window.innerWidth);
      const heightGap = Math.abs(window.outerHeight - window.innerHeight);
      if (widthGap > 220 || heightGap > 220) {
        report('DEVTOOLS_OPENED', `gap:${widthGap}x${heightGap}`, 'viewport-gap');
      }
    };

    const originalConsoleClear = console.clear.bind(console);
    const showConsoleWarning = () => {
      originalConsoleClear();
      console.log(
        '%cTRUNGTAMMMO SECURITY',
        'font-size:20px;font-weight:900;color:#38bdf8;background:#020617;padding:8px 12px;border-radius:8px;'
      );
      console.log(
        '%cKhông dán hoặc chạy code/tool lạ tại đây. Hệ thống sẽ ghi log IP, thiết bị và tự khóa tài khoản khi phát hiện hành vi tấn công.',
        'font-size:14px;color:#e2e8f0;background:#0f172a;padding:8px 12px;border-radius:8px;'
      );
    };

    showConsoleWarning();
    window.addEventListener('paste', onPaste, true);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('click', onServiceInteraction, true);
    window.addEventListener('submit', onServiceInteraction, true);
    window.addEventListener('change', onServiceInteraction, true);
    window.addEventListener('resize', inspectRuntime);
    const interval = window.setInterval(inspectRuntime, 12_000);
    const sessionInterval = window.setInterval(() => {
      if (!isProtectedArea() || forcedLogoutRef.current) {
        return;
      }

      originalFetch('/api/user/me?security_check=1', {
        credentials: 'include',
        cache: 'no-store',
        headers: { 'x-security-probe': '1' },
      }).then((response) => {
        inspectSecurityResponse(response).catch(() => undefined);
      }).catch(() => undefined);
    }, 5_000);
    inspectRuntime();

    return () => {
      window.fetch = originalFetch;
      XMLHttpRequest.prototype.open = originalXhrOpen;
      XMLHttpRequest.prototype.send = originalXhrSend;
      window.removeEventListener('paste', onPaste, true);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('click', onServiceInteraction, true);
      window.removeEventListener('submit', onServiceInteraction, true);
      window.removeEventListener('change', onServiceInteraction, true);
      window.removeEventListener('resize', inspectRuntime);
      window.clearInterval(interval);
      window.clearInterval(sessionInterval);
    };
  }, []);

  return null;
}
