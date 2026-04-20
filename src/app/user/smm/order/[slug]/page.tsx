'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  HelpCircle,
  History,
  Link as LinkIcon,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Wallet,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { useSessionUser } from '@/hooks/use-session-user';
import type { SmmServiceRecord } from '@/lib/smm-provider';
import { cn, formatCurrency, formatNumber } from '@/lib/utils';

interface CategoryResponse {
  success: boolean;
  message?: string;
  category?: string;
  clean_category?: string;
  platform?: string;
  vat_percent?: number;
  data?: SmmServiceRecord[];
}

interface SmmOrderRecord {
  id: number;
  api_order_id: string;
  service_id: number;
  link: string;
  quantity: number;
  price: number;
  start_count?: number;
  remains?: number;
  status?: string;
  created_at: string;
}

interface OrdersResponse {
  success: boolean;
  message?: string;
  orders?: SmmOrderRecord[];
}

const reactions = [
  { value: 'like', icon: '👍', label: 'Like' },
  { value: 'love', icon: '❤️', label: 'Love' },
  { value: 'care', icon: '🥰', label: 'Care' },
  { value: 'haha', icon: '😆', label: 'Haha' },
  { value: 'wow', icon: '😮', label: 'Wow' },
  { value: 'sad', icon: '😢', label: 'Sad' },
  { value: 'angry', icon: '😡', label: 'Angry' },
];

function cleanStatus(status = '') {
  const normalized = status.toLowerCase().trim();
  const map: Record<string, { label: string; className: string }> = {
    completed: { label: 'Hoàn thành', className: 'bg-emerald-500' },
    success: { label: 'Hoàn thành', className: 'bg-emerald-500' },
    done: { label: 'Hoàn thành', className: 'bg-emerald-500' },
    pending: { label: 'Chờ xử lý', className: 'bg-amber-500' },
    processing: { label: 'Đang chạy', className: 'bg-brand-blue' },
    inprogress: { label: 'Đang chạy', className: 'bg-brand-blue' },
    'in progress': { label: 'Đang chạy', className: 'bg-brand-blue' },
    partial: { label: 'Chạy thiếu', className: 'bg-orange-500' },
    canceled: { label: 'Đã hủy', className: 'bg-rose-500' },
    cancelled: { label: 'Đã hủy', className: 'bg-rose-500' },
    refunded: { label: 'Hoàn tiền', className: 'bg-purple-500' },
    refund: { label: 'Hoàn tiền', className: 'bg-purple-500' },
    failed: { label: 'Thất bại', className: 'bg-rose-500' },
    fail: { label: 'Thất bại', className: 'bg-rose-500' },
  };

  return map[normalized] || { label: status || '---', className: 'bg-slate-400' };
}

