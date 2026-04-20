'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Pin, ShoppingCart, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type OrderRow = Record<string, unknown>;

interface GameMarketDetailActionsProps {
  itemId: number;
  isOwner: boolean;
  isPinned: boolean;
  orders: OrderRow[];
}

export function GameMarketDetailActions({ itemId, isOwner, isPinned, orders }: GameMarketDetailActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [ratingValues, setRatingValues] = useState<Record<string, string>>({});
  const [reviewValues, setReviewValues] = useState<Record<string, string>>({});

  function purchase() {
    startTransition(async () => {
      try {
        const response = await fetch('/api/game-market/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_id: itemId }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.message || 'Không thể mua sản phẩm');
        }
        toast.success(payload.message || 'Mua sản phẩm thành công');
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Không thể mua sản phẩm');
      }
    });
  }

  function itemAction(action: 'pin' | 'unpin' | 'hide') {
    startTransition(async () => {
      try {
        const response = await fetch('/api/game-market/item', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, item_id: itemId }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.message || 'Không thể cập nhật sản phẩm');
        }
        toast.success(payload.message || 'Đã cập nhật sản phẩm');
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Không thể cập nhật sản phẩm');
      }
    });
  }

  function rate(orderId: number) {
    startTransition(async () => {
      try {
        const response = await fetch('/api/game-market/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'rate',
            order_id: orderId,
            rating: Number(ratingValues[String(orderId)] || 5),
            review: reviewValues[String(orderId)] || '',
          }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.message || 'Không thể gửi đánh giá');
        }
        toast.success(payload.message || 'Đã gửi đánh giá');
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Không thể gửi đánh giá');
      }
    });
  }

  if (isOwner) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => itemAction(isPinned ? 'unpin' : 'pin')} loading={isPending}>
            <Pin className="mr-1 h-4 w-4" />
            {isPinned ? 'Bỏ ghim' : 'Ghim 7 ngày'}
          </Button>
          <Button variant="outline" onClick={() => itemAction('hide')} loading={isPending}>
            <Trash2 className="mr-1 h-4 w-4" />
            Ẩn sản phẩm
          </Button>
          <Button asChild>
            <a href={`/user/game-market/edit/${itemId}`}>Sửa sản phẩm</a>
          </Button>
        </div>
        <div className="text-sm font-semibold leading-7 text-slate-500 dark:text-slate-400">
          Đây là sản phẩm của bạn. Bạn có thể ghim, ẩn hoặc chỉnh sửa thông tin ngay tại đây.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button loading={isPending} onClick={purchase}>
        <ShoppingCart className="mr-2 h-4 w-4" />
        Mua bằng số dư
      </Button>

      {orders.length > 0 ? (
        <div className="space-y-3">
          <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Đánh giá đơn đã mua</div>
          {orders.map((order) => (
            <div key={String(order.id)} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="mb-3 text-sm font-black uppercase tracking-[-0.03em] text-slate-950 dark:text-white">
                Order #{String(order.id)} · {String(order.status)}
              </div>
              <div className="grid gap-3">
                <select
                  value={ratingValues[String(order.id)] ?? String(order.rating || 5)}
                  onChange={(event) => setRatingValues((current) => ({ ...current, [String(order.id)]: event.target.value }))}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black outline-none dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                >
                  {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} sao</option>)}
                </select>
                <textarea
                  value={reviewValues[String(order.id)] ?? String(order.review || '')}
                  onChange={(event) => setReviewValues((current) => ({ ...current, [String(order.id)]: event.target.value }))}
                  rows={4}
                  placeholder="Cảm nhận sau khi nhận account/game..."
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold leading-7 outline-none dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                />
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" loading={isPending} onClick={() => rate(Number(order.id))}>
                    <Star className="mr-1 h-4 w-4" />
                    Gửi rating
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
