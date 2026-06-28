'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Download, MessageSquareQuote, ShoppingCart, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConfirmDialog } from '@/components/ui/confirm-dialog-provider';

type ReviewRow = Record<string, unknown>;
type OrderRow = Record<string, unknown>;

interface ResourceDetailActionsProps {
  resourceId: number;
  price: number;
  vatPercent?: number;
  stock: number;
  orders: OrderRow[];
  reviews: ReviewRow[];
  paymentWallet?: 'main' | 'game';
  gameBalance?: number;
  resourceTitle?: string;
  resourceCategory?: string;
  resourceTags?: string;
  historyHref?: string;
  purchaseErrorLabel?: string;
}

const FREE_FIRE_LOGIN_GUIDE_TEXT = `Huong dan dang nhap Free Fire

Cach 1 ios/adr ( Ti le 50% , TuT cu tuy acc duoc ) Link Video:
https://drive.google.com/file/d/1dh82ZehjelPCqTXlypAQFMadQ_BauebA/view?usp=drivesdk

Cach 2 ios/adr ( 30% - 80 % ):
Su dung 2 may cung dung mot mang 4g ( May nay phat mang cho may kia - ip phat mang cho adr hoac nguoc lai ) roi cung log 1 luc

Cach 3 TuT new ti le cao:
https://drive.google.com/file/d/103Z2ktErtSQrh_QcT9ZU5hv2W7p9sYSU/view?usp=drive_link
(Voi may khong co 2 sim thi dung 2 may 1 may phat mang 4g cho may kia r lam theo c2 hoac video
Voi adr lam tuong tu nhu tren neu khong co 2 sim)

Cach 4 ( New ):
B1: log acc cp vao 3 tab fb.com ( Tab la may cai the tren gg a )
B2: bat tab limited.facebook.com duc tao tk moi nhap y si thong tin cua acc cp (giong cach 1) neu no load ra cp la duc duoc con no dung im la da bi duc tach
Video minh hoa:
https://drive.google.com/file/d/1vnKgNdSXaIynZm38SuiGvFhWknXyfBwv/view?usp=drive_link
`;

