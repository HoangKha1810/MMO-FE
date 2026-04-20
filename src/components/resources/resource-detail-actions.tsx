'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Download, MessageSquareQuote, ShoppingCart, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ReviewRow = Record<string, unknown>;
type OrderRow = Record<string, unknown>;

interface ResourceDetailActionsProps {
  resourceId: number;
  stock: number;
  orders: OrderRow[];
  reviews: ReviewRow[];
}

export function ResourceDetailActions({ resourceId, stock, orders, reviews }: ResourceDetailActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [quantity, setQuantity] = useState('1');
  const [rating, setRating] = useState('5');
  const [comment, setComment] = useState('');

  function purchase() {
    startTransition(async () => {
      try {
        const response = await fetch('/api/resources/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resource_id: resourceId, quantity: Number(quantity || 1) }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.message || 'Không thể mua tài nguyên');
        }
        toast.success(payload.message || 'Mua thành công');
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Không thể mua tài nguyên');
      }
    });
  }

  function submitReview() {
    startTransition(async () => {
      try {
        const response = await fetch('/api/resources/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resource_id: resourceId, rating: Number(rating || 5), comment }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.message || 'Không thể gửi đánh giá');
        }
        toast.success(payload.message || 'Đã gửi đánh giá');
        setComment('');
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Không thể gửi đánh giá');
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="mb-3 text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Mua nhanh</div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="number"
            min={1}
            max={10}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className="h-11 w-28 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black outline-none dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
          />
          <Button disabled={stock <= 0} loading={isPending} onClick={purchase}>
            <ShoppingCart className="mr-2 h-4 w-4" />
            Mua bằng số dư
          </Button>
          <Button variant="outline" asChild>
            <a href="/user/resources/history">
              <Download className="mr-2 h-4 w-4" />
              Lịch sử tải
            </a>
          </Button>
        </div>
      </div>

      {orders.length > 0 ? (
        <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="mb-3 text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Đơn đã mua</div>
          <div className="grid gap-3 md:grid-cols-2">
            {orders.map((order) => (
              <div key={String(order.id)} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950/40">
                <div className="text-sm font-black uppercase tracking-[-0.03em] text-slate-950 dark:text-white">Order #{String(order.id)}</div>
                <div className="mt-2 text-sm font-semibold leading-7 text-slate-500 dark:text-slate-400">
                  {String(order.status)} · {Number(order.download_count || 0)} / {Number(order.max_downloads || 0)} lượt tải
                </div>
                <div className="mt-4">
                  <Button size="sm" asChild>
                    <a href={`/api/resources/download/${String(order.id)}`}>
                      <Download className="mr-1 h-4 w-4" />
                      Tải xuống
                    </a>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {orders.length > 0 ? (
        <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="mb-3 text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Đánh giá tài nguyên</div>
          <div className="grid gap-3">
            <select value={rating} onChange={(event) => setRating(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black outline-none dark:border-white/10 dark:bg-slate-950/40 dark:text-white">
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={value}>{value} sao</option>
              ))}
            </select>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={4}
              placeholder="Cảm nhận của bạn sau khi mua tài nguyên..."
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold leading-7 outline-none dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
            />
            <div className="flex justify-end">
              <Button size="sm" loading={isPending} onClick={submitReview}>
                <Star className="mr-1 h-4 w-4" />
                Gửi đánh giá
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {reviews.length > 0 ? (
        <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="mb-3 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
            <MessageSquareQuote className="h-4 w-4 text-brand-blue" />
            Review từ người mua
          </div>
          <div className="space-y-3">
            {reviews.map((review) => (
              <div key={String(review.id)} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950/40">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-black uppercase tracking-[-0.03em] text-slate-950 dark:text-white">
                    {String(review.fullname || review.username || `User #${review.user_id}`)}
                  </div>
                  <div className="text-xs font-black uppercase tracking-[0.16em] text-amber-500">{Number(review.rating || 0)} / 5 sao</div>
                </div>
                <p className="mt-3 text-sm font-semibold leading-7 text-slate-500 dark:text-slate-400">{String(review.comment || '')}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
