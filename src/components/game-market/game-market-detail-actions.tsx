'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { MessageSquareText, Pin, ShoppingCart, Star, Trash2 } from 'lucide-react';
import { useConfirmDialog } from '@/components/ui/confirm-dialog-provider';
import { Button } from '@/components/ui/button';

type OrderRow = Record<string, unknown>;

interface GameMarketDetailActionsProps {
  itemId: number;
  itemPrice: number;
  sellerId: number;
  sellerUsername?: string;
  itemTitle?: string;
  isOwner: boolean;
  isPinned: boolean;
  status: string;
  orders: OrderRow[];
  gameBalance?: number;
}

function buildConversationHref(sellerId: number, itemId: number, compose: string, orderId?: number) {
  const params = new URLSearchParams({
    item: String(itemId),
    compose,
  });

  if (orderId) {
    params.set('order', String(orderId));
  }

  return `/user/social/conversation/${sellerId}?${params.toString()}`;
}

export function GameMarketDetailActions({
  itemId,
  itemPrice,
  sellerId,
  sellerUsername,
  itemTitle,
  isOwner,
  isPinned,
  status,
  orders,
  gameBalance = 0,
}: GameMarketDetailActionsProps) {
  const router = useRouter();
  const { confirm } = useConfirmDialog();
  const [isPending, startTransition] = useTransition();
  const [ratingValues, setRatingValues] = useState<Record<string, string>>({});
  const [reviewValues, setReviewValues] = useState<Record<string, string>>({});

  function openChat(compose: 'negotiate' | 'handover-buyer', orderId?: number) {
    if (!sellerId) {
      toast.error('Không tìm thấy người đăng bài để mở chat');
      return;
    }

    router.push(buildConversationHref(sellerId, itemId, compose, orderId));
  }

  function purchase() {
    startTransition(async () => {
      try {
        if (gameBalance < itemPrice) {
          const missingAmount = Math.max(0, itemPrice - gameBalance);
          const goDeposit = await confirm({
            title: 'Ví game không đủ',
            description: `Bạn cần nạp thêm ${new Intl.NumberFormat('vi-VN').format(missingAmount)}đ vào ví game để mua sản phẩm này.`,
            confirmText: 'Nạp ví game',
            cancelText: 'Để sau',
            tone: 'danger',
          });

          if (goDeposit) {
            router.push('/user/deposit?wallet=game');
          }
          return;
        }

        const accepted = await confirm({
          title: 'Lưu ý trước khi mua game',
          description: `Hãy chat với ${sellerUsername || 'người đăng bài'} trước để chốt tình trạng tài khoản, hình thức bàn giao và các thông tin cần thiết. Nếu bạn muốn giao dịch trung gian, nhớ liên hệ Admin trước khi mua để được hỗ trợ đứng giữa xác nhận. Sau khi mua xong, toàn bộ tài khoản, mật khẩu, mail hoặc dữ liệu liên quan nên được gửi qua chính đoạn chat này để dễ đối soát.`,
          confirmText: 'Đã hiểu, mua ngay',
          cancelText: 'Để tôi chat trước',
          tone: 'brand',
        });

        if (!accepted) {
          return;
        }

        const useGameWallet = await confirm({
          title: 'Thanh toán dịch vụ game',
          description: `Khu mua bán game dùng ví game riêng. Bạn có thể thanh toán bằng ví game hiện có (${new Intl.NumberFormat('vi-VN').format(gameBalance)}đ), hoặc liên hệ Admin để rút/chuyển tiền từ tài khoản chính sang ví game. Mỗi lần rút/chuyển từ tài khoản chính có phí 10%.`,
          confirmText: 'Sử dụng ví game',
          cancelText: 'Liên hệ admin',
          tone: 'brand',
        });

        if (!useGameWallet) {
          router.push('/user/support-tiktok');
          return;
        }

        const response = await fetch('/api/game-market/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_id: itemId }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.message || 'Không thể mua sản phẩm');
        }
        toast.success('Đã mua sản phẩm, đang mở chat để bạn nhận bàn giao');
        openChat('handover-buyer', Number(payload.data?.orderId || 0));
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
        <div className={`rounded-2xl border px-4 py-4 text-sm font-semibold leading-7 ${
          status === 'pending' || status === 'hidden'
            ? 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'
            : status === 'rejected'
              ? 'border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300'
              : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
        }`}>
          {status === 'pending' || status === 'hidden'
            ? 'Bài đăng này hiện chưa công khai. Tùy cấu trúc DB hiện tại, nó có thể đang chờ admin duyệt hoặc đang được ẩn khỏi chợ game.'
            : status === 'rejected'
              ? 'Bài đăng này đã bị từ chối. Hãy chỉnh sửa lại nội dung rồi gửi lại để admin duyệt.'
              : 'Bài đăng này đang ở trạng thái hiển thị công khai và có thể tiếp tục ghim hoặc chỉnh sửa.'}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => itemAction(isPinned ? 'unpin' : 'pin')} loading={isPending} disabled={status !== 'selling'}>
            <Pin className="mr-1 h-4 w-4" />
            {isPinned ? 'Bỏ ghim' : 'Ghim 7 ngày'}
          </Button>
          <Button variant="outline" onClick={() => itemAction('hide')} loading={isPending}>
            <Trash2 className="mr-1 h-4 w-4" />
            Ẩn sản phẩm
          </Button>
          <Button asChild>
            <a href={`/user/game-market/edit/${itemId}`}>Sửa nội dung & giá</a>
          </Button>
        </div>
        <div className="text-sm font-semibold leading-7 text-slate-500 dark:text-slate-400">
          Đây là bài đăng của bạn. Bạn có thể chỉnh sửa nội dung, giá bán, ẩn hoặc ghim bài sau khi đã được admin duyệt.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => openChat('negotiate')} disabled={!sellerId}>
            <MessageSquareText className="mr-2 h-4 w-4" />
            Chat với người đăng
          </Button>
          <Button loading={isPending} onClick={purchase}>
            <ShoppingCart className="mr-2 h-4 w-4" />
            Mua bằng ví game
          </Button>
        </div>
        <div className="rounded-2xl border border-brand-blue/15 bg-brand-blue/5 px-4 py-3 text-sm font-semibold leading-7 text-slate-600 dark:border-brand-blue/20 dark:bg-brand-blue/10 dark:text-slate-300">
          Bạn nên chat trước để thương lượng và xác nhận tình trạng account. Nếu cần giao dịch trung gian, hãy liên hệ Admin trước khi mua. Sau khi mua xong, seller sẽ bàn giao tài khoản, mật khẩu và thông tin liên quan ngay trong đoạn chat này.
        </div>
      </div>

      {orders.length > 0 ? (
        <div className="space-y-3">
          <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Đơn đã mua và kênh bàn giao</div>
          {orders.map((order) => (
            <div key={String(order.id)} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-black uppercase tracking-[-0.03em] text-slate-950 dark:text-white">
                  Order #{String(order.id)} · {String(order.status)}
                </div>
                <Button size="sm" variant="outline" onClick={() => openChat('handover-buyer', Number(order.id || 0))}>
                  <MessageSquareText className="mr-1 h-4 w-4" />
                  Mở chat bàn giao
                </Button>
              </div>
              {String(order.status || '').toLowerCase() !== 'completed' ? (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm font-semibold leading-7 text-amber-700 dark:text-amber-300">
                  Đơn này đang chờ seller bàn giao. Hãy theo dõi và trao đổi trực tiếp trong chat để nhận tài khoản, mật khẩu, mail hoặc thông tin đăng nhập đầy đủ.
                </div>
              ) : (
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
                    placeholder={`Cảm nhận sau khi nhận ${itemTitle || 'account/game'}...`}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold leading-7 outline-none dark:border-white/10 dark:bg-slate-950/40 dark:text-white"
                  />
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" loading={isPending} onClick={() => rate(Number(order.id))}>
                      <Star className="mr-1 h-4 w-4" />
                      Gửi rating
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
