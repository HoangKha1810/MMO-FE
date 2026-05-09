'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Eye,
  FilePlus,
  History,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  ShoppingCart,
  UploadCloud,
  X,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { useWalletBalance } from '@/components/layout/wallet-balance-context';
import { useSessionUser } from '@/hooks/use-session-user';
import { cn, formatCurrency } from '@/lib/utils';

interface AutoMxhVariant {
  id: number;
  product_id: number;
  quantity: number;
  name: string;
  price: number;
  original_price: number;
  description: string;
  badge: string;
  type: string;
  allow_avatar: boolean;
  allow_files: boolean;
}

interface AutoMxhProduct {
  id: number;
  category_id: number;
  name: string;
  description: string;
  inputs: Array<{ label: string; placeholder: string }>;
  variants: AutoMxhVariant[];
}

interface CategoryResponse {
  success: boolean;
  message?: string;
  category?: {
    id: number;
    name: string;
    slug: string;
  };
  vat_percent?: number;
  data?: AutoMxhProduct[];
}

interface AutoMxhOrder {
  id: number;
  product_id: number;
  link: string;
  buyer_info: string;
  custom_value: string;
  price: number;
  order_status: string;
  product_name: string;
  variant_name: string;
  perfection_content: string;
  perfection_image: string;
  created_at: string;
}

interface OrdersResponse {
  success: boolean;
  orders?: AutoMxhOrder[];
}

function getStatusBadge(status: string) {
  const badges: Record<string, { label: string; className: string }> = {
    pending: { label: 'Chờ xử lý', className: 'bg-amber-500/10 text-amber-500' },
    processing: { label: 'Đang chạy', className: 'bg-blue-500/10 text-blue-500' },
    completed: { label: 'Hoàn thành', className: 'bg-emerald-500/10 text-emerald-500' },
    failed: { label: 'Thất bại', className: 'bg-rose-500/10 text-rose-500' },
    canceled: { label: 'Đã hủy', className: 'bg-slate-500/10 text-slate-500' },
    cancelled: { label: 'Đã hủy', className: 'bg-slate-500/10 text-slate-500' },
  };

  return badges[status] || { label: status || '---', className: 'bg-slate-500/10 text-slate-500' };
}

