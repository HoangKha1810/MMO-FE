'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, Send, Trash2, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { startPageTransition } from '@/components/layout/navigation-effects';
import { Button } from '@/components/ui/button';
import { useConfirmDialog } from '@/components/ui/confirm-dialog-provider';
import { Input } from '@/components/ui/input';
import { GAME_MARKET_PLATFORM_FEE, getGameMarketListedPrice } from '@/lib/game-market-pricing';
import { buildPublicAssetUrl } from '@/lib/public-asset-url';
import { formatCurrency, toNumber } from '@/lib/utils';

interface GameMarketCategoryOption {
  label: string;
  value: string;
}

interface GameMarketItemFormValues {
  action: 'create' | 'update';
  itemId?: number;
  title: string;
  category: string;
  tag: string;
  badge: string;
  badgeColor: string;
  price: string;
  stock: string;
  prepTime: string;
  originalPrice: string;
  description: string;
  features: string;
  rank: string;
  skins: string;
  champs: string;
  accountDetails: string;
  deliveryMethod: string;
  existingImages: string[];
}

interface GameMarketItemFormProps {
  endpoint: string;
  submitLabel: string;
  redirectTo?: string;
  categoryOptions: GameMarketCategoryOption[];
  defaults?: Partial<GameMarketItemFormValues>;
}

const textareaClassName =
  'w-full rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold leading-7 text-slate-900 outline-none transition focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10 dark:border-white/10 dark:bg-white/5 dark:text-white';

function normalizeDefaults(defaults?: Partial<GameMarketItemFormValues>): GameMarketItemFormValues {
  return {
    action: defaults?.action || 'create',
    itemId: defaults?.itemId,
    title: String(defaults?.title || ''),
    category: String(defaults?.category || ''),
    tag: String(defaults?.tag || ''),
    badge: String(defaults?.badge || ''),
    badgeColor: String(defaults?.badgeColor || ''),
    price: String(defaults?.price || ''),
    stock: String(defaults?.stock || '1'),
    prepTime: String(defaults?.prepTime || ''),
    originalPrice: String(defaults?.originalPrice || ''),
    description: String(defaults?.description || ''),
    features: String(defaults?.features || ''),
    rank: String(defaults?.rank || ''),
    skins: String(defaults?.skins || ''),
    champs: String(defaults?.champs || ''),
    accountDetails: String(defaults?.accountDetails || ''),
    deliveryMethod: String(defaults?.deliveryMethod || 'manual'),
    existingImages: Array.isArray(defaults?.existingImages) ? defaults.existingImages.filter(Boolean) : [],
  };
}

