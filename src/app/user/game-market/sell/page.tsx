import Link from 'next/link';
import { ArrowLeft, ExternalLink, ShieldCheck, WandSparkles } from 'lucide-react';
import { GameMarketItemForm } from '@/components/game-market/game-market-item-form';
import { AppShell } from '@/components/layout/app-shell';
import { getGameExchangeSellerAccess } from '@/lib/game-market-actions';
import { getGameMarketCategoryOptions } from '@/lib/game-market-config';
import { GAME_MARKET_PLATFORM_FEE } from '@/lib/game-market-pricing';
import { formatCurrency } from '@/lib/utils';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

const ADMIN_ZALO_QR_SRC = '/assets/zalo-admin-qr.png';

export default async function SellGameMarketPage() {
  const { raw, shell } = await getCurrentUserForShell();
  const sellerAccess = await getGameExchangeSellerAccess(raw.id);
  const categoryOptions = getGameMarketCategoryOptions();

  return (
    <AppShell user={shell}>
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/user/game-market" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-brand-blue">
          <ArrowLeft className="h-4 w-4" />
          Quay lại trao đổi game
        </Link>

        {!sellerAccess.canPost ? (
          <section className="rounded-[2rem] border border-amber-500/20 bg-amber-500/10 p-7 shadow-sm">
            <ShieldCheck className="h-8 w-8 text-amber-500" />
            <h1 className="mt-4 text-3xl font-black uppercase tracking-[-0.04em] text-slate-950 dark:text-white">Chưa được cấp quyền đăng bài</h1>
            <p className="mt-3 text-sm font-semibold leading-7 text-amber-700 dark:text-amber-300">
              Khu trao đổi game chỉ cho phép tài khoản đã được owner/admin cấp quyền đăng bài. Bạn vẫn có thể xem bài và liên hệ người đăng hoặc Admin Zalo để được hỗ trợ giao dịch.
            </p>
            <a href={ADMIN_ZALO_QR_SRC} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-blue px-4 py-2 text-xs font-black uppercase text-white">
              <ExternalLink className="h-4 w-4" />
              Liên hệ Admin Zalo
            </a>
          </section>
        ) : (
        <section className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <WandSparkles className="h-8 w-8 text-brand-blue" />
          <h1 className="mt-4 text-3xl font-black uppercase tracking-[-0.04em] text-slate-950 dark:text-white">Đăng bài trao đổi game</h1>
          <p className="mt-3 text-sm font-semibold leading-7 text-slate-500 dark:text-slate-400">
            Tạo bài trao đổi theo từng danh mục game như Liên Quân Mobile, PUBG Mobile, Valorant... Bài hợp lệ sẽ hiển thị công khai ngay; admin/owner vẫn có thể kiểm soát, chỉnh sửa, xóa hoặc ghim khi cần.
          </p>

          <div className="mt-5 rounded-[1.5rem] border border-emerald-500/20 bg-emerald-500/10 p-4">
            <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
              Quyền đăng bài
            </div>
            <p className="mt-3 text-sm font-semibold leading-7 text-emerald-700 dark:text-emerald-300">
              Tài khoản của bạn đã được cấp quyền đăng bài trao đổi. Sau khi lưu, bài sẽ hiển thị ngay ở trạng thái <span className="font-black">đang trao đổi</span>.
            </p>
          </div>

          <div className="mt-4 rounded-[1.5rem] border border-amber-500/20 bg-amber-500/10 p-4">
            <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-amber-600 dark:text-amber-400">
              <ShieldCheck className="h-4 w-4" />
              Tiền sàn tự động
            </div>
            <p className="mt-3 text-sm font-semibold leading-7 text-amber-700 dark:text-amber-300">
              Khi đăng bài mới, hệ thống tự cộng <span className="font-black">{formatCurrency(GAME_MARKET_PLATFORM_FEE)}</span> vào giá bạn nhập để làm tiền sàn. Popup xác nhận sẽ hiện ngay sau khi gửi bài.
            </p>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr]">
            <div className="space-y-3">
              {['1. Chọn game', '2. Giá & số lượng', '3. Mô tả account', '4. Hiển thị công khai'].map((step) => (
                <div key={step} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
                  {step}
                </div>
              ))}
            </div>

            <GameMarketItemForm
              endpoint="/api/game-market/item"
              submitLabel="Đăng bài trao đổi"
              categoryOptions={categoryOptions}
            />
          </div>
        </section>
        )}
      </div>
    </AppShell>
  );
}
