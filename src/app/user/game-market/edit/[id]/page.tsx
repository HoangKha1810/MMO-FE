import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, FilePenLine, ShieldCheck } from 'lucide-react';
import { GameMarketItemForm } from '@/components/game-market/game-market-item-form';
import { AppShell } from '@/components/layout/app-shell';
import { getGameMarketDetail } from '@/lib/game-market-actions';
import { getGameMarketCategoryOptions } from '@/lib/game-market-config';
import { collectGameMarketImageRefs } from '@/lib/game-market-media';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

function joinList(value: unknown) {
  if (!value) {
    return '';
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.join('\n');
      }
    } catch {
      return value;
    }
  }
  return '';
}

export default async function EditGameMarketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isFinite(itemId) || itemId <= 0) notFound();

  const { raw, shell } = await getCurrentUserForShell();
  const data = await getGameMarketDetail(itemId, raw.id);
  if (!data || Number(data.item.seller_id) !== raw.id) notFound();

  const item = data.item as Record<string, unknown>;
  const categoryOptions = getGameMarketCategoryOptions();

  return (
    <AppShell user={shell}>
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href={`/user/game-market/${itemId}`} className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-brand-blue">
          <ArrowLeft className="h-4 w-4" />
          Quay lại sản phẩm
        </Link>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm dark:border-white/10 dark:bg-slate-900">
          <FilePenLine className="h-8 w-8 text-brand-blue" />
          <h1 className="mt-4 text-3xl font-black uppercase tracking-[-0.04em] text-slate-950 dark:text-white">Sửa sản phẩm game-market</h1>
          <div className="mt-5 rounded-[1.5rem] border border-amber-500/20 bg-amber-500/10 p-4">
            <div className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-amber-600 dark:text-amber-400">
              <ShieldCheck className="h-4 w-4" />
              Lưu ý duyệt lại
            </div>
            <p className="mt-3 text-sm font-semibold leading-7 text-amber-700 dark:text-amber-300">
              Khi bạn cập nhật lại bài đăng, hệ thống sẽ chuyển bài về trạng thái <span className="font-black">chờ admin duyệt lại</span> để nội dung mới được kiểm tra trước khi hiển thị công khai.
            </p>
          </div>
          <div className="mt-6">
            <GameMarketItemForm
              endpoint="/api/game-market/item"
              submitLabel="Lưu thay đổi"
              redirectTo={`/user/game-market/${itemId}`}
              categoryOptions={categoryOptions}
              defaults={{
                action: 'update',
                itemId,
                title: String(item.title || ''),
                category: String(item.category || ''),
                tag: String(item.tag || ''),
                badge: String(item.badge || ''),
                badgeColor: String(item.badge_color || ''),
                price: String(item.price || ''),
                stock: String(item.stock || 1),
                prepTime: String(item.prep_time || ''),
                originalPrice: String(item.original_price || ''),
                description: String(item.description || ''),
                existingImages: collectGameMarketImageRefs({
                  thumbnail: item.thumbnail,
                  images: item.images,
                }),
                features: joinList(item.features),
                rank: String(item.rank || ''),
                skins: String(item.skins || ''),
                champs: String(item.champs || ''),
                accountDetails: String(item.account_details || ''),
                deliveryMethod: String(item.delivery_method || ''),
              }}
            />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
