import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, FilePenLine } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { LegacyActionForm } from '@/components/legacy/action-form';
import { getGameMarketDetail } from '@/lib/game-market-actions';
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
          <div className="mt-6">
            <LegacyActionForm
              endpoint="/api/game-market/item"
              submitLabel="Lưu thay đổi"
              redirectTo={() => `/user/game-market/${itemId}`}
              defaults={{
                action: 'update',
                item_id: itemId,
                title: String(item.title || ''),
                category: String(item.category || ''),
                tag: String(item.tag || ''),
                badge: String(item.badge || ''),
                badge_color: String(item.badge_color || ''),
                price: Number(item.price || 0),
                stock: Number(item.stock || 1),
                prep_time: String(item.prep_time || ''),
                original_price: Number(item.original_price || 0) || '',
                thumbnail: String(item.thumbnail || ''),
                description: String(item.description || ''),
                images: joinList(item.images),
                features: joinList(item.features),
                rank: String(item.rank || ''),
                skins: String(item.skins || ''),
                champs: String(item.champs || ''),
                account_details: String(item.account_details || ''),
                delivery_method: String(item.delivery_method || ''),
              }}
              fields={[
                { name: 'action', label: 'Action', hidden: true, required: true },
                { name: 'item_id', label: 'Item ID', type: 'number', hidden: true, required: true },
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