function normalizeText(input: string) {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function ResourceDetailActions({
  resourceId,
  price,
  vatPercent = 8,
  stock,
  orders,
  reviews,
  paymentWallet = 'main',
  gameBalance = 0,
  resourceTitle = '',
  resourceCategory = '',
  resourceTags = '',
  historyHref = '/user/resources/history',
  purchaseErrorLabel = 'Không thể mua tài nguyên',
}: ResourceDetailActionsProps) {
  const router = useRouter();
  const { confirm } = useConfirmDialog();
  const [isPending, startTransition] = useTransition();
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [quantity, setQuantity] = useState('1');
  const [rating, setRating] = useState('5');
  const [comment, setComment] = useState('');
  const [showFreeFireGuide, setShowFreeFireGuide] = useState(false);

  const resourceSearchText = normalizeText(`${resourceTitle} ${resourceCategory} ${resourceTags}`);
  const shouldShowFreeFireGuide =
    resourceSearchText.includes('free fire') &&
    (resourceSearchText.includes('random') || resourceSearchText.includes('acc') || resourceSearchText.includes('tai khoan'));

  function downloadFreeFireGuideTxt() {
    const blob = new Blob([FREE_FIRE_LOGIN_GUIDE_TEXT], { type: 'text/plain;charset=utf-8' });
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = 'huong-dan-dang-nhap-free-fire.txt';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(downloadUrl);
  }

  async function purchase() {
    const requestedQuantity = Math.max(1, Math.min(10, Math.trunc(Number(quantity || 1))));
    const totalPrice = Math.max(0, Math.round(price * requestedQuantity * (1 + vatPercent / 100)));

    try {
      if (paymentWallet === 'game') {
        if (gameBalance < totalPrice) {
          const missingAmount = Math.max(0, totalPrice - gameBalance);
          const goDeposit = await confirm({
            title: 'Cần nạp thêm ví game',
            description: `Đơn này cần ${new Intl.NumberFormat('vi-VN').format(totalPrice)}đ. Ví game hiện có ${new Intl.NumberFormat('vi-VN').format(gameBalance)}đ, còn thiếu ${new Intl.NumberFormat('vi-VN').format(missingAmount)}đ để hoàn tất thanh toán.`,
            confirmText: 'Nạp ví game',
            cancelText: 'Để sau',
            tone: 'payment',
          });

          if (goDeposit) {
            router.push('/user/deposit?wallet=game');
          }
          return;
        }

        const useGameWallet = await confirm({
          title: 'Xác nhận thanh toán ví game',
          description: `Bạn sẽ thanh toán ${new Intl.NumberFormat('vi-VN').format(totalPrice)}đ bằng ví game. Số dư hiện tại: ${new Intl.NumberFormat('vi-VN').format(gameBalance)}đ. Sau khi mua thành công, đơn sẽ xuất hiện trong lịch sử tải.`,
          confirmText: 'Sử dụng ví game',
          cancelText: 'Liên hệ admin',
          tone: 'payment',
        });

        if (!useGameWallet) {
          window.location.href = '/user/support-tiktok';
          return;
        }
      }

      setPurchaseLoading(true);
      const response = await fetch('/api/resources/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource_id: resourceId, quantity: requestedQuantity }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || purchaseErrorLabel);
      }
      toast.success(payload.message || 'Mua thành công');
      if (shouldShowFreeFireGuide) {
        setShowFreeFireGuide(true);
      }
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : purchaseErrorLabel);
    } finally {
      setPurchaseLoading(false);
    }
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
          <Button disabled={stock <= 0 || purchaseLoading} loading={purchaseLoading} onClick={purchase}>
            <ShoppingCart className="mr-2 h-4 w-4" />
            {paymentWallet === 'game' ? 'Mua bằng ví game' : 'Mua bằng số dư'}
          </Button>
          <Button variant="outline" asChild>
            <a href={historyHref}>
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

      {showFreeFireGuide ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-brand-blue">
                  Huong dan dang nhap Free Fire
                </div>
                <h3 className="mt-1 text-lg font-black text-slate-950 dark:text-white">
                  Cach dang nhap sau khi mua acc/random Free Fire
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFreeFireGuide(false)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-rose-500 dark:border-white/10"
              >
                Dong
              </button>
            </div>

            <div className="mt-4 max-h-[56vh] space-y-3 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-700 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-300">
              <p>
                <strong>Cach 1 ios/adr (Ti le 50%, TuT cu tuy acc duoc):</strong><br />
                <a className="text-brand-blue underline" href="https://drive.google.com/file/d/1dh82ZehjelPCqTXlypAQFMadQ_BauebA/view?usp=drivesdk" target="_blank" rel="noreferrer">
                  Xem video huong dan
                </a>
              </p>
              <p>
                <strong>Cach 2 ios/adr (30% - 80%):</strong><br />
                Su dung 2 may cung dung mot mang 4g (mot may phat mang cho may kia), sau do dang nhap cung luc.
              </p>
              <p>
                <strong>Cach 3 TuT new ti le cao:</strong><br />
                <a className="text-brand-blue underline" href="https://drive.google.com/file/d/103Z2ktErtSQrh_QcT9ZU5hv2W7p9sYSU/view?usp=drive_link" target="_blank" rel="noreferrer">
                  Xem video huong dan
                </a><br />
                Neu may khong co 2 sim thi dung 2 may (1 may phat 4g cho may kia) va lam theo cach 2/video.
              </p>
              <p>
                <strong>Cach 4 (New):</strong><br />
                B1: Dang nhap acc CP vao 3 tab <code>fb.com</code>.<br />
                B2: Mo tab <code>limited.facebook.com</code>, tao tai khoan moi va nhap dung thong tin acc CP (giong cach 1).<br />
                Neu load ra CP la thanh cong, neu dung im la that bai.<br />
                <a className="text-brand-blue underline" href="https://drive.google.com/file/d/1vnKgNdSXaIynZm38SuiGvFhWknXyfBwv/view?usp=drive_link" target="_blank" rel="noreferrer">
                  Xem video minh hoa
                </a>
              </p>
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={downloadFreeFireGuideTxt}>
                <Download className="mr-2 h-4 w-4" />
                Download txt cach dang nhap
              </Button>
              <Button onClick={() => setShowFreeFireGuide(false)}>Da hieu</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
