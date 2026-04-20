import Link from 'next/link';
import { ArrowLeft, WandSparkles } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { LegacyActionForm } from '@/components/legacy/action-form';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

export default async function SellGameMarketPage() {
  const { shell } = await getCurrentUserForShell();

  return (
    <AppShell user={shell}>
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/user/game-market" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-brand-blue">
          <ArrowLeft className="h-4 w-4" />
          Quay lại chợ game
        </Link>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <WandSparkles className="h-8 w-8 text-brand-blue" />
          <h1 className="mt-4 text-3xl font-black uppercase tracking-[-0.04em] text-slate-950 dark:text-white">Wizard thêm sản phẩm</h1>
          <p className="mt-3 text-sm font-semibold leading-7 text-slate-500 dark:text-slate-400">
            Tạo listing mới cho game-market. Hỗ trợ badge, pin, thông số account, images/features và phương thức giao hàng.
          </p>

          <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr]">
            <div className="space-y-3">
              {['1. Định danh', '2. Giá & kho', '3. Hiển thị', '4. Delivery'].map((step) => (
                <div key={step} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
                  {step}
                </div>
              ))}
            </div>

            <LegacyActionForm
              endpoint="/api/game-market/item"
              submitLabel="Đăng sản phẩm"
              redirectTo={(payload) => `/user/game-market/${String((payload.data as Record<string, unknown>)?.id || '')}`}
              fields={[
                { name: 'title', label: 'Tên sản phẩm', required: true },
                { name: 'category', label: 'Danh mục', required: true },
                { name: 'tag', label: 'Tag' },
                { name: 'badge', label: 'Badge' },
                { name: 'badge_color', label: 'Màu badge' },
                { name: 'price', label: 'Giá bán', type: 'number', required: true },
                { name: 'stock', label: 'Số lượng', type: 'number', required: true },
                { name: 'prep_time', label: 'Thời gian chuẩn bị' },
                { name: 'original_price', label: 'Giá gốc', type: 'number' },
                { name: 'thumbnail', label: 'Ảnh thumbnail (URL hoặc path)' },
                { name: 'description', label: 'Mô tả chi tiết', type: 'textarea', required: true },
                { name: 'images', label: 'Danh sách ảnh (mỗi dòng một link/path)', type: 'textarea' },
                { name: 'features', label: 'Tính năng nổi bật (mỗi dòng một ý)', type: 'textarea' },
                { name: 'rank', label: 'Rank account' },
                { name: 'skins', label: 'Skins' },
                { name: 'champs', label: 'Tướng / nhân vật' },
                { name: 'account_details', label: 'Dữ liệu giao hàng / thông tin account', type: 'textarea' },
                { name: 'delivery_method', label: 'Delivery method' },
              ]}
            />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
