'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ArrowRight, BellRing, Send, ShieldCheck, X } from 'lucide-react';

const TELEGRAM_INVITE_URL = 'https://t.me/+8dxx56rLM6MwNjU1';
const TELEGRAM_POPUP_DELAY_MS = 1200;
const TELEGRAM_POPUP_ROUTES = new Set(['/', '/user/home']);
const TELEGRAM_POPUP_EXIT_MS = 220;
const TELEGRAM_POPUP_DISMISSED_KEY = 'trungtammmo_telegram_popup_dismissed_v1';

type PopupPhase = 'closed' | 'open' | 'closing';

export function SiteEntryDiscordPopup() {
  const pathname = usePathname();
  const lastShownRouteRef = useRef<string | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [phase, setPhase] = useState<PopupPhase>('closed');

  const dismiss = () => {
    if (phase === 'closed') {
      return;
    }

    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }

    window.sessionStorage.setItem(TELEGRAM_POPUP_DISMISSED_KEY, '1');
    setPhase('closing');
    closeTimerRef.current = window.setTimeout(() => {
      setPhase('closed');
      closeTimerRef.current = null;
    }, TELEGRAM_POPUP_EXIT_MS);
  };

  useEffect(() => {
    if (!pathname || !TELEGRAM_POPUP_ROUTES.has(pathname)) {
      lastShownRouteRef.current = null;
      setPhase('closed');
      return;
    }

    if (window.sessionStorage.getItem(TELEGRAM_POPUP_DISMISSED_KEY) === '1') {
      setPhase('closed');
      return;
    }

    if (lastShownRouteRef.current === pathname) {
      return;
    }
    lastShownRouteRef.current = pathname;

    const timer = window.setTimeout(() => {
      setPhase('open');
    }, TELEGRAM_POPUP_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  if (phase === 'closed') {
    return null;
  }

  return (
    <div
      aria-hidden={phase === 'closing'}
      className="telegram-entry-overlay"
      data-state={phase}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          dismiss();
        }
      }}
    >
      <section
        aria-describedby="telegram-entry-description"
        aria-labelledby="telegram-entry-title"
        aria-modal="true"
        className="telegram-entry-card"
        role="dialog"
      >
        <button
          type="button"
          aria-label="Đóng thông báo Telegram"
          className="telegram-entry-close"
          onClick={dismiss}
        >
          <X className="h-4 w-4" />
        </button>

        <div className="telegram-entry-icon" aria-hidden="true">
          <span className="telegram-entry-icon-ring" />
          <Send className="h-6 w-6" />
        </div>

        <div className="min-w-0">
          <div className="telegram-entry-kicker">
            <BellRing className="h-3.5 w-3.5" />
            Kênh cộng đồng
          </div>
          <h2 id="telegram-entry-title" className="telegram-entry-title">
            Tham gia nhóm Telegram
          </h2>
          <p id="telegram-entry-description" className="telegram-entry-description">
            Nhận cập nhật dịch vụ, thông báo bảo trì và hỗ trợ nhanh hơn. Nhóm đạt 1k thành viên sẽ có Giveaway VPS.
          </p>

          <div className="telegram-entry-safe">
            <ShieldCheck className="h-4 w-4" />
            Link mời chính thức từ TRUNGTAMMMO.VN
          </div>

          <div className="telegram-entry-actions">
            <a
              href={TELEGRAM_INVITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="telegram-entry-primary"
              onClick={dismiss}
            >
              Vào Telegram
              <ArrowRight className="h-4 w-4" />
            </a>
            <button type="button" className="telegram-entry-secondary" onClick={dismiss}>
              Để sau
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
