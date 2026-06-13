'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Newspaper,
  ReceiptText,
  UploadCloud,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { useWalletBalance } from '@/components/layout/wallet-balance-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, PageHero, SectionHeader } from '@/components/ui/page-layout';
import { useSessionUser } from '@/hooks/use-session-user';
import { readJsonResponse } from '@/lib/client-api';
import { cn, formatCurrency, toNumber } from '@/lib/utils';

type PressPublication = {
  id: number;
  publication_key: string;
  name: string;
  url?: string | null;
  price_vnd: number;
  note?: string | null;
  display_order: number;
  status: string;
};

type PressOrder = {
  id?: number;
  order_code: string;
  publication_id?: number;
  publication_name: string;
  title?: string | null;
  contact?: string | null;
  docx_path: string;
  price_vnd: number;
  status: string;
  admin_note?: string | null;
  created_at?: string;
};

const sampleDocxFallback = '/uploads/press/kinhdoanhnews.docx';

function normalizePublication(input: Record<string, unknown>): PressPublication {
  return {
    id: Math.trunc(toNumber(input.id, 0)),
    publication_key: String(input.publication_key || ''),
    name: String(input.name || ''),
    url: input.url == null ? null : String(input.url),
    price_vnd: toNumber(input.price_vnd, 0),
    note: input.note == null ? null : String(input.note),
    display_order: Math.trunc(toNumber(input.display_order, 0)),
    status: String(input.status || 'active'),
  };
}

function normalizeOrder(input: Record<string, unknown>): PressOrder {
  return {
    id: input.id == null ? undefined : Math.trunc(toNumber(input.id, 0)),
    order_code: String(input.order_code || ''),
    publication_id: input.publication_id == null ? undefined : Math.trunc(toNumber(input.publication_id, 0)),
    publication_name: String(input.publication_name || ''),
    title: input.title == null ? null : String(input.title),
    contact: input.contact == null ? null : String(input.contact),
    docx_path: String(input.docx_path || ''),
    price_vnd: toNumber(input.price_vnd, 0),
    status: String(input.status || 'pending'),
    admin_note: input.admin_note == null ? null : String(input.admin_note),
    created_at: input.created_at == null ? undefined : String(input.created_at),
  };
}

function statusLabel(status: string) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'completed') return 'Hoàn tất';
  if (normalized === 'processing') return 'Đang xử lý';
  if (normalized === 'canceled' || normalized === 'cancelled') return 'Đã hủy';
  if (normalized === 'refunded') return 'Đã hoàn tiền';
  return 'Chờ admin';
}

function statusClass(status: string) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'completed') return 'border-emerald-400/25 bg-emerald-500/10 text-emerald-300';
  if (normalized === 'processing') return 'border-sky-400/25 bg-sky-500/10 text-sky-300';
  if (normalized === 'canceled' || normalized === 'cancelled' || normalized === 'refunded') {
    return 'border-rose-400/25 bg-rose-500/10 text-rose-300';
  }
  return 'border-amber-400/25 bg-amber-500/10 text-amber-300';
}

function formatDateTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  }).format(date);
}

