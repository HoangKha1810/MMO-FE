'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { BadgeCheck, MessageSquareText } from 'lucide-react';
import { useConfirmDialog } from '@/components/ui/confirm-dialog-provider';
import { Button } from '@/components/ui/button';
import { formatCurrency, toNumber } from '@/lib/utils';

type SellerOrder = Record<string, unknown>;

function buildConversationHref(order: SellerOrder) {
  const buyerId = Number(order.buyer_id || 0);
  const itemId = Number(order.item_id || 0);
  const orderId = Number(order.id || 0);
  const params = new URLSearchParams({
    item: String(itemId),
    order: String(orderId),
    compose: 'handover-seller',
  });
  return `/user/social/conversation/${buyerId}?${params.toString()}`;
}

export function SellerGameOrdersBoard({ orders }: { orders: SellerOrder[] }) {
  const router = useRouter();
  const { confirm } = useConfirmDialog();
  const [isPending, startTransition] = useTransition();

  function markCompleted(orderId: number) {
    startTransition(async () => {
      try {
        const accepted = await confirm({
          title: 'Xác nhận đã bàn giao',
          description: 'Chỉ xác nhận khi bạn đã gửi đầy đủ tài khoản, mật khẩu, mail, số điện thoại và mọi thông tin liên quan cho người tạo đơn ngay trong đoạn chat giao dịch.',
          confirmText: 'Đã bàn giao xong',
          cancelText: 'Chưa xong',
          tone: 'brand',
        });

        if (!accepted) {
          return;
        }

        const response = await fetch('/api/game-market/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'complete', order_id: orderId }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.message || 'Không thể cập nhật trạng thái đơn trao đổi');
        }

        toast.success(payload.message || 'Đã xác nhận bàn giao đơn trao đổi');
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Không thể cập nhật đơn trao đổi');
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[1.5rem] border border-brand-blue/15 bg-brand-blue/5 p-4 text-sm font-semibold leading-7 text-slate-600 dark:border-brand-blue/20 dark:bg-brand-blue/10 dark:text-slate-300">
        Ưu tiên trao đổi và bàn giao toàn bộ tài khoản, mật khẩu, mail, số điện thoại và lưu ý đăng nhập qua chat riêng của từng đơn để người tạo đơn dễ kiểm tra và admin dễ đối soát khi cần.
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1060px] text-left text-sm">
          <thead className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            <tr>
              {['ID', 'Bài trao đổi', 'Người tạo đơn', 'Số tiền', 'Trạng thái', 'Ngày', 'Thao tác'].map((item) => (
                <th key={item} className="border-b border-slate-100 px-3 py-3 dark:border-white/5">{item}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {orders.map((order) => {
              const status = String(order.status || '').toLowerCase();
              const isCompleted = status === 'completed';

              return (
                <tr key={String(order.id)} className="align-top">
                  <td className="px-3 py-4 font-black text-slate-950 dark:text-white">#{String(order.id)}</td>
                  <td className="px-3 py-4">
                    <div className="font-bold text-slate-700 dark:text-slate-200">{String(order.item_title || order.item_id)}</div>
                    <div className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                      {String(order.item_category || 'Trao đổi game')}
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <div className="font-bold text-slate-700 dark:text-slate-200">{String(order.buyer_username || order.buyer_id)}</div>
                    <div className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                      User #{String(order.buyer_id || '0')}
                    </div>
                  </td>
                  <td className="px-3 py-4 font-black text-emerald-500">{formatCurrency(toNumber(order.amount))}</td>
                  <td className="px-3 py-4">
                    <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${
                      isCompleted
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-300'
                    }`}>
                      {String(order.status || 'processing')}
                    </span>
                  </td>
                  <td className="px-3 py-4 text-slate-400">{new Date(String(order.created_at)).toLocaleString('vi-VN')}</td>
                  <td className="px-3 py-4">
                    <div className="flex min-w-[270px] flex-wrap gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link href={buildConversationHref(order)}>
                          <MessageSquareText className="mr-1 h-4 w-4" />
                          Chat bàn giao
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => markCompleted(Number(order.id || 0))}
                        loading={isPending}
                        disabled={isCompleted}
                      >
                        <BadgeCheck className="mr-1 h-4 w-4" />
                        {isCompleted ? 'Đã bàn giao' : 'Xác nhận đã giao'}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
