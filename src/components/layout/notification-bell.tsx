'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Bell, BellRing, CheckCheck, ExternalLink, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { readJsonResponse } from '@/lib/client-api';
import { formatDatabaseDateTime } from '@/lib/date-time';
import { cn } from '@/lib/utils';

interface NotificationItem {
  id: number | string;
  type?: string | null;
  title?: string | null;
  content?: string | null;
  message?: string | null;
  link?: string | null;
  is_read?: boolean | number | string | null;
  created_at?: string | Date | null;
  from_username?: string | null;
  from_user_id?: number | string | null;
}

const INITIAL_NOTIFICATION_DELAY_MS = 4000;
const NOTIFICATION_POLL_INTERVAL_MS = 60 * 1000;

function isUnread(value: unknown) {
  return value === false || value === 0 || value === '0' || value === null || value === undefined;
}

function notificationText(item: NotificationItem) {
  return String(item.message || item.content || item.title || 'Thông báo hệ thống');
}

function notificationSource(item: NotificationItem) {
  return String(item.from_username || (item.from_user_id ? `user #${item.from_user_id}` : item.type || 'system'));
}

function notificationHref(item: NotificationItem) {
  const href = String(item.link || '').trim();
  if (!href || href === '#') return '/user/forum/notifications';
  return href.startsWith('/') || href.startsWith('http') ? href : '/user/forum/notifications';
}

export function NotificationBell({ className }: { className?: string }) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const unreadCount = useMemo(() => items.filter((item) => isUnread(item.is_read)).length, [items]);
  const visibleItems = items.slice(0, 8);

  async function loadNotifications() {
    setLoading(true);
    try {
      const response = await fetch('/api/forum/notification', { cache: 'no-store' });
      const payload = await readJsonResponse(response, 'Không tải được thông báo');
      if (response.ok && payload.success && Array.isArray(payload.data)) {
        setItems(payload.data);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function markAllRead() {
    const previous = items;
    setItems((current) => current.map((item) => ({ ...item, is_read: 1 })));
    try {
      const response = await fetch('/api/forum/notification', { method: 'POST', cache: 'no-store' });
      if (!response.ok) {
        setItems(previous);
      }
    } catch {
      setItems(previous);
    }
  }

  useEffect(() => {
    const initialTimer = window.setTimeout(() => {
      if (document.visibilityState === 'visible') {
        void loadNotifications();
      }
    }, INITIAL_NOTIFICATION_DELAY_MS);

    const pollTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadNotifications();
      }
    }, NOTIFICATION_POLL_INTERVAL_MS);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(pollTimer);
    };
  }, []);

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) void loadNotifications();
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'notification-trigger group flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white/80 dark:border-white/8 dark:bg-white/[0.04]',
            className
          )}
          data-open={open}
          data-has-unread={unreadCount > 0}
          aria-label="Mở thông báo"
        >
          {loading && items.length === 0 ? (
            <Loader2 className="notification-trigger-icon h-4 w-4 animate-spin text-brand-blue" />
          ) : unreadCount > 0 ? (
            <BellRing className="notification-trigger-icon h-4 w-4 text-brand-blue" />
          ) : (
            <Bell className="notification-trigger-icon h-4 w-4 text-slate-400 group-hover:text-brand-blue dark:text-white/45" />
          )}
          {unreadCount > 0 ? (
            <>
              <span className="notification-ping" />
              <span className="notification-count-badge">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            </>
          ) : null}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="notification-panel mt-2 w-[min(22rem,calc(100vw-1rem))] rounded-[1.4rem] border-slate-200/80 p-2 shadow-2xl dark:border-white/[0.08]">
        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Thông báo</div>
            <div className="mt-0.5 text-sm font-black text-slate-950 dark:text-white">
              {unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : 'Không có thông báo mới'}
            </div>
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void markAllRead();
            }}
            disabled={unreadCount === 0}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 transition-all hover:border-brand-blue/30 hover:text-brand-blue disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-slate-300"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Đã đọc
          </button>
        </div>

        <DropdownMenuSeparator />

        <div className="custom-scrollbar max-h-[28rem] overflow-y-auto p-1">
          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl px-4 py-10 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang tải
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm font-bold text-slate-400 dark:border-white/10">
              Chưa có thông báo nào.
            </div>
          ) : (
            visibleItems.map((item) => {
              const unread = isUnread(item.is_read);
              const href = notificationHref(item);

              return (
                <DropdownMenuItem key={String(item.id)} asChild>
                  <Link
                    href={href}
                    className="notification-item group/item flex cursor-pointer items-start gap-3 rounded-2xl px-3 py-3 outline-none"
                  >
                    <span
                      className={cn(
                        'mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border',
                        unread
                          ? 'border-brand-blue/20 bg-brand-blue/10 text-brand-blue'
                          : 'border-slate-200 bg-slate-50 text-slate-400 dark:border-white/10 dark:bg-white/[0.04]'
                      )}
                    >
                      <Bell className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-sm font-black leading-5 text-slate-800 dark:text-white">
                        {notificationText(item)}
                      </span>
                      <span className="mt-1 block text-[11px] font-bold leading-5 text-slate-400">
                        {notificationSource(item)} · {item.created_at ? formatDatabaseDateTime(item.created_at) : 'vừa xong'}
                      </span>
                    </span>
                    <ExternalLink className="mt-2 h-3.5 w-3.5 shrink-0 text-slate-300 transition-all group-hover/item:-translate-y-0.5 group-hover/item:translate-x-0.5 group-hover/item:text-brand-blue" />
                    {unread ? <span className="mt-3 h-2 w-2 shrink-0 rounded-full bg-red-500" /> : null}
                  </Link>
                </DropdownMenuItem>
              );
            })
          )}
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link
            href="/user/forum/notifications"
            className="flex items-center justify-center rounded-2xl px-3 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-brand-blue"
          >
            Xem tất cả thông báo
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
