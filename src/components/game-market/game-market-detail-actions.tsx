'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ExternalLink, MessageSquareText, QrCode, ShoppingCart, Star, Trash2 } from 'lucide-react';
import { useConfirmDialog } from '@/components/ui/confirm-dialog-provider';
import { Button } from '@/components/ui/button';

type OrderRow = Record<string, unknown>;
const ADMIN_ZALO_QR_SRC = '/assets/zalo-admin-qr.png';

interface GameMarketDetailActionsProps {
  itemId: number;
  itemPrice: number;
  sellerId: number;
  sellerUsername?: string;
  itemTitle?: string;
  isOwner: boolean;
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
            title: 'Cần nạp thêm ví game',
            description: `Bài trao đổi này cần ${new Intl.NumberFormat('vi-VN').format(itemPrice)}đ. Ví game hiện có ${new Intl.NumberFormat('vi-VN').format(gameBalance)}đ, còn thiếu ${new Intl.NumberFormat('vi-VN').format(missingAmount)}đ để tạo đơn trao đổi.`,
            confirmText: 'Nạp ví game',
            cancelText: 'Để sau',
            tone: 'payment',
          });

          if (goDeposit) {
            router.push('/user/deposit?wallet=game');
          }
          return;
        }

        const accepted = await confirm({
          title: 'Lưu ý trước khi trao đổi game',
          description: `Hãy chat với ${sellerUsername || 'người đăng bài'} trước để chốt tình trạng tài khoản, hình thức bàn giao và các thông tin cần thiết. Nếu bạn muốn giao dịch trung gian, hãy liên hệ Admin Zalo trước khi tạo đơn để được hỗ trợ đứng giữa xác nhận. Sau khi tạo đơn, toàn bộ tài khoản, mật khẩu, mail hoặc dữ liệu liên quan nên được gửi qua chính đoạn chat này để dễ đối soát.`,
          confirmText: 'Đã hiểu, tạo đơn',
          cancelText: 'Để tôi chat trước',
          tone: 'payment',
        });

        if (!accepted) {
          return;
        }

        const useGameWallet = await confirm({
          title: 'Xác nhận thanh toán ví game',
          description: `Bạn sẽ thanh toán ${new Intl.NumberFormat('vi-VN').format(itemPrice)}đ bằng ví game để tạo đơn trao đổi. Số dư hiện tại: ${new Intl.NumberFormat('vi-VN').format(gameBalance)}đ. Sau khi tạo đơn, hệ thống sẽ mở chat bàn giao với người đăng.`,
          confirmText: 'Tạo đơn bằng ví game',
          cancelText: 'Liên hệ Admin Zalo',
          cancelHref: ADMIN_ZALO_QR_SRC,
          tone: 'payment',
        });

        if (!useGameWallet) {
          return;
        }

        const response = await fetch('/api/game-market/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ item_id: itemId }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.message || 'Không thể tạo đơn trao đổi');
        }
        toast.success('Đã tạo đơn trao đổi, đang mở chat để bạn nhận bàn giao');
        openChat('handover-buyer', Number(payload.data?.orderId || 0));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Không thể tạo đơn trao đổi');
      }
    });
  }

  function itemAction(action: 'pin' | 'unpin' | 'hide' | 'delete') {
    startTransition(async () => {
      try {
        const response = await fetch('/api/game-market/item', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, item_id: itemId }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.message || 'Không thể cập nhật bài trao đổi');
        }
        toast.success(payload.message || 'Đã cập nhật bài trao đổi');
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Không thể cập nhật bài trao đổi');
      }
    });
  }

  async function deleteOwnItem() {
    const accepted = await confirm({
      title: 'Xóa bài trao đổi?',
      description: 'Bài này sẽ bị gỡ khỏi khu trao đổi game. Lịch sử đơn và chat cũ vẫn được giữ lại để đối soát khi cần.',
      confirmText: 'Xóa bài',
      cancelText: 'Hủy',
      tone: 'payment',
    });

    if (accepted) {
      itemAction('delete');
    }
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
            ? 'Bài trao đổi này chưa công khai hoặc đang được ẩn khỏi khu trao đổi game.'
            : status === 'rejected'
              ? 'Bài trao đổi này đã bị từ chối.'
              : 'Bài trao đổi này đang hiển thị công khai.'}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => itemAction('hide')} loading={isPending}>
            <Trash2 className="mr-1 h-4 w-4" />
            Ẩn bài trao đổi
          </Button>
          <Button variant="outline" onClick={deleteOwnItem} loading={isPending}>
            <Trash2 className="mr-1 h-4 w-4" />
            Xóa bài trao đổi
          </Button>
          <Button asChild>
            <a href={`/user/game-market/edit/${itemId}`}>Sửa nội dung & giá</a>
          </Button>
        </div>
        <div className="text-sm font-semibold leading-7 text-slate-500 dark:text-slate-400">
          Đây là bài trao đổi của bạn. Bạn có thể chỉnh sửa nội dung, giá trao đổi, ẩn hoặc xóa bài. Ghim và kiểm soát nâng cao do admin/owner xử lý ở trang quản trị.
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
            Tạo đơn trao đổi
          </Button>
          <Button asChild variant="outline">
            <a href={ADMIN_ZALO_QR_SRC} target="_blank" rel="noreferrer">
              <QrCode className="mr-2 h-4 w-4" />
              Liên hệ Admin Zalo
            </a>
          </Button>
        </div>
        <div className="rounded-2xl border border-brand-blue/15 bg-brand-blue/5 px-4 py-3 text-sm font-semibold leading-7 text-slate-600 dark:border-brand-blue/20 dark:bg-brand-blue/10 dark:text-slate-300">
          Bạn nên chat trước để thương lượng và xác nhận tình trạng account. Nếu cần giao dịch trung gian, hãy liên hệ Admin Zalo trước khi tạo đơn. Sau khi tạo đơn, người đăng sẽ bàn giao tài khoản, mật khẩu và thông tin liên quan ngay trong đoạn chat này.
        </div>
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
          <div className="flex flex-wrap items-center gap-4">
            <img src={ADMIN_ZALO_QR_SRC} alt="QR Zalo admin" className="h-24 w-24 rounded-xl border border-white/20 object-cover" />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-500">Admin Zalo</div>
              <p className="mt-2 text-sm font-semibold leading-7 text-slate-600 dark:text-slate-300">
                Quét QR hoặc mở ảnh QR ở tab mới để hỏi admin về trung gian, xác minh và hỗ trợ giao dịch.
              </p>
              <a href={ADMIN_ZALO_QR_SRC} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 text-xs font-black uppercase text-brand-blue">
                Mở QR Zalo <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {orders.length > 0 ? (
        <div className="space-y-3">
          <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Đơn trao đổi và kênh bàn giao</div>
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
                  Đơn này đang chờ người đăng bàn giao. Hãy theo dõi và trao đổi trực tiếp trong chat để nhận tài khoản, mật khẩu, mail hoặc thông tin đăng nhập đầy đủ.
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
