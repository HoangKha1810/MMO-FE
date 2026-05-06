'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useConfirmDialog } from '@/components/ui/confirm-dialog-provider';

const DISCORD_INVITE_URL = 'https://discord.gg/YZPR75JZMJ';
const DISCORD_POPUP_DELAY_MS = 1200;
const DISCORD_POPUP_ROUTES = new Set(['/', '/user/home']);

export function SiteEntryDiscordPopup() {
  const pathname = usePathname();
  const { alert } = useConfirmDialog();
  const lastShownRouteRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || !DISCORD_POPUP_ROUTES.has(pathname)) {
      lastShownRouteRef.current = null;
      return;
    }

    if (lastShownRouteRef.current === pathname) {
      return;
    }
    lastShownRouteRef.current = pathname;

    const timer = window.setTimeout(() => {
      void alert({
        title: 'Tham gia Server Discord',
        description:
          'Tham gia Discord để nhận thêm thông tin, cập nhật dịch vụ và hỗ trợ nhanh hơn. Server đạt 1k thành viên sẽ có Giveaway VPS.',
        confirmText: 'Để sau',
        linkText: 'Vào Discord',
        linkHref: DISCORD_INVITE_URL,
        linkTarget: '_blank',
        tone: 'brand',
      });
    }, DISCORD_POPUP_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [alert, pathname]);

  return null;
}