export function PressPage() {
  const { data: user } = useSessionUser();
  const { setBalances } = useWalletBalance();
  const [publications, setPublications] = useState<PressPublication[]>([]);
  const [orders, setOrders] = useState<PressOrder[]>([]);
  const [sampleDocx, setSampleDocx] = useState(sampleDocxFallback);
  const [loading, setLoading] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [selected, setSelected] = useState<PressPublication | null>(null);
  const [title, setTitle] = useState('');
  const [contact, setContact] = useState('');
  const [note, setNote] = useState('');
  const [docxFile, setDocxFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastOrder, setLastOrder] = useState<PressOrder | null>(null);

  const cheapest = useMemo(() => {
    if (!publications.length) return 0;
    return Math.min(...publications.map((item) => toNumber(item.price_vnd, 0)).filter((price) => price > 0));
  }, [publications]);

  async function loadPublications() {
    setLoading(true);
    try {
      const response = await fetch('/api/press/publications', {
        cache: 'no-store',
        credentials: 'include',
        headers: { 'Cache-Control': 'no-store' },
      });
      const payload = await readJsonResponse<{
        success: boolean;
        data?: Array<Record<string, unknown>>;
        sample_docx?: string;
      }>(response, 'Không tải được bảng giá báo chí');
      setPublications((payload.data || []).map(normalizePublication));
      if (payload.sample_docx) {
        setSampleDocx(payload.sample_docx);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không tải được bảng giá báo chí');
    } finally {
      setLoading(false);
    }
  }

  async function loadOrders() {
    setLoadingOrders(true);
    try {
      const response = await fetch('/api/press/orders', {
        cache: 'no-store',
        credentials: 'include',
        headers: { 'Cache-Control': 'no-store' },
      });
      const payload = await readJsonResponse<{ success: boolean; data?: Array<Record<string, unknown>> }>(
        response,
        'Không tải được đơn lên báo'
      );
      setOrders((payload.data || []).map(normalizeOrder));
    } catch {
      setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  }

  useEffect(() => {
    void loadPublications();
    void loadOrders();
  }, []);

  function closeModal() {
    if (submitting) return;
    setSelected(null);
    setTitle('');
    setContact('');
    setNote('');
    setDocxFile(null);
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast.success('Đã copy mã đơn');
    } catch {
      toast.error('Không copy được mã, hãy bôi đen mã để sao chép');
    }
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;

    const formData = new FormData();
    formData.append('publication_id', String(selected.id));
    formData.append('title', title);
    formData.append('contact', contact);
    formData.append('note', note);
    if (docxFile) {
      formData.append('docx_file', docxFile);
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/press/orders', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const payload = await readJsonResponse<{
        success: boolean;
        message?: string;
        data?: { order?: Record<string, unknown>; balance_after?: number };
      }>(response, 'Không tạo được đơn lên báo');

      if (typeof payload.data?.balance_after === 'number') {
        setBalances({ balance: payload.data.balance_after });
      }

      const order = payload.data?.order ? normalizeOrder(payload.data.order) : null;
      if (order) {
        setLastOrder(order);
        setOrders((current) => [order, ...current.filter((item) => item.order_code !== order.order_code)]);
      } else {
        await loadOrders();
      }

      toast.success(payload.message || 'Đã thanh toán và tạo đơn lên báo');
      closeModal();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không tạo được đơn lên báo');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <PageHero
          eyebrow="Báo chí"
          title="Dịch vụ lên báo"
          description="Chọn đầu báo, thanh toán tạo đơn trước; anh có thể tải file mẫu DOCX để chuẩn bị nội dung và gửi bổ sung cho admin."
          stats={[
            { label: 'Đầu báo', value: `${publications.length}`, hint: 'Admin chỉnh giá được', tone: 'blue' },
            { label: 'Từ', value: cheapest > 0 ? formatCurrency(cheapest) : 'Đang cập nhật', hint: 'Theo bảng giá mới', tone: 'emerald' },
            { label: 'File mẫu', value: 'DOCX', hint: 'Tải trong popup đặt bài', tone: 'violet' },
          ]}
        />

        {lastOrder ? (
          <section className="surface-panel rounded-[1rem] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.28em] text-emerald-400">Đơn vừa tạo</div>
                <div className="mt-2 break-all font-mono text-xl font-black text-white">{lastOrder.order_code}</div>
                <div className="mt-1 text-sm font-semibold text-slate-400">
                  {lastOrder.publication_name} · {formatCurrency(lastOrder.price_vnd)}
                </div>
              </div>
              <Button onClick={() => copyCode(lastOrder.order_code)}>
                <Copy className="h-4 w-4" />
                Copy mã
              </Button>
            </div>
          </section>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-4">
            <SectionHeader
              eyebrow="Bảng giá"
              title="Chọn đầu báo"
              description="Giá hiển thị là giá bán mới. Admin có thể thay đổi giá ở trang quản trị."
              actions={
                <Button asChild variant="outline">
                  <a href={sampleDocx} download>
                    <Download className="h-4 w-4" />
                    Tải mẫu DOCX
                  </a>
                </Button>
              }
            />

            {loading ? (
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {Array.from({ length: 9 }).map((_, index) => (
                  <div key={index} className="h-52 animate-pulse rounded-[1rem] border border-white/10 bg-white/[0.04]" />
                ))}
              </div>
            ) : publications.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {publications.map((item) => (
                  <article
                    key={item.id}
                    className="group relative min-w-0 overflow-hidden rounded-[1rem] border border-slate-200/70 bg-white/80 p-5 shadow-[0_20px_55px_-38px_rgba(15,23,42,0.24)] transition-all hover:-translate-y-0.5 hover:border-brand-blue/35 dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[0_24px_70px_-45px_rgba(37,99,235,0.45)]"
                  >
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400" />
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">
                          <Newspaper className="h-3 w-3" />
                          Đầu báo
                        </div>
                        <h3 className="mt-3 break-words text-xl font-black uppercase leading-[1.15] text-slate-950 dark:text-white">
                          {item.name}
                        </h3>
                        {item.url ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex max-w-full items-center gap-1 truncate text-xs font-bold text-brand-blue hover:text-blue-300"
                          >
                            <span className="truncate">{item.url.replace(/^https?:\/\//, '')}</span>
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        ) : null}
                      </div>
                      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.9rem] border border-brand-blue/20 bg-brand-blue/10 text-brand-blue">
                        <FileText className="h-5 w-5" />
                      </span>
                    </div>

                    <div className="mt-5 rounded-[0.9rem] border border-emerald-500/20 bg-emerald-500/10 p-4">
                      <div className="text-[9px] font-black uppercase tracking-[0.22em] text-emerald-500/90">Giá bán</div>
                      <div className="mt-2 font-mono text-2xl font-black text-emerald-400">{formatCurrency(item.price_vnd)}</div>
                    </div>

                    <Button className="mt-5 w-full" onClick={() => setSelected(item)}>
                      <CheckCircle2 className="h-4 w-4" />
                      Đặt bài
                    </Button>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="Chưa có bảng giá" description="Admin chưa bật đầu báo nào cho dịch vụ này." icon={<Newspaper className="h-5 w-5" />} />
            )}
          </section>

          <aside className="space-y-4">
            <section className="surface-panel rounded-[1rem] p-5">
              <SectionHeader eyebrow="Lưu ý" title="Quy trình gửi bài" />
              <div className="mt-5 space-y-3 text-sm font-semibold leading-6 text-slate-400">
                <div className="rounded-[0.9rem] border border-white/10 bg-white/[0.03] p-3">
                  Tải file mẫu DOCX để tham khảo cấu trúc bài. File upload là tùy chọn, không bắt buộc khi thanh toán.
                </div>
                <div className="rounded-[0.9rem] border border-white/10 bg-white/[0.03] p-3">
                  Giá chưa cố định tuyệt đối theo chuyên mục đặc biệt. Admin có thể liên hệ nếu đầu báo yêu cầu chỉnh thêm.
                </div>
                <div className="rounded-[0.9rem] border border-white/10 bg-white/[0.03] p-3">
                  Hệ thống trừ ví chính ngay khi thanh toán thành công và lưu đơn về trang admin.
                </div>
              </div>
            </section>

            <section className="surface-panel rounded-[1rem] p-5">
              <SectionHeader eyebrow="Lịch sử" title="Đơn lên báo" />
              <div className="mt-5 space-y-3">
                {loadingOrders ? (
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang tải đơn
                  </div>
                ) : orders.length > 0 ? (
                  orders.slice(0, 8).map((order) => (
                    <div key={order.order_code} className="rounded-[0.9rem] border border-white/10 bg-white/[0.03] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-black text-white">{order.publication_name}</div>
                          <button
                            type="button"
                            className="mt-1 break-all font-mono text-xs font-black text-brand-blue hover:text-blue-300"
                            onClick={() => copyCode(order.order_code)}
                          >
                            {order.order_code}
                          </button>
                        </div>
                        <span className={cn('shrink-0 rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.18em]', statusClass(order.status))}>
                          {statusLabel(order.status)}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3 text-xs font-semibold text-slate-400">
                        <span>{formatCurrency(toNumber(order.price_vnd, 0))}</span>
                        <span>{formatDateTime(order.created_at)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    className="py-8"
                    title="Chưa có đơn"
                    description="Các đơn lên báo của anh sẽ nằm ở đây."
                    icon={<ReceiptText className="h-5 w-5" />}
                  />
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>

      {selected ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[1.25rem] border border-white/10 bg-slate-950 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.28em] text-brand-blue">Đặt bài lên báo</div>
                <h2 className="mt-2 text-2xl font-black uppercase leading-tight text-white">{selected.name}</h2>
                <p className="mt-1 text-sm font-semibold text-slate-400">{formatCurrency(selected.price_vnd)}</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={closeModal}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="mt-5 rounded-[1rem] border border-amber-400/20 bg-amber-400/10 p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-black text-amber-200">Tải file mẫu trước khi viết bài</div>
                  <div className="mt-1 text-sm font-semibold leading-6 text-amber-100/80">
                    Dùng file DOCX mẫu để chuẩn bị nội dung. Có thể thanh toán trước mà không cần upload file.
                  </div>
                </div>
                <Button asChild>
                  <a href={sampleDocx} download>
                    <Download className="h-4 w-4" />
                    Tải mẫu
                  </a>
                </Button>
              </div>
            </div>

            <form className="mt-5 space-y-4" onSubmit={submitOrder}>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Tiêu đề bài viết</span>
                  <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nhập tiêu đề bài PR/báo chí" />
                </label>
                <label className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Liên hệ</span>
                  <Input value={contact} onChange={(event) => setContact(event.target.value)} placeholder="Zalo / Telegram / SĐT" />
                </label>
              </div>

              <label className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">File DOCX đã viết (không bắt buộc)</span>
                <Input
                  type="file"
                  accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(event) => setDocxFile(event.target.files?.[0] || null)}
                  className="h-auto py-3"
                />
                {docxFile ? (
                  <span className="inline-flex items-center gap-2 text-xs font-bold text-emerald-300">
                    <UploadCloud className="h-3.5 w-3.5" />
                    {docxFile.name}
                  </span>
                ) : null}
              </label>

              <label className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Ghi chú cho admin</span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Chuyên mục mong muốn, số link, thời gian cần đăng..."
                  rows={4}
                  className="field-elevated min-h-28 w-full rounded-[0.85rem] px-4 py-3 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-brand-blue focus:outline-none focus:ring-4 focus:ring-brand-blue/10 dark:text-white"
                />
              </label>

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={closeModal} disabled={submitting}>
                  Đóng
                </Button>
                <Button type="submit" loading={submitting} loadingText="Đang thanh toán">
                  <Clock3 className="h-4 w-4" />
                  Thanh Toán
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
