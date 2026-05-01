import Link from 'next/link';
import { ArrowLeft, ShieldCheck, WandSparkles } from 'lucide-react';
import { GameMarketItemForm } from '@/components/game-market/game-market-item-form';
import { AppShell } from '@/components/layout/app-shell';
import { getGameMarketCategoryOptions } from '@/lib/game-market-config';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

export default async function SellGameMarketPage() {
  const { shell } = await getCurrentUserForShell();
  const categoryOptions = getGameMarketCategoryOptions();

  return (
    <AppShell user={shell}>
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/user/game-market" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-brand-blue">
          <ArrowLeft className="h-4 w-4" />
          Quay lại chợ game
        </Link>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <WandSparkles className="h-8 w-8 text-brand-blue" />
          <h1 className="mt-4 text-3xl font-black uppercase tracking-[-0.04em] text-slate-950 dark:text-white">Đăng bài mua bán game</h1>
          <p className="mt-3 text-sm font-semibold leading-7 text-slate-500 dark:text-slate-400">
            Tạo bài đăng theo từng danh mục game như Liên Quân Mobile, PUBG Mobile, Valorant... Bài mới sẽ được chuyển vào hàng chờ và chỉ hiển thị ngoài chợ game sau khi admin duyệt.
          </p>

          <div className="mt-5 rounded-[1.5rem] border border-emerald-500/20 bg-emerald-500/10 p-4">
            <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
              Quy trình duyệt bài
            </div>
            <p className="mt-3 text-sm font-semibold leading-7 text-emerald-700 dark:text-emerald-300">
              Sau khi gửi bài, trạng thái sẽ là <span className="font-black">chờ duyệt</span>. Bạn vẫn có thể sửa lại nội dung, nhưng bài chỉ xuất hiện công khai khi admin chuyển sang trạng thái đã duyệt.
            </p>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr]">
            <div className="space-y-3">
              {['1. Chọn game', '2. Giá & kho', '3. Mô tả account', '4. Chờ admin duyệt'].map((step) => (
                <div key={step} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
                  {step}
                </div>
              ))}
            </div>

            <GameMarketItemForm
              endpoint="/api/game-market/item"
              submitLabel="Đăng sản phẩm"
              categoryOptions={categoryOptions}
            />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