export function GameMarketItemForm({
  endpoint,
  submitLabel,
  redirectTo,
  categoryOptions,
  defaults,
}: GameMarketItemFormProps) {
  const router = useRouter();
  const { alert } = useConfirmDialog();
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState<GameMarketItemFormValues>(() => normalizeDefaults(defaults));
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newPreviewUrls, setNewPreviewUrls] = useState<string[]>([]);

  useEffect(() => {
    setValues(normalizeDefaults(defaults));
    setNewFiles([]);
  }, [defaults]);

  useEffect(() => {
    const urls = newFiles.map((file) => URL.createObjectURL(file));
    setNewPreviewUrls(urls);

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [newFiles]);

  const resolvedExistingImages = useMemo(
    () => values.existingImages.map((item) => buildPublicAssetUrl(item) || item),
    [values.existingImages]
  );

  function updateField<Key extends keyof GameMarketItemFormValues>(key: Key, value: GameMarketItemFormValues[Key]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function addFiles(list: FileList | null) {
    if (!list?.length) {
      return;
    }

    setNewFiles((current) => {
      const remainingSlots = Math.max(0, 3 - values.existingImages.length - current.length);
      if (remainingSlots <= 0) {
        toast.error('Mỗi bài đăng chỉ được tối đa 3 ảnh');
        return current;
      }

      const accepted = Array.from(list)
        .filter((file) => file.size > 0)
        .slice(0, remainingSlots);

      if (!accepted.length) {
        toast.error('Bạn đã dùng hết số lượng ảnh cho phép');
        return current;
      }

      if (accepted.length < list.length) {
        toast.error('Chỉ lấy tối đa 3 ảnh cho bài đăng này');
      }

      return [...current, ...accepted];
    });
  }

  function removeExistingImage(index: number) {
    updateField('existingImages', values.existingImages.filter((_, itemIndex) => itemIndex !== index));
  }

  function removeNewImage(index: number) {
    setNewFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const payload = new FormData();
      payload.append('action', values.action);

      if (values.itemId) {
        payload.append('item_id', String(values.itemId));
      }

      payload.append('title', values.title);
      payload.append('category', values.category);
      payload.append('tag', values.tag);
      payload.append('badge', values.badge);
      payload.append('badge_color', values.badgeColor);
      payload.append('price', values.price);
      payload.append('stock', values.stock);
      payload.append('prep_time', values.prepTime);
      payload.append('original_price', values.originalPrice);
      payload.append('description', values.description);
      payload.append('features', values.features);
      payload.append('rank', values.rank);
      payload.append('skins', values.skins);
      payload.append('champs', values.champs);
      payload.append('account_details', values.accountDetails);
      payload.append('delivery_method', values.deliveryMethod);
      payload.append('existing_images', values.existingImages.join('\n'));

      newFiles.forEach((file) => payload.append('images', file));

      const response = await fetch(endpoint, {
        method: 'POST',
        body: payload,
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Không thể xử lý bài đăng');
      }

      toast.success(result.message || 'Đã xử lý bài đăng');

      if (values.action === 'create') {
        const resultData = (result.data || {}) as Record<string, unknown>;
        const sellerPrice = toNumber(resultData.sellerPrice, toNumber(values.price, 0));
        const listedPrice = toNumber(resultData.price, getGameMarketListedPrice(sellerPrice));

        await alert({
          title: 'Đã cộng tiền sàn',
          description: `Giá bạn nhập là ${formatCurrency(sellerPrice)}. Hệ thống đã tự cộng ${formatCurrency(GAME_MARKET_PLATFORM_FEE)} tiền sàn, giá hiển thị cho người xem là ${formatCurrency(listedPrice)}.`,
          confirmText: 'Đã hiểu',
          tone: 'brand',
        });
      }

      const nextItemId = Number((result.data as Record<string, unknown>)?.id || values.itemId || 0);

      if (redirectTo) {
        startPageTransition();
        router.push(redirectTo);
      } else if (nextItemId > 0) {
        startPageTransition();
        router.push(`/user/game-market/${nextItemId}`);
      } else {
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể xử lý bài đăng');
    } finally {
      setLoading(false);
    }
  }

  const totalImages = values.existingImages.length + newFiles.length;
  const sellerInputPrice = toNumber(values.price, 0);
  const listedPricePreview = sellerInputPrice > 0 ? getGameMarketListedPrice(sellerInputPrice) : 0;

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 md:col-span-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tên bài trao đổi</span>
          <Input value={values.title} onChange={(event) => updateField('title', event.target.value)} required />
        </label>

        <label className="space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Danh mục game</span>
          <select
            value={values.category}
            onChange={(event) => updateField('category', event.target.value)}
            required
            className="h-12 w-full rounded-[1rem] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10 dark:border-white/10 dark:bg-slate-900 dark:text-white"
          >
            <option value="">Chọn game...</option>
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {values.action === 'create' ? 'Giá người đăng nhập' : 'Giá trao đổi'}
          </span>
          <Input type="number" min={1000} value={values.price} onChange={(event) => updateField('price', event.target.value)} required />
        </label>

        {values.action === 'create' ? (
          <div className="rounded-[1.25rem] border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm font-semibold leading-7 text-amber-700 dark:text-amber-300 md:col-span-2">
            Hệ thống sẽ tự cộng <span className="font-black">{formatCurrency(GAME_MARKET_PLATFORM_FEE)}</span> tiền sàn khi đăng bài.
            Giá người xem thấy: <span className="font-black">{listedPricePreview > 0 ? formatCurrency(listedPricePreview) : 'nhập giá để xem'}</span>.
          </div>
        ) : null}

        <label className="space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Số lượng</span>
          <Input type="number" min={1} value={values.stock} onChange={(event) => updateField('stock', event.target.value)} required />
        </label>

        <label className="space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Thời gian chuẩn bị</span>
          <Input value={values.prepTime} onChange={(event) => updateField('prepTime', event.target.value)} placeholder="Ví dụ: 5-10 phút" />
        </label>

        <label className="space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Giá gốc</span>
          <Input type="number" min={0} value={values.originalPrice} onChange={(event) => updateField('originalPrice', event.target.value)} />
        </label>

        <label className="space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tag</span>
          <Input value={values.tag} onChange={(event) => updateField('tag', event.target.value)} placeholder="Ví dụ: Rank cao / Full skin" />
        </label>

        <label className="space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Badge</span>
          <Input value={values.badge} onChange={(event) => updateField('badge', event.target.value)} placeholder="Ví dụ: Hot deal" />
        </label>

        <label className="space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Màu badge</span>
          <Input value={values.badgeColor} onChange={(event) => updateField('badgeColor', event.target.value)} placeholder="#2563eb" />
        </label>

        <label className="space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Delivery method</span>
          <Input value={values.deliveryMethod} onChange={(event) => updateField('deliveryMethod', event.target.value)} placeholder="manual / auto" />
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mô tả chi tiết</span>
          <textarea
            value={values.description}
            onChange={(event) => updateField('description', event.target.value)}
            rows={7}
            required
            className={textareaClassName}
          />
        </label>

        <div className="space-y-3 md:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ảnh bài đăng</div>
              <div className="mt-1 text-sm font-semibold leading-7 text-slate-500 dark:text-slate-400">
                Tối đa 3 ảnh. Ảnh đầu tiên sẽ được dùng làm ảnh đại diện cho bài viết.
              </div>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:bg-white/10 dark:text-slate-300">
              {totalImages}/3 ảnh
            </div>
          </div>

          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-[1.35rem] border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm font-black text-slate-500 transition hover:border-brand-blue/35 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-300">
            <UploadCloud className="h-4 w-4" />
            Chọn ảnh từ máy
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={(event) => {
                addFiles(event.target.files);
                event.currentTarget.value = '';
              }}
            />
          </label>

          <div className="grid gap-3 md:grid-cols-3">
            {resolvedExistingImages.map((image, index) => (
              <div key={`existing-${values.existingImages[index]}`} className="overflow-hidden rounded-[1.35rem] border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-950/40">
                  <img src={image} alt={`Ảnh bài đăng ${index + 1}`} className="h-full w-full object-cover" />
                </div>
                <div className="flex items-center justify-between gap-2 p-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    {index === 0 ? 'Ảnh đại diện' : `Ảnh ${index + 1}`}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeExistingImage(index)}
                    className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Xóa
                  </button>
                </div>
              </div>
            ))}

            {newPreviewUrls.map((image, index) => (
              <div key={`new-${image}`} className="overflow-hidden rounded-[1.35rem] border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-950/40">
                  <img src={image} alt={`Ảnh mới ${index + 1}`} className="h-full w-full object-cover" />
                </div>
                <div className="flex items-center justify-between gap-2 p-3">
                  <div className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.18em] text-brand-blue">
                    <ImagePlus className="h-3.5 w-3.5" />
                    Ảnh mới
                  </div>
                  <button
                    type="button"
                    onClick={() => removeNewImage(index)}
                    className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Xóa
                  </button>
                </div>
              </div>
            ))}

            {totalImages === 0 ? (
              <div className="rounded-[1.35rem] border border-dashed border-slate-300 px-4 py-8 text-center text-sm font-semibold leading-7 text-slate-400 dark:border-white/10 dark:text-slate-500 md:col-span-3">
                Bạn chưa thêm ảnh nào cho bài đăng này.
              </div>
            ) : null}
          </div>
        </div>

        <label className="space-y-2 md:col-span-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tính năng nổi bật</span>
          <textarea
            value={values.features}
            onChange={(event) => updateField('features', event.target.value)}
            rows={5}
            placeholder="Mỗi dòng một ý, ví dụ: Full tướng&#10;Có battle pass"
            className={textareaClassName}
          />
        </label>

        <label className="space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Rank account</span>
          <Input value={values.rank} onChange={(event) => updateField('rank', event.target.value)} />
        </label>

        <label className="space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tướng / nhân vật</span>
          <Input value={values.champs} onChange={(event) => updateField('champs', event.target.value)} />
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Thông tin bàn giao / account</span>
          <textarea
            value={values.accountDetails}
            onChange={(event) => updateField('accountDetails', event.target.value)}
            rows={6}
            className={textareaClassName}
          />
        </label>
      </div>

      <Button type="submit" disabled={loading} className="w-full" loading={loading} loadingText="Đang gửi bài...">
        <Send className="mr-2 h-4 w-4" />
        {submitLabel}
      </Button>
    </form>
  );
}