function getCommentLines(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function isCommentCategory(category: string) {
  const normalized = category.toLowerCase();
  const isLikeComment =
    normalized.includes('like bình luận') ||
    normalized.includes('like comment') ||
    normalized.includes('like cmt');

  return (
    !isLikeComment &&
    (normalized.includes('bình luận') ||
      normalized.includes('comment') ||
      normalized.includes('binh-luan'))
  );
}

export default function SmmOrderPage() {
  const params = useParams<{ slug: string }>();
  const currentUser = useSessionUser();
  const user = currentUser.data;
  const slug = String(params.slug || '');

  const [services, setServices] = useState<SmmServiceRecord[]>([]);
  const [category, setCategory] = useState('');
  const [cleanCategory, setCleanCategory] = useState('');
  const [platform, setPlatform] = useState('');
  const [vatPercent, setVatPercent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState<number>(0);
  const [orderLink, setOrderLink] = useState('');
  const [quantity, setQuantity] = useState('');
  const [comments, setComments] = useState('');
  const [reaction, setReaction] = useState('like');
  const [submitting, setSubmitting] = useState(false);
  const [orders, setOrders] = useState<SmmOrderRecord[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [detectingId, setDetectingId] = useState(false);

  const selectedService = useMemo(
    () => services.find((service) => service.service === selectedServiceId) || services[0] || null,
    [selectedServiceId, services]
  );

  const needsComments = Boolean(selectedService?.is_comment_service || isCommentCategory(category));
  const commentLines = useMemo(() => getCommentLines(comments), [comments]);
  const effectiveQuantity = needsComments ? commentLines.length : Math.max(0, Math.trunc(Number(quantity || 0)));
  const subtotal = selectedService
    ? Math.ceil((effectiveQuantity / 1000) * selectedService.price_per_1k_vnd)
    : 0;
  const vatAmount = Math.round((subtotal * vatPercent) / 100);
  const totalToPay = subtotal + vatAmount;
  const isReactionService = Boolean(
    selectedService &&
      `${selectedService.name} ${selectedService.category}`.toLowerCase().match(/cảm xúc|cam xuc|reaction/)
  );

  const serviceIds = useMemo(
    () => services.map((service) => service.service).join(','),
    [services]
  );

  const loadOrders = useCallback(async () => {
    if (!serviceIds) return;

    setLoadingOrders(true);
    try {
      const response = await fetch(`/api/smm/my-orders?service_ids=${encodeURIComponent(serviceIds)}`, {
        cache: 'no-store',
      });
      const payload: OrdersResponse = await response.json();

      if (payload.success && payload.orders) {
        setOrders(payload.orders);
      }
    } catch {
      // Lịch sử là phụ trợ, không chặn form đặt đơn.
    } finally {
      setLoadingOrders(false);
    }
  }, [serviceIds]);

  useEffect(() => {
    let active = true;

    async function loadCategory() {
      setLoading(true);
      setError('');

      try {
        const response = await fetch(`/api/smm/category/${encodeURIComponent(slug)}`, {
          cache: 'no-store',
        });
        const payload: CategoryResponse = await response.json();

        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.message || 'Không tìm thấy nhóm dịch vụ');
        }

        if (active) {
          setServices(payload.data);
          setCategory(payload.category || '');
          setCleanCategory(payload.clean_category || payload.category || '');
          setPlatform(payload.platform || '');
          setVatPercent(Number(payload.vat_percent || 0));
          setSelectedServiceId(payload.data[0]?.service || 0);
          setQuantity(String(payload.data[0]?.min || 1));
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Không thể tải nhóm dịch vụ');
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
  }, [slug]);

  useEffect(() => {
    void loadOrders();
    const timer = window.setInterval(() => void loadOrders(), 5000);
    return () => window.clearInterval(timer);
  }, [loadOrders]);

  useEffect(() => {
    const disableAutoParse = slug.includes('fb-like-binh-luan');
    const value = orderLink.trim();

    if (disableAutoParse || !value || !/facebook\.com|fb\.com|fb\.watch/i.test(value)) {
      return;
    }

    const timer = window.setTimeout(async () => {
      setDetectingId(true);
      try {
        const response = await fetch('/api/social/get-id', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: value }),
        });
        const payload = await response.json();
        const resultId = payload.id || payload.uid;

        if (payload.success && resultId) {
          setOrderLink(String(resultId));
          toast.success(`Đã tự động lấy ID ${payload.platform || 'Facebook'}`);
        }
      } catch {
        // Giữ nguyên link nếu không parse được.
      } finally {
        setDetectingId(false);
      }
    }, 800);

    return () => window.clearTimeout(timer);
  }, [orderLink, slug]);

  function handleServiceChange(serviceId: number) {
    const nextService = services.find((service) => service.service === serviceId);
    setSelectedServiceId(serviceId);
    setQuantity(String(nextService?.min || 1));
    setComments('');
  }

  async function pasteLink() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setOrderLink(text);
      }
    } catch {
      toast.error('Không đọc được clipboard');
    }
  }

  async function submitOrder() {
    if (!selectedService) {
      toast.error('Vui lòng chọn máy chủ');
      return;
    }

    if (!orderLink.trim()) {
      toast.error('Vui lòng nhập Link hoặc ID đối tượng');
      return;
    }

    if (needsComments && commentLines.length === 0) {
      toast.error('Dịch vụ này cần danh sách bình luận');
      return;
    }

    if (effectiveQuantity < selectedService.min || effectiveQuantity > selectedService.max) {
      toast.error(
        `Số lượng phải từ ${formatNumber(selectedService.min)} đến ${formatNumber(selectedService.max)}`
      );
      return;
    }

    const confirmed = window.confirm(
      `Khách hàng phải trả: ${formatCurrency(totalToPay)} (đã gồm VAT). Xác nhận thanh toán?`
    );

    if (!confirmed) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/smm/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: selectedService.service,
          provider_id: selectedService.provider_id,
          link: orderLink.trim(),
          quantity: effectiveQuantity,
          reaction: isReactionService ? reaction : undefined,
          comments: needsComments ? comments : undefined,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể tạo đơn');
      }

      toast.success('Đơn hàng đã được gửi lên hệ thống');
      setOrderLink('');
      setComments('');
      setQuantity(String(selectedService.min));
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
            Đang tải máy chủ dịch vụ
          </div>
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-6 text-sm font-bold text-rose-500">
          {error}
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 gap-6 pt-2 lg:grid-cols-12">
            <div className="order-2 lg:order-1 lg:col-span-8">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/5 dark:bg-slate-900">
                <div className="border-b border-slate-100 bg-slate-50/50 p-6 dark:border-white/5 dark:bg-white/5">
                  <h1 className="text-lg font-semibold tracking-tight text-slate-800 dark:text-white">
                    {platform || 'SMM'} : {cleanCategory}
                  </h1>
                </div>

                <div className="space-y-8 p-5 sm:p-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      Link hoặc ID đối tượng :
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={orderLink}
                        onChange={(event) => setOrderLink(event.target.value)}
                        placeholder="Nhập Link bài viết, Page hoặc ID tuỳ dịch vụ..."
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 pr-28 text-sm font-bold shadow-sm outline-none transition-all focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/5 dark:border-white/10 dark:bg-slate-950"
                      />
                      <div className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-2">
                        {detectingId ? (
                          <div className="flex items-center gap-2 rounded-lg border border-brand-blue/20 bg-brand-blue/10 px-3 py-1.5 text-brand-blue">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Detecting</span>
                          </div>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void pasteLink()}
                          className="rounded-lg border border-brand-blue/20 bg-brand-blue/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-brand-blue transition-all hover:bg-brand-blue hover:text-white"
                        >
                          Dán
                        </button>
                        <LinkIcon className="h-5 w-5 text-slate-300" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      Lựa chọn máy chủ :
                    </label>
                    <div className="flex flex-col gap-2.5">
                      {services.map((service, index) => {
                        const checked = selectedService?.service === service.service;
                        return (
                          <label key={`${service.provider_id}-${service.service}`} className="group relative flex cursor-pointer items-start gap-4 py-1">
                            <input
                              type="radio"
                              name="service_id"
                              checked={checked}
                              onChange={() => handleServiceChange(service.service)}
                              className="mt-1 h-5 w-5 cursor-pointer border-2 border-slate-300 text-brand-blue focus:ring-brand-blue/20 dark:border-white/10"
                            />
                            <div className="flex-1 text-[13px] font-semibold leading-relaxed">
                              <span className="font-bold text-slate-900 transition-colors group-hover:text-brand-blue dark:text-white">
                                SV{service.service}
                              </span>
                              <span className="mx-1.5 text-slate-400 opacity-50 dark:text-slate-500">•</span>
                              <span className="text-slate-600 dark:text-slate-400">{service.name}</span>
                              <span className="mx-1.5 text-slate-400 opacity-50 dark:text-slate-500">•</span>
                              <span className="font-bold italic text-rose-500 underline decoration-rose-500/10 dark:text-rose-400">
                                {(service.price_per_1k_vnd / 1000).toFixed(1)} đ
                              </span>
                              <CheckCircle className="ml-1.5 inline h-3.5 w-3.5 text-emerald-500 opacity-60" />
                              {index === 0 ? (
                                <span className="ml-2 rounded bg-blue-500 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-tighter text-white">
                                  Gợi ý
                                </span>
                              ) : null}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {isReactionService ? (
                    <div className="space-y-4 py-6">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                        Chọn biểu cảm xúc :
                      </label>
                      <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-7">
                        {reactions.map((item) => (
                          <label key={item.value} className="group relative cursor-pointer">
                            <input
                              type="radio"
                              name="reaction"
                              value={item.value}
                              checked={reaction === item.value}
                              onChange={() => setReaction(item.value)}
                              className="peer hidden"
                            />
                            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-3 transition-all duration-300 group-hover:-translate-y-1 group-hover:scale-105 peer-checked:border-brand-blue peer-checked:bg-brand-blue/5 peer-checked:ring-2 peer-checked:ring-brand-blue/20 dark:border-white/5 dark:bg-slate-900/50">
                              <span className="mb-2 text-2xl transition-transform duration-500 group-hover:scale-125">
                                {item.icon}
                              </span>
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 transition-colors peer-checked:text-brand-blue dark:text-slate-500">
                                {item.label}
                              </span>
                            </div>
                          </label>
                        ))}
                      </div>
                      <div className="flex items-start gap-3 rounded-2xl border border-blue-500/10 bg-blue-500/5 p-4">
                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                        <p className="text-[10px] font-bold italic leading-relaxed text-slate-400 dark:text-slate-500">
                          <span className="not-italic text-blue-500">Xác nhận:</span> cảm xúc sẽ được gửi theo
                          lựa chọn của bạn qua payload API.
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {needsComments ? (
                    <div className="space-y-4 py-6">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                        Nhập danh sách bình luận (Mỗi dòng 1 nội dung) :
                      </label>
                      <textarea
                        rows={8}
                        value={comments}
                        onChange={(event) => setComments(event.target.value)}
                        className="custom-scrollbar w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-semibold shadow-sm outline-none transition-all focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/5 dark:border-white/10 dark:bg-slate-950"
                        placeholder={`Bình luận 1\nBình luận 2\nBình luận 3...`}
                      />
                      <div className="flex items-start gap-3 rounded-2xl border border-amber-500/10 bg-amber-500/5 p-4">
                        <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                        <p className="text-[10px] font-bold italic leading-relaxed text-slate-400 dark:text-slate-500">
                          Hệ thống tự tính số lượng theo số dòng bình luận bạn nhập.
                        </p>
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      Số lượng cần mua :
                    </label>
                    <input
                      type="number"
                      value={needsComments ? String(effectiveQuantity) : quantity}
                      readOnly={needsComments}
                      onChange={(event) => setQuantity(event.target.value)}
                      className={cn(
                        'w-full rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm font-bold shadow-sm outline-none transition-all focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/5 dark:border-white/10 dark:bg-slate-950',
                        needsComments && 'cursor-not-allowed opacity-70'
                      )}
                    />
                  </div>

                  <div className="space-y-2 rounded-2xl border border-brand-blue/10 bg-brand-blue/5 p-6">
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-blue">
                      Thanh toán dự kiến
                    </div>
                    <div className="flex justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      <span>Giá sản phẩm cần thanh toán</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    {vatPercent > 0 ? (
                      <div className="flex justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
                        <span>Thuế VAT ({vatPercent}%)</span>
                        <span>{formatCurrency(vatAmount)}</span>
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between border-t border-brand-blue/20 pt-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-brand-blue">
                        Khách hàng phải trả
                      </span>
                      <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                        {formatCurrency(totalToPay)}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] font-medium text-slate-500">
                      Giá:{' '}
                      <span className="font-bold text-brand-blue">
                        {selectedService ? (selectedService.price_per_1k_vnd / 1000).toFixed(1) : '0'}
                      </span>{' '}
                      đ / 1 lượt
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void submitOrder()}
                    disabled={submitting}
                    className="flex w-full items-center justify-center gap-3 rounded-xl bg-brand-blue py-5 text-sm font-bold uppercase tracking-[0.2em] text-white shadow-xl shadow-brand-blue/20 transition-all hover:bg-blue-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Zap className="h-5 w-5" />}
                    Bắt đầu tiến trình
                  </button>
                </div>
              </div>
            </div>

            <div className="order-1 space-y-6 lg:order-2 lg:col-span-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/5 dark:bg-slate-900">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                    <Wallet className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Số dư khả dụng</div>
                    <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                      {formatCurrency(user?.balance || 0)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-rose-600 bg-rose-500 text-white shadow-lg shadow-rose-500/10">
                <div className="flex items-center gap-2 border-b border-white/10 bg-rose-600 p-4">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Lưu ý quan trọng</span>
                </div>
                <div className="space-y-4 p-6 text-[11px] font-bold leading-relaxed">
                  <p>• Chỉ sử dụng cho nội dung hợp pháp, không vi phạm chính sách nền tảng MXH.</p>
                  <p>• Nhập đúng thông tin đơn hàng; sai sót do người dùng sẽ không được hoàn tiền.</p>
                  <p>• Tương tác có thể tụt, bị xoá hoặc chạy thiếu do nền tảng.</p>
                  <p>• Vi phạm sẽ bị khoá tài khoản, huỷ đơn và khấu trừ số dư.</p>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-blue-600 bg-brand-blue text-white shadow-lg shadow-brand-blue/10">
                <div className="flex items-center gap-2 border-b border-white/10 bg-blue-700 p-4">
                  <HelpCircle className="h-4 w-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Hướng dẫn nhanh</span>
                </div>
                <div className="space-y-4 p-6 text-[11px] font-bold leading-relaxed">
                  <p>1. Mở app, chọn chia sẻ rồi sao chép liên kết.</p>
                  <p>2. Dán link vào ô Link hoặc ID đối tượng.</p>
                  <p>3. Chọn máy chủ phù hợp và đọc kỹ tốc độ/bảo hành.</p>
                  <p>4. Đảm bảo bài viết/tài khoản ở chế độ công khai.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/5 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 p-6 dark:border-white/5">
              <div className="flex items-center gap-3">
                <History className="h-5 w-5 text-slate-400" />
                <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Lịch sử đơn hàng gần đây
                </h2>
              </div>
              <button
                type="button"
                onClick={() => void loadOrders()}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-500 transition-all hover:text-brand-blue dark:border-white/10 dark:bg-white/5"
              >
                <RefreshCw className={cn('h-3 w-3', loadingOrders && 'animate-spin')} />
                Làm mới
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full whitespace-nowrap text-left text-[11px]">
                <thead className="bg-slate-50/50 font-bold uppercase tracking-wider text-slate-400 dark:bg-white/5">
                  <tr>
                    <th className="px-6 py-4">Mã đơn</th>
                    <th className="px-6 py-4">Link / Đối tượng</th>
                    <th className="px-6 py-4">Máy chủ</th>
                    <th className="px-6 py-4 text-center">Số lượng</th>
                    <th className="px-6 py-4 text-center">Bắt đầu</th>
                    <th className="px-6 py-4 text-center">Đã chạy</th>
                    <th className="px-6 py-4 text-center">Thanh toán</th>
                    <th className="px-6 py-4 text-center">Trạng thái</th>
                    <th className="px-6 py-4 text-right">Ngày tạo</th>
                  </tr>
                </thead>
                <tbody className="font-bold text-slate-600 dark:text-slate-300">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-20 text-center font-medium italic tracking-widest text-slate-400">
                        Chưa có lịch sử đơn hàng cho mục này.
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => {
                      const status = cleanStatus(order.status);
                      const remains = Number(order.remains || 0);
                      const done = Math.max(0, Number(order.quantity || 0) - remains);

                      return (
                        <tr key={order.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5">
                          <td className="px-6 py-4 font-mono text-[10px] text-slate-400">
                            #{order.api_order_id || order.id}
                          </td>
                          <td className="max-w-[220px] truncate px-6 py-4 underline decoration-brand-blue/30" title={order.link}>
                            {order.link}
                          </td>
                          <td className="px-6 py-4">
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-black dark:bg-white/10">
                              SV{order.service_id}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center font-black">{formatNumber(order.quantity)}</td>
                          <td className="px-6 py-4 text-center text-slate-400">
                            {formatNumber(Number(order.start_count || 0))}
                          </td>
                          <td className="px-6 py-4 text-center text-brand-blue">{formatNumber(done)}</td>
                          <td className="px-6 py-4 text-center font-black text-emerald-600">
                            {formatCurrency(order.price)}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={cn('rounded px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white', status.className)}>
                              {status.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right font-mono text-[10px] opacity-50">
                            {new Date(order.created_at).toLocaleString('vi-VN')}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <ChevronRight className="h-3 w-3" />
            Dữ liệu service và đơn hàng đang chạy qua MySQL/API provider thật.
          </div>
        </div>
      )}
    </AppShell>
  );
}
