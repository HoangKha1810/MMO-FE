'use client';

import { useEffect, useRef } from 'react';
import { useConfirmDialog } from '@/components/ui/confirm-dialog-provider';

const ROUTE_SETTLE_DELAY_MS = 2350;

export function GameMarketSafetyPopup() {
  const shownRef = useRef(false);
  const { alert } = useConfirmDialog();

  useEffect(() => {
    if (shownRef.current) {
      return;
    }
    shownRef.current = true;

    const timer = window.setTimeout(() => {
      void alert({
        title: 'Lưu ý giao dịch game',
        description: 'Nhớ gdtg qua Admin để tránh scam. Không nên giao dịch riêng ngoài luồng khi chưa có trung gian xác nhận.',
        confirmText: 'Đã hiểu',
        tone: 'danger',
      });
    }, ROUTE_SETTLE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [alert]);

  return null;
}