function readCustomValue(order: AutoMxhOrder) {
  try {
    const parsed = JSON.parse(order.custom_value || '{}') as Record<string, string>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export default function AutoMxhOrderPage() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const { setBalances } = useWalletBalance();
  const currentUser = useSessionUser();
  const user = currentUser.data;
  const slug = String(params.slug || '');

  const [categoryName, setCategoryName] = useState('');
  const [products, setProducts] = useState<AutoMxhProduct[]>([]);
  const [vatPercent, setVatPercent] = useState(0);
  const [selectedProductId, setSelectedProductId] = useState<number>(0);
  const [selectedVariantId, setSelectedVariantId] = useState<number>(0);
  const [formValues, setFormValues] = useState<Record<number, string>>({});
  const [confirmTerms, setConfirmTerms] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [additionalFiles, setAdditionalFiles] = useState<File[]>([]);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('');
  const [orders, setOrders] = useState<AutoMxhOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<AutoMxhOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) || products[0] || null,
    [products, selectedProductId]
  );
  const selectedVariant = useMemo(
    () => selectedProduct?.variants.find((variant) => variant.id === selectedVariantId) || null,
    [selectedProduct, selectedVariantId]
  );
  const activeInputs = selectedProduct?.inputs.length
    ? selectedProduct.inputs
    : [{ label: 'Link / thông tin cần xử lý', placeholder: 'Nhập link, UID hoặc dữ liệu theo yêu cầu dịch vụ' }];
  const vatAmount = selectedVariant ? Math.round((selectedVariant.price * vatPercent) / 100) : 0;
  const totalToPay = selectedVariant ? selectedVariant.price + vatAmount : 0;

  const loadOrders = useCallback(async () => {
    if (!selectedProductId) return;

    setLoadingOrders(true);
    try {
      const response = await fetch(`/api/automxh/orders?product_ids=${selectedProductId}`, {
        cache: 'no-store',
      });
      const payload: OrdersResponse = await response.json();
      if (payload.success && payload.orders) {
        setOrders(payload.orders);
      }
    } catch {
      // Lịch sử không chặn form.
    } finally {
      setLoadingOrders(false);
    }
  }, [selectedProductId]);

  useEffect(() => {
    let active = true;

    async function loadCategory() {
      setLoading(true);
      setError('');

      try {
        const response = await fetch(`/api/automxh/category/${encodeURIComponent(slug)}`, {
          cache: 'no-store',
        });
        const payload: CategoryResponse = await response.json();

        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.message || 'Không tìm thấy nhóm Auto MXH');
        }

        if (active) {
          setProducts(payload.data);
          setCategoryName(payload.category?.name || '');
          setVatPercent(Number(payload.vat_percent || 0));

          const productFromQuery = Math.trunc(Number(searchParams.get('product') || 0));
          const initialProduct = payload.data.find((product) => product.id === productFromQuery) || payload.data[0];
          setSelectedProductId(initialProduct?.id || 0);
          setSelectedVariantId(0);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Không thể tải Auto MXH');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadCategory();

    return () => {
      active = false;
    };
  }, [searchParams, slug]);

  useEffect(() => {
    void loadOrders();
    const timer = window.setInterval(() => void loadOrders(), 5000);
    return () => window.clearInterval(timer);
  }, [loadOrders]);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
    };
  }, [avatarPreviewUrl]);

  function selectProduct(productId: number) {
    setSelectedProductId(productId);
    setSelectedVariantId(0);
    setFormValues({});
    setConfirmTerms(false);
    clearAvatar();
    setAdditionalFiles([]);
  }

  function clearAvatar() {
    if (avatarPreviewUrl) {
      URL.revokeObjectURL(avatarPreviewUrl);
    }
    setAvatarPreviewUrl('');
    setAvatarFile(null);
  }

  async function submitOrder() {
    if (!selectedProduct) {
      toast.error('Vui lòng chọn dịch vụ');
      return;
    }

    if (!selectedVariant) {
      toast.error('Vui lòng chọn máy chủ dịch vụ');
      return;
    }

    for (let index = 0; index < activeInputs.length; index += 1) {
      if (!String(formValues[index] || '').trim()) {
        toast.error(`Vui lòng nhập ${activeInputs[index].label}`);
        return;
      }
    }

    if (!confirmTerms) {
      toast.error('Vui lòng xác nhận điều khoản');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('product_id', String(selectedProduct.id));
      formData.append('variant_id', String(selectedVariant.id));
      formData.append('link', String(formValues[0] || '').trim());
      formData.append('buyer_info', String(formValues[1] || '').trim());
      formData.append('custom_value', JSON.stringify(formValues));
      formData.append('confirm_1', confirmTerms ? '1' : '0');
      formData.append('confirm_2', '1');

      if (avatarFile) {
        formData.append('avatar', avatarFile);
      }

      for (const file of additionalFiles) {
        formData.append('additional_files[]', file);
      }

      const response = await fetch('/api/automxh/order', {
        method: 'POST',
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || payload.message || 'Không thể tạo đơn');
      }

      if (typeof payload.new_balance === 'number') {
        setBalances({ balance: payload.new_balance });
      }

      toast.success('Đơn hàng của bạn đã được khởi tạo');
      setFormValues({});
      setConfirmTerms(false);
      setSelectedVariantId(0);
      clearAvatar();
      setAdditionalFiles([]);
      await loadOrders();
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : 'Không thể tạo đơn');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell user={user}>
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="inline-flex items-center gap-3 rounded-full border border-slate-200 px-5 py-3 text-sm font-bold text-slate-500 dark:border-white/10 dark:text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang tải khu vực đặt hàng
          </div>
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-6 text-sm font-bold text-rose-500">
          {error}
        </div>
      ) : (
        <div className="mx-auto max-w-full px-1 py-4 sm:py-8">
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
            <div className="order-2 space-y-8 lg:order-1 lg:col-span-8">
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/5 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-6 dark:border-white/5 dark:bg-slate-950/20">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-brand-blue shadow-sm dark:border-white/10 dark:bg-slate-900">
                      <ShoppingCart className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black uppercase tracking-tight text-slate-800 dark:text-white">
                        Khu vực đặt hàng
                      </h2>
                      <p className="text-xs font-medium italic text-slate-500">
                        {categoryName || 'Auto MXH'} xử lý tự động theo cấu hình dịch vụ hiện tại.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-8 p-4 lg:p-8">
                  {products.length > 1 ? (
                    <div className="flex flex-wrap gap-2">
                      {products.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => selectProduct(product.id)}
                          className={cn(
                            'rounded-xl border px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all',
                            selectedProduct?.id === product.id
                              ? 'border-brand-blue bg-brand-blue text-white'
                              : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-brand-blue hover:text-brand-blue dark:border-white/10 dark:bg-white/5'
                          )}
                        >
                          {product.name}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
                      {activeInputs.map((input, index) => (
                        <div key={`${input.label}-${index}`} className="space-y-3">
                          <label className="pl-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                            {input.label}
                          </label>
                          <input
                            type="text"
                            value={formValues[index] || ''}
                            onChange={(event) =>
                              setFormValues((current) => ({ ...current, [index]: event.target.value }))
                            }
                            placeholder={input.placeholder}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-bold outline-none transition-all focus:border-brand-blue dark:border-white/5 dark:bg-slate-950"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedProduct ? (
                    <div className="space-y-4 border-t border-slate-100 pt-4 dark:border-white/5">
                      <label className="pl-1 text-xs font-black uppercase tracking-widest text-slate-800 dark:text-white">
                        Chọn máy chủ dịch vụ:
                      </label>
                      <div className="grid grid-cols-1 gap-3">
                        {selectedProduct.variants.length === 0 ? (
                          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm font-bold text-amber-500">
                            Dịch vụ này chưa có máy chủ đang bật.
                          </div>
                        ) : (
                          selectedProduct.variants.map((variant) => {
                            const checked = selectedVariantId === variant.id;
                            return (
                              <div key={variant.id} className="space-y-0">
                                <button
                                  type="button"
                                  onClick={() => setSelectedVariantId(variant.id)}
                                  className={cn(
                                    'group relative flex w-full cursor-pointer items-center gap-5 overflow-hidden rounded-2xl border p-5 text-left transition-all duration-300',
                                    checked
                                      ? 'border-brand-blue bg-brand-blue/[0.03] ring-1 ring-brand-blue/50 dark:bg-brand-blue/5'
                                      : 'border-slate-200 bg-slate-50/30 hover:border-brand-blue/30 dark:border-white/5 dark:bg-white/5'
                                  )}
                                >
                                  <div
                                    className={cn(
                                      'flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all duration-300',
                                      checked
                                        ? 'border-brand-blue bg-white shadow-lg shadow-brand-blue/20 dark:bg-slate-900'
                                        : 'border-slate-300 dark:border-white/10'
                                    )}
                                  >
                                    {checked ? <div className="h-3 w-3 rounded-full bg-brand-blue" /> : null}
                                  </div>

                                  <div className="flex flex-1 items-center justify-between gap-4">
                                    <div>
                                      <div className="flex items-center gap-3">
                                        <span className="text-sm font-black text-slate-800 transition-colors group-hover:text-brand-blue dark:text-white">
                                          {variant.name}
                                        </span>
                                        {variant.badge ? (
                                          <span className="rounded-full bg-brand-blue px-2.5 py-0.5 text-[8px] font-black uppercase tracking-widest text-white shadow-sm shadow-brand-blue/20">
                                            {variant.badge}
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <div className="text-right">
                                        <div className="font-mono text-sm font-black tracking-tighter text-emerald-500">
                                          {formatCurrency(variant.price)}
                                        </div>
                                      </div>
                                      <ChevronDown
                                        className={cn(
                                          'h-4 w-4 text-slate-300 transition-transform duration-300 dark:text-slate-600',
                                          checked && 'rotate-180 text-brand-blue'
                                        )}
                                      />
                                    </div>
                                  </div>
                                </button>

                                {checked ? (
                                  <div className="mt-1 flex gap-3 rounded-b-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-[12px] font-medium leading-relaxed text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                                    <div className="space-y-1">
                                      <div className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-300">
                                        Chi tiết gói dịch vụ đang chọn
                                      </div>
                                      <div>{variant.description || 'Chưa có mô tả cho gói này.'}</div>
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ) : null}

                  {selectedVariant?.allow_avatar || selectedVariant?.allow_files ? (
                    <div className="space-y-6 border-t border-slate-100 pt-6 dark:border-white/5">
                      <div className="mb-2 flex items-center gap-2">
                        <UploadCloud className="h-4 w-4 text-brand-blue" />
                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-white">
                          Tải lên tài liệu gốc
                        </h3>
                      </div>

                      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        {selectedVariant.allow_avatar ? (
                          <div className="space-y-3">
                            <label className="pl-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                              Ảnh đại diện (Avatar)
                            </label>
                            <label className="group relative block cursor-pointer">
                              <input
                                type="file"
                                accept="image/*"
                                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                                onChange={(event) => {
                                  const file = event.target.files?.[0] || null;
                                  if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
                                  setAvatarFile(file);
                                  setAvatarPreviewUrl(file ? URL.createObjectURL(file) : '');
                                }}
                              />
                              {avatarPreviewUrl ? (
                                <div className="overflow-hidden rounded-2xl border-2 border-emerald-500/30 bg-slate-50 dark:bg-slate-950">
                                  <div className="relative mx-auto aspect-square max-h-48 w-full">
                                    <img src={avatarPreviewUrl} alt="Preview avatar" className="h-full w-full object-contain" />
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.preventDefault();
                                        clearAvatar();
                                      }}
                                      className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/80 text-white transition-colors hover:bg-rose-500"
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  </div>
                                  <p className="py-2 text-center text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                                    Đã chọn ảnh
                                  </p>
                                </div>
                              ) : (
                                <div className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-5 py-8 transition-all group-hover:border-brand-blue group-hover:bg-brand-blue/[0.02] dark:border-white/5 dark:bg-slate-950">
                                  <ImageIcon className="h-8 w-8 text-slate-300 transition-all group-hover:scale-110 group-hover:text-brand-blue" />
                                  <span className="text-xs font-bold text-slate-500 group-hover:text-brand-blue">
                                    Kéo thả hoặc nhấn để chọn ảnh
                                  </span>
                                  <p className="text-[10px] font-medium text-slate-400">PNG, JPG, WEBP</p>
                                </div>
                              )}
                            </label>
                          </div>
                        ) : null}

                        {selectedVariant.allow_files ? (
                          <div className="space-y-3">
                            <label className="pl-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                              Tệp đính kèm (Phôi/Tài liệu)
                            </label>
                            <label className="group relative block cursor-pointer">
                              <input
                                type="file"
                                multiple
                                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                                onChange={(event) => setAdditionalFiles(Array.from(event.target.files || []))}
                              />
                              <div className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-5 py-8 transition-all group-hover:border-emerald-500 group-hover:bg-emerald-500/[0.02] dark:border-white/5 dark:bg-slate-950">
                                <FilePlus className="h-8 w-8 text-slate-300 transition-all group-hover:scale-110 group-hover:text-emerald-500" />
                                <span className="text-xs font-bold text-slate-500 group-hover:text-emerald-500">
                                  {additionalFiles.length > 0
                                    ? `${additionalFiles.length} tệp đã chọn`
                                    : 'Chọn nhiều tệp (nếu cần)'}
                                </span>
                                <p className="text-[10px] font-black italic text-slate-400">
                                  Không nén, giữ nguyên kích thước
                                </p>
                              </div>
                            </label>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-4 border-t border-slate-100 pt-8 dark:border-white/5">
                    <label className="group flex cursor-pointer items-start gap-3">
                      <div className="relative mt-1 flex items-center">
                        <input
                          type="checkbox"
                          checked={confirmTerms}
                          onChange={(event) => setConfirmTerms(event.target.checked)}
                          className="peer hidden"
                        />
                        <div className="h-5 w-5 rounded-lg border-2 border-slate-200 bg-gray-50 transition-all peer-checked:border-brand-blue peer-checked:bg-brand-blue dark:border-white/10 dark:bg-slate-950" />
                        <Check className="absolute inset-0 m-auto h-3.5 w-3.5 text-white opacity-0 transition-opacity peer-checked:opacity-100" />
                      </div>
                      <span className="text-[11px] font-bold uppercase tracking-tight text-slate-500 transition-colors group-hover:text-slate-800 dark:group-hover:text-white">
                        Tôi xác nhận gói dịch vụ và các điều khoản sử dụng.
                      </span>
                    </label>

                    {selectedVariant ? (
                      <div className="space-y-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                        <div className="text-[11px] font-bold italic text-slate-500 dark:text-slate-400">
                          {selectedVariant.name}
                        </div>
                        <div className="flex justify-between text-[10px] font-bold text-slate-600 dark:text-slate-300">
                          <span>Giá sản phẩm cần thanh toán</span>
                          <span>{formatCurrency(selectedVariant.price)}</span>
                        </div>
                        {vatPercent > 0 ? (
                          <div className="flex justify-between text-[10px] font-bold text-slate-600 dark:text-slate-300">
                            <span>Thuế VAT ({vatPercent}%)</span>
                            <span>{formatCurrency(vatAmount)}</span>
                          </div>
                        ) : null}
                        <div className="flex items-center justify-between border-t border-emerald-200 pt-2 dark:border-emerald-500/20">
                          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-500">
                            Khách hàng phải trả
                          </span>
                          <span className="font-mono text-xl font-black tracking-tighter text-emerald-600 dark:text-emerald-500">
                            {formatCurrency(totalToPay)}
                          </span>
                        </div>
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => void submitOrder()}
                      disabled={submitting}
                      className="flex w-full items-center justify-center gap-3 rounded-2xl bg-brand-blue py-5 text-sm font-black uppercase tracking-widest text-white shadow-2xl shadow-brand-blue/40 transition-all hover:-translate-y-1 hover:bg-blue-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5 fill-current" />}
                      Xác nhận thanh toán đơn
                    </button>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-white/5 dark:bg-slate-900">
                <div className="flex items-center gap-3 border-b border-slate-100 p-6 dark:border-white/5">
                  <History className="h-5 w-5 text-slate-400" />
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">
                    Lịch sử đơn gần đây
                  </h3>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/30 px-6 py-3 dark:border-white/5 dark:bg-white/[0.02]">
                  <span className="flex items-center gap-1.5 rounded-md bg-brand-blue/10 px-2 py-1 text-[8px] font-black uppercase tracking-widest text-brand-blue">
                    <span className="h-1 w-1 rounded-full bg-brand-blue" />
                    Auto
                  </span>
                  <button
                    type="button"
                    onClick={() => void loadOrders()}
                    disabled={loadingOrders}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500 shadow-sm transition-all hover:text-brand-blue disabled:opacity-50 dark:border-white/10 dark:bg-slate-900"
                  >
                    <RefreshCw className={cn('h-3 w-3', loadingOrders && 'animate-spin')} />
                    Làm mới
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead className="bg-slate-50/50 dark:bg-slate-950/20">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">ID</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Dịch vụ</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Dữ liệu</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Giá</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Trạng thái</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Kết quả</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Ngày tạo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {orders.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            Chưa có lịch sử đơn hàng nào.
                          </td>
                        </tr>
                      ) : (
                        orders.map((order) => {
                          const badge = getStatusBadge(order.order_status);
                          const customValues = readCustomValue(order);
                          return (
                            <tr key={order.id} className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5">
                              <td className="whitespace-nowrap px-6 py-4 text-xs font-black text-slate-500">#{order.id}</td>
                              <td className="whitespace-nowrap px-6 py-4">
                                <div className="text-xs font-black capitalize text-slate-800 dark:text-white">{order.product_name}</div>
                                <div className="mt-0.5 text-[10px] font-bold uppercase text-brand-blue">{order.variant_name || 'Không xác định'}</div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="max-w-[220px] space-y-1">
                                  {activeInputs.map((input, index) => {
                                    const value = customValues[index] || (index === 0 ? order.link : order.buyer_info);
                                    return value ? (
                                      <div key={`${order.id}-${input.label}`} className="text-[11px]">
                                        <div className="text-[9px] font-black uppercase tracking-tight text-slate-400">
                                          {input.label}
                                        </div>
                                        <div className="truncate font-bold text-slate-700 dark:text-slate-300" title={value}>
                                          {value}
                                        </div>
                                      </div>
                                    ) : null;
                                  })}
                                </div>
                              </td>
                              <td className="whitespace-nowrap px-6 py-4">
                                <div className="font-mono text-xs font-black tracking-tighter text-emerald-500">
                                  {formatCurrency(order.price)}
                                </div>
                              </td>
                              <td className="whitespace-nowrap px-6 py-4">
                                <span className={cn('rounded-lg px-2 py-1 text-[9px] font-black uppercase', badge.className)}>
                                  {badge.label}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-6 py-4">
                                {order.order_status === 'completed' ? (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedOrder(order)}
                                    className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1 text-[9px] font-black uppercase text-white shadow-sm shadow-emerald-500/20 transition-all hover:bg-emerald-600"
                                  >
                                    <Eye className="h-3 w-3" />
                                    Xem kết quả
                                  </button>
                                ) : (
                                  <span className="text-[10px] font-bold italic text-slate-300">Chưa có</span>
                                )}
                              </td>
                              <td className="whitespace-nowrap px-6 py-4 text-xs font-bold text-slate-500">
                                <div className="font-mono text-[10px] opacity-60">
                                  {new Date(order.created_at).toLocaleString('vi-VN')}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="order-1 space-y-6 lg:sticky lg:top-8 lg:order-2 lg:col-span-4">
              <div className="space-y-4 rounded-3xl border border-rose-200 bg-rose-50 p-6 dark:border-rose-500/20 dark:bg-rose-500/5">
                <div className="flex items-center gap-3 text-rose-600 dark:text-rose-500">
                  <AlertTriangle className="h-5 w-5" />
                  <h3 className="text-xs font-black uppercase tracking-widest">Lưu ý quan trọng</h3>
                </div>
                <div className="space-y-3">
                  <p className="text-[11px] font-black uppercase tracking-tight text-rose-500 dark:text-rose-400">
                    Chỉ sử dụng dịch vụ cho mục đích hợp pháp.
                  </p>
                  <p className="text-[11px] font-bold italic leading-relaxed text-slate-600 dark:text-slate-400">
                    Chỉ xử lý tài khoản/nội dung bạn có quyền sử dụng.
                  </p>
                  <p className="text-[11px] font-bold italic leading-relaxed text-slate-600 dark:text-slate-400">
                    Không dùng dịch vụ để lừa đảo, mạo danh hoặc gây hại người khác.
                  </p>
                  <p className="border-t border-rose-200/50 pt-2 text-[11px] font-black italic leading-relaxed text-rose-600 dark:text-rose-500">
                    Vi phạm, tài khoản sẽ bị khóa và bạn tự chịu trách nhiệm.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {selectedOrder ? (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
              <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-white/5">
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">
                    Kết quả đơn #{selectedOrder.id}
                  </h3>
                  <button type="button" onClick={() => setSelectedOrder(null)} className="text-slate-400 hover:text-rose-500">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="space-y-4 p-5">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Ghi chú từ hệ thống
                    </label>
                    <div className="mt-2 whitespace-pre-line rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-medium text-slate-600 dark:border-white/5 dark:bg-white/[0.02] dark:text-slate-300">
                      {selectedOrder.perfection_content || 'Không có ghi chú.'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </AppShell>
  );
}
