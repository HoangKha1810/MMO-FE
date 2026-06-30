'use client';

import { useEffect, useRef } from 'react';

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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const report = (eventType: string, payload = '', signal = '') => {
      const key = `${eventType}:${signal}:${payload.slice(0, 80)}`;
      const now = Date.now();
      if ((lastReportRef.current[key] || 0) + 10_000 > now) {
        return;
      }
      lastReportRef.current[key] = now;

      navigator.sendBeacon?.(
        '/api/security/event',
        new Blob([
          JSON.stringify({
            eventType,
            payload: payload.slice(0, 1200),
            signal,
            path: window.location.pathname,
            href: window.location.href,
            source: 'client-security-observer',
          }),
        ], { type: 'application/json' })
      ) || fetch('/api/security/event', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        keepalive: true,
        body: JSON.stringify({
          eventType,
          payload: payload.slice(0, 1200),
          signal,
          path: window.location.pathname,
          href: window.location.href,
          source: 'client-security-observer',
        }),
      }).catch(() => undefined);
    };

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
    window.addEventListener('resize', inspectRuntime);
    const interval = window.setInterval(inspectRuntime, 12_000);
    inspectRuntime();

    return () => {
      window.removeEventListener('paste', onPaste, true);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('resize', inspectRuntime);
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
