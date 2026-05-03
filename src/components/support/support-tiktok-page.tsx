'use client';

import Link from 'next/link';
import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Headphones,
  ImageIcon,
  Loader2,
  MessageCircle,
  RefreshCw,
  Search,
  SendHorizonal,
  ShieldCheck,
  ShoppingCart,
  UserRound,
  X,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { useSessionUser } from '@/hooks/use-session-user';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHero, SectionHeader, SectionPanel } from '@/components/ui/page-layout';
import { buildPublicAssetUrl } from '@/lib/public-asset-url';
import { cn, formatCurrency, toNumber } from '@/lib/utils';

interface SupportMeta {
  canAccess: boolean;
  canUseChat: boolean;
  chatBlockedReason: string;
  chatModuleAvailable: boolean;
  isSupport: boolean;
  latestOrderExpiresAt: string | null;
  latestOrderStatus: string | null;
  maintenance: boolean;
  missingTables: string[];
  orderModuleAvailable: boolean;
  role: string;
  serviceDescription: string;
  serviceName: string;
  supportUsername: string;
}

interface SupportMessage {
  id: number;
  user_id: number;
  sender_type: 'user' | 'support';
  sender_name: string;
  message: string;
  image_url?: string;
  image_urls?: string[];
  created_at: string;
}

interface SupportConversation {
  user_id: number;
  username: string;
  avatar: string | null;
  last_message: string;
  last_at: string;
  last_sender_type: string;
}

interface SupportOrder {
  id: number;
  user_id?: number;
  username?: string;
  region?: string;
  service_key?: string;
  service_name?: string;
  tiktok_id?: string;
  buyer_name?: string;
  buyer_contact?: string;
  price?: number | string;
  status?: string;
  ngay_gia_han?: string;
  ngay_het_han?: string;
  created_at?: string;
}

type SupportTab = 'chat' | 'orders' | 'all-orders';

const SUPPORT_LABEL = 'Đội Support TikTok';

function formatShortTime(value: string) {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatFullTime(value: string) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function buildInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join('');
}

function normalizeMessageImages(message: SupportMessage) {
  return Array.from(
    new Set(
      [message.image_url, ...(message.image_urls || [])]
        .map((image) => buildPublicAssetUrl(image || ''))
        .filter((image): image is string => Boolean(image))
    )
  );
}

function getOrderStatusLabel(status: string | null | undefined) {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'completed' || normalized === 'success' || normalized === 'active') return 'Success';
  if (normalized === 'pending') return 'Pending';
  if (normalized === 'processing') return 'Đang xử lý';
  if (normalized === 'canceled' || normalized === 'cancelled') return 'Đã hủy';
  return normalized ? normalized.toUpperCase() : 'Pending';
}

function getOrderStatusClass(status: string | null | undefined) {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'completed' || normalized === 'success' || normalized === 'active') {
    return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/15';
  }
  if (normalized === 'pending') {
    return 'bg-amber-500/10 text-amber-500 border-amber-500/15';
  }
  if (normalized === 'processing') {
    return 'bg-sky-500/10 text-sky-400 border-sky-500/15';
  }
  if (normalized === 'canceled' || normalized === 'cancelled') {
    return 'bg-rose-500/10 text-rose-500 border-rose-500/15';
  }
  return 'bg-slate-500/10 text-slate-400 border-slate-500/15';
}

function OrderCard({
  order,
  supportMode,
  onOpenConversation,
  onMarkCompleted,
  onMarkCanceled,
  updating,
}: {
  order: SupportOrder;
  supportMode: boolean;
  onOpenConversation?: (userId: number) => void;
  onMarkCompleted?: (orderId: number) => void;
  onMarkCanceled?: (orderId: number) => void;
  updating?: boolean;
}) {
  const canComplete = supportMode && !['completed', 'success', 'active'].includes(String(order.status || '').toLowerCase());
  const canCancel = supportMode && !['canceled', 'cancelled'].includes(String(order.status || '').toLowerCase());

  return (
    <div className="surface-card rounded-[1.4rem] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="surface-chip rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-300">
          #{order.id}
        </span>
        <span
          className={cn(
            'inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em]',
            getOrderStatusClass(order.status)
          )}
        >
          {getOrderStatusLabel(order.status)}
        </span>
        {order.region ? (
          <span className="surface-chip rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-300">
            {order.region}
          </span>
        ) : null}
      </div>

      <div className="mt-4 space-y-2">
        <h3 className="text-base font-black uppercase tracking-tight text-slate-950 dark:text-white">
          {order.service_name || order.service_key || 'Đơn TikTok'}
        </h3>
        <div className="grid gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400 sm:grid-cols-2">
          <div>
            TikTok ID: <span className="font-black text-slate-900 dark:text-white">{order.tiktok_id || '-'}</span>
          </div>
          <div>
            Liên hệ: <span className="font-black text-slate-900 dark:text-white">{order.buyer_contact || '-'}</span>
          </div>
          {supportMode ? (
            <div>
              User: <span className="font-black text-slate-900 dark:text-white">{order.username || `User #${order.user_id || 0}`}</span>
            </div>
          ) : null}
          <div>
            Giá: <span className="font-black text-emerald-500">{formatCurrency(toNumber(order.price, 0))}</span>
          </div>
          <div>
            Tạo lúc: <span className="font-black text-slate-900 dark:text-white">{formatFullTime(order.created_at || '')}</span>
          </div>
          <div>
            Hết hạn: <span className="font-black text-slate-900 dark:text-white">{order.ngay_het_han ? formatFullTime(order.ngay_het_han) : '-'}</span>
          </div>
        </div>
      </div>

      {supportMode ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {order.user_id ? (
            <Button type="button" size="sm" variant="outline" onClick={() => onOpenConversation?.(Number(order.user_id))}>
              <MessageCircle className="mr-2 h-4 w-4" />
              Mở chat
            </Button>
          ) : null}
          {canComplete ? (
            <Button type="button" size="sm" onClick={() => onMarkCompleted?.(order.id)} loading={updating} loadingText="Đang lưu...">
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Đánh dấu success
            </Button>
          ) : null}
          {canCancel ? (
            <Button type="button" size="sm" variant="outline" onClick={() => onMarkCanceled?.(order.id)} loading={updating} loadingText="Đang lưu...">
              <X className="mr-2 h-4 w-4" />
              Hủy đơn
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function SupportTiktokPage({ embedded = false }: { embedded?: boolean }) {
  const currentUser = useSessionUser();
  const user = currentUser.data;
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [meta, setMeta] = useState<SupportMeta | null>(null);
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [activeUserId, setActiveUserId] = useState<number | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [orders, setOrders] = useState<SupportOrder[]>([]);
  const [allOrders, setAllOrders] = useState<SupportOrder[]>([]);
  const [search, setSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [tab, setTab] = useState<SupportTab>('chat');
  const [draft, setDraft] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingAllOrders, setLoadingAllOrders] = useState(false);
  const [sending, setSending] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.user_id === activeUserId) || null,
    [activeUserId, conversations]
  );

  const filteredConversations = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return conversations;
    }

    return conversations.filter((conversation) => {
      return (
        conversation.username.toLowerCase().includes(keyword) ||
        String(conversation.user_id).includes(keyword) ||
        conversation.last_message.toLowerCase().includes(keyword)
      );
    });
  }, [conversations, search]);

  const filteredAllOrders = useMemo(() => {
    const keyword = orderSearch.trim().toLowerCase();
    if (!keyword) {
      return allOrders;
    }

    return allOrders.filter((order) => {
      return (
        String(order.username || '').toLowerCase().includes(keyword) ||
        String(order.tiktok_id || '').toLowerCase().includes(keyword) ||
        String(order.service_name || '').toLowerCase().includes(keyword) ||
        String(order.buyer_contact || '').toLowerCase().includes(keyword)
      );
    });
  }, [allOrders, orderSearch]);

  const canUseChat = Boolean(meta?.isSupport || meta?.canUseChat);
  const activeChatUserId = meta?.isSupport ? activeUserId : user?.id || null;
  const ordersHref = meta?.isSupport
    ? (embedded ? '/admin/support-tiktok/orders' : '/user/support-tiktok/orders')
    : '/user/support-tiktok/orders';
  const chatTitle = meta?.isSupport
    ? activeConversation?.username || 'Chưa chọn khách'
    : SUPPORT_LABEL;

  async function loadMeta() {
    setLoadingMeta(true);
    setError('');

    try {
      const response = await fetch('/api/support-tiktok/meta', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể tải cấu hình Support TikTok');
      }

      setMeta(payload.data as SupportMeta);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không thể tải cấu hình Support TikTok');
    } finally {
      setLoadingMeta(false);
    }
  }

  async function loadConversations(selectFirst = false, silent = false) {
    if (!meta?.isSupport || !meta.chatModuleAvailable) {
      setConversations([]);
      return;
    }

    if (!silent) {
      setLoadingConversations(true);
    }

    try {
      const response = await fetch('/api/support-tiktok/chat/conversations', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể tải hội thoại');
      }

      const nextConversations = Array.isArray(payload.conversations) ? (payload.conversations as SupportConversation[]) : [];
      setConversations(nextConversations);

      if (selectFirst && nextConversations.length > 0) {
        setActiveUserId((current) => current || nextConversations[0].user_id);
      }
    } catch (loadError) {
      if (!silent) {
        setError(loadError instanceof Error ? loadError.message : 'Không thể tải hội thoại');
      }
    } finally {
      if (!silent) {
        setLoadingConversations(false);
      }
    }
  }

  async function loadMessages(targetUserId?: number | null, silent = false) {
    if (!meta || !meta.chatModuleAvailable || (!meta.isSupport && !meta.canUseChat)) {
      setMessages([]);
      return;
    }

    const conversationUserId = meta.isSupport ? targetUserId : user?.id;
    if (!conversationUserId) {
      setMessages([]);
      return;
    }

    if (!silent) {
      setLoadingMessages(true);
    }

    try {
      const params = new URLSearchParams();
      if (meta.isSupport) {
        params.set('user_id', String(conversationUserId));
      }

      const response = await fetch(`/api/support-tiktok/chat/messages?${params.toString()}`, {
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể tải tin nhắn');
      }

      setMessages(Array.isArray(payload.messages) ? (payload.messages as SupportMessage[]) : []);
    } catch (loadError) {
      if (!silent) {
        setError(loadError instanceof Error ? loadError.message : 'Không thể tải tin nhắn');
      }
    } finally {
      if (!silent) {
        setLoadingMessages(false);
      }
    }
  }

  async function loadOrders(targetUserId?: number | null, silent = false) {
    if (!meta?.orderModuleAvailable) {
      setOrders([]);
      return;
    }

    const conversationUserId = meta.isSupport ? targetUserId : user?.id;
    if (meta.isSupport && !conversationUserId) {
      setOrders([]);
      return;
    }

    if (!silent) {
      setLoadingOrders(true);
    }

    try {
      const params = new URLSearchParams();
      if (meta.isSupport && conversationUserId) {
        params.set('user_id', String(conversationUserId));
      }

      const query = params.toString();
      const response = await fetch(`/api/support-tiktok/orders${query ? `?${query}` : ''}`, {
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể tải danh sách đơn TikTok');
      }

      setOrders(Array.isArray(payload.data?.orders) ? (payload.data.orders as SupportOrder[]) : []);
    } catch (loadError) {
      if (!silent) {
        setError(loadError instanceof Error ? loadError.message : 'Không thể tải danh sách đơn TikTok');
      }
    } finally {
      if (!silent) {
        setLoadingOrders(false);
      }
    }
  }

  async function loadAllOrders(silent = false) {
    if (!meta?.isSupport || !meta.orderModuleAvailable) {
      setAllOrders([]);
      return;
    }

    if (!silent) {
      setLoadingAllOrders(true);
    }

    try {
      const response = await fetch('/api/support-tiktok/orders', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể tải toàn bộ đơn TikTok');
      }

      setAllOrders(Array.isArray(payload.data?.orders) ? (payload.data.orders as SupportOrder[]) : []);
    } catch (loadError) {
      if (!silent) {
        setError(loadError instanceof Error ? loadError.message : 'Không thể tải toàn bộ đơn TikTok');
      }
    } finally {
      if (!silent) {
        setLoadingAllOrders(false);
      }
    }
  }

  async function sendMessage() {
    if (!meta || !meta.chatModuleAvailable || (!meta.isSupport && !meta.canUseChat)) {
      return;
    }

    const trimmed = draft.trim();
    if (!trimmed && !attachment) {
      return;
    }

    setSending(true);
    setError('');
    setNotice('');

    try {
      const formData = new FormData();
      formData.set('message', trimmed);
      if (meta.isSupport && activeUserId) {
        formData.set('user_id', String(activeUserId));
      }
      if (attachment) {
        formData.set('attachment_file', attachment);
      }

      const response = await fetch('/api/support-tiktok/chat/send', {
        method: 'POST',
        body: formData,
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể gửi tin nhắn');
      }

      setMessages((current) => [...current, payload.message as SupportMessage]);
      setDraft('');
      setAttachment(null);
      if (meta.isSupport) {
        void loadConversations(false, true);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không thể gửi tin nhắn');
    } finally {
      setSending(false);
    }
  }

  async function updateOrderStatus(orderId: number, status: 'completed' | 'canceled') {
    setUpdatingOrderId(orderId);
    setError('');
    setNotice('');

    try {
      const response = await fetch('/api/support-tiktok/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_status',
          order_id: orderId,
          status,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể cập nhật trạng thái đơn');
      }

      setNotice(payload.message || 'Đã cập nhật trạng thái đơn TikTok');
      if (meta?.isSupport) {
        await Promise.all([
          loadOrders(activeUserId, true),
          loadAllOrders(true),
        ]);
      } else {
        await loadOrders(user?.id, true);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không thể cập nhật trạng thái đơn');
    } finally {
      setUpdatingOrderId(null);
    }
  }

  function selectConversation(userId: number, nextTab: SupportTab = 'chat') {
    setActiveUserId(userId);
    setTab(nextTab);
    setError('');
    setNotice('');
  }

  useEffect(() => {
    void loadMeta();
  }, []);

  useEffect(() => {
    if (!meta) {
      return;
    }

    if (meta.isSupport) {
      void loadConversations(true);
      if (meta.orderModuleAvailable) {
        void loadAllOrders();
      }
      return;
    }

    if (meta.orderModuleAvailable) {
      void loadOrders(user?.id);
    }
    if (meta.chatModuleAvailable && meta.canUseChat) {
      void loadMessages(user?.id);
    } else {
      setMessages([]);
    }
  }, [meta, user?.id]);

  useEffect(() => {
    if (!meta?.isSupport || !activeUserId) {
      return;
    }

    if (meta.chatModuleAvailable) {
      void loadMessages(activeUserId);
    }
    if (meta.orderModuleAvailable) {
      void loadOrders(activeUserId);
    }
  }, [meta?.isSupport, meta?.chatModuleAvailable, meta?.orderModuleAvailable, activeUserId]);

  useEffect(() => {
    if (!meta || !meta.chatModuleAvailable || (!meta.isSupport && !meta.canUseChat)) {
      return;
    }

    const interval = window.setInterval(() => {
      if (meta.isSupport) {
        void loadConversations(false, true);
        if (activeUserId) {
          void loadMessages(activeUserId, true);
        }
        return;
      }

      void loadMessages(user?.id, true);
    }, 3000);

    return () => window.clearInterval(interval);
  }, [activeUserId, meta, user?.id]);

  useEffect(() => {
    if (!meta?.orderModuleAvailable) {
      return;
    }

    const interval = window.setInterval(() => {
      if (meta.isSupport) {
        if (activeUserId && tab === 'orders') {
          void loadOrders(activeUserId, true);
        }
        if (tab === 'all-orders') {
          void loadAllOrders(true);
        }
        return;
      }

      void loadOrders(user?.id, true);
    }, 7000);

    return () => window.clearInterval(interval);
  }, [activeUserId, meta, tab, user?.id]);

  useEffect(() => {
    if (!boxRef.current) {
      return;
    }

    boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [messages]);

  const content = (
    <div className="space-y-6">
      <PageHero
        eyebrow={meta?.isSupport ? 'Support TikTok Inbox' : 'Support TikTok'}
        title={meta?.isSupport ? 'Hộp Chat Support TikTok' : meta?.serviceName || 'Chat Support TikTok'}
        description={
          meta?.isSupport
            ? 'Theo dõi hội thoại khách hàng, trả lời trực tiếp, xem đơn TikTok và xử lý trạng thái trong cùng một hộp điều phối.'
            : 'Trao đổi trực tiếp với đội Support TikTok. Gửi TikTok ID, mã đơn hoặc ảnh lỗi để được xử lý nhanh và không còn hiện tên handle cố định trên giao diện.'
        }
        actions={
          <>
            <Link href={ordersHref} className="btn-kinetic rounded-full bg-brand-blue px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white">
              Đơn TikTok
            </Link>
            <Button type="button" variant="outline" onClick={() => void loadMeta()} loading={loadingMeta} loadingText="Đang tải...">
              <RefreshCw className="mr-2 h-4 w-4" />
              Làm mới
            </Button>
          </>
        }
        stats={[
          {
            label: 'Chat',
            value: meta?.chatModuleAvailable ? 'LIVE' : 'OFF',
            hint: meta?.chatModuleAvailable ? 'Khung hội thoại đang sẵn sàng' : 'Thiếu bảng chat',
            tone: meta?.chatModuleAvailable ? 'blue' : 'amber',
          },
          {
            label: 'Đơn',
            value: String(meta?.isSupport ? filteredAllOrders.length : orders.length),
            hint: meta?.isSupport ? 'Đơn đang thấy trong hộp điều phối' : 'Đơn của tài khoản hiện tại',
            tone: 'emerald',
          },
          {
            label: 'Quyền chat',
            value: canUseChat ? 'MỞ' : 'KHÓA',
            hint: canUseChat ? 'Có thể chat trực tiếp ngay' : meta?.chatBlockedReason || 'Cần mua/gia hạn gói để mở chat',
            tone: canUseChat ? 'emerald' : 'amber',
          },
          {
            label: 'Chế độ',
            value: meta?.isSupport ? 'INBOX' : 'CLIENT',
            hint: meta?.orderModuleAvailable ? 'Chat + đơn hàng đã đồng bộ' : 'Đang chạy theo chế độ chat cơ bản',
            tone: 'violet',
          },
        ]}
      />

      {error ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-500">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-500">
          {notice}
        </div>
      ) : null}

      {!loadingMeta && meta && meta.missingTables.length > 0 ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-500">
          Thiếu bảng: {meta.missingTables.join(', ')}. Hãy chạy bootstrap trước khi dùng đầy đủ phần chat và đơn TikTok.
        </div>
      ) : null}

      {loadingMeta ? (
        <SectionPanel className="flex min-h-[320px] items-center justify-center">
          <div className="flex items-center gap-3 text-sm font-bold text-slate-500 dark:text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            Đang mở module Support TikTok...
          </div>
        </SectionPanel>
      ) : !meta?.canAccess ? (
        <SectionPanel className="space-y-4">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-black uppercase text-slate-950 dark:text-white">
              Module đang bảo trì
            </h2>
            <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500 dark:text-slate-400">
              Dịch vụ Support TikTok đang tạm khóa cho người dùng thường. Tài khoản hỗ trợ vẫn có thể vào để kiểm tra và phản hồi.
            </p>
          </div>
        </SectionPanel>
      ) : (
        <div
          className={cn(
            'grid gap-6',
            meta?.isSupport ? 'xl:grid-cols-[320px_minmax(0,1fr)]' : 'xl:grid-cols-[minmax(0,1fr)_330px]'
          )}
        >
          {meta?.isSupport ? (
            <SectionPanel className="space-y-4">
              <SectionHeader
                eyebrow="Inbox"
                title="Danh sách khách"
                description="Source cũ có dạng inbox nhiều hội thoại. Mình đã kéo lại thành danh sách khách để chọn chat và xem đơn nhanh."
                actions={
                  <Button type="button" size="sm" variant="outline" onClick={() => void loadConversations()} loading={loadingConversations} loadingText="Đang tải...">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>
                }
              />
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm username, ID, nội dung..."
                  className="pl-11"
                />
              </div>

              <div className="max-h-[760px] space-y-2 overflow-y-auto custom-scrollbar pr-1">
                {filteredConversations.length === 0 ? (
                  <div className="rounded-[1.4rem] border border-dashed border-slate-200 px-4 py-10 text-center text-sm font-bold text-slate-400 dark:border-white/10">
                    Chưa có hội thoại Support TikTok nào.
                  </div>
                ) : (
                  filteredConversations.map((conversation) => {
                    const active = activeUserId === conversation.user_id;
                    const unread = conversation.last_sender_type === 'user' && !active;

                    return (
                      <button
                        key={conversation.user_id}
                        type="button"
                        onClick={() => selectConversation(conversation.user_id)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-[1.35rem] border px-4 py-3 text-left transition-all',
                          active
                            ? 'border-brand-blue/30 bg-brand-blue/10'
                            : 'border-slate-200 bg-white hover:border-brand-blue/20 dark:border-white/10 dark:bg-white/[0.04]'
                        )}
                      >
                        <Avatar className="h-12 w-12 rounded-[1rem] border border-slate-200 dark:border-white/10">
                          <AvatarImage src={conversation.avatar || undefined} />
                          <AvatarFallback className="rounded-[1rem] bg-slate-200 text-xs font-black text-slate-700 dark:bg-white/10 dark:text-white">
                            {buildInitials(conversation.username)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <div className="truncate text-sm font-black text-slate-950 dark:text-white">
                              {conversation.username}
                            </div>
                            <div className="flex items-center gap-2">
                              {unread ? <span className="h-2.5 w-2.5 rounded-full bg-brand-blue" /> : null}
                              <div className="text-[10px] font-mono text-slate-400">
                                {formatShortTime(conversation.last_at)}
                              </div>
                            </div>
                          </div>
                          <div className="truncate text-xs font-bold text-slate-500 dark:text-slate-400">
                            {conversation.last_message || '(trống)'}
                          </div>
                          <div className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                            ID {conversation.user_id}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </SectionPanel>
          ) : null}

          <div className="space-y-6">
            <SectionPanel className="space-y-4">
              <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[1.15rem] bg-brand-blue/10 text-brand-blue">
                    <Headphones className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                      Đang chat với
                    </div>
                    <div className="text-lg font-black uppercase tracking-tight text-slate-950 dark:text-white">
                      {chatTitle}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setTab('chat')}
                    className={cn(
                      'rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all',
                      tab === 'chat'
                        ? 'border-brand-blue bg-brand-blue text-white'
                        : 'surface-chip text-slate-500 dark:text-slate-300'
                    )}
                  >
                    Chat
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTab('orders');
                      if (meta?.isSupport) {
                        void loadOrders(activeUserId);
                      }
                    }}
                    className={cn(
                      'rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all',
                      tab === 'orders'
                        ? 'border-brand-blue bg-brand-blue text-white'
                        : 'surface-chip text-slate-500 dark:text-slate-300'
                    )}
                  >
                    Đơn theo user
                  </button>
                  {meta?.isSupport ? (
                    <button
                      type="button"
                      onClick={() => {
                        setTab('all-orders');
                        void loadAllOrders();
                      }}
                      className={cn(
                        'rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all',
                        tab === 'all-orders'
                          ? 'border-brand-blue bg-brand-blue text-white'
                          : 'surface-chip text-slate-500 dark:text-slate-300'
                      )}
                    >
                      Tất cả đơn
                    </button>
                  ) : null}
                </div>
              </div>

              {tab === 'chat' ? (
                <>
                  <div
                    ref={boxRef}
                    className="flex h-[560px] flex-col gap-3 overflow-y-auto rounded-[1.7rem] border border-slate-200 bg-slate-50 p-4 custom-scrollbar dark:border-white/10 dark:bg-[#0b1220]"
                  >
                    {messages.length === 0 ? (
                      <div className="m-auto max-w-sm text-center">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-blue/10 text-brand-blue">
                          <MessageCircle className="h-6 w-6" />
                        </div>
                        <h3 className="text-lg font-black uppercase text-slate-950 dark:text-white">
                          {!meta?.isSupport && !canUseChat ? 'Chat chưa mở' : 'Chưa có tin nhắn'}
                        </h3>
                        <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                          {!meta?.chatModuleAvailable
                            ? 'Khung chat đang thiếu bảng dữ liệu. Tạo bootstrap xong rồi tải lại trang để tiếp tục.'
                            : !meta?.isSupport && !canUseChat
                              ? meta?.chatBlockedReason || 'Mua hàng thành công rồi mới chat được.'
                              : meta?.isSupport
                                ? 'Chọn một khách ở cột trái để trả lời theo đúng source inbox cũ.'
                                : 'Gửi nội dung cần hỗ trợ, TikTok ID hoặc mã đơn để đội Support TikTok xử lý nhanh hơn.'}
                        </p>
                        {!meta?.isSupport && !canUseChat ? (
                          <Link
                            href={ordersHref}
                            className="btn-kinetic mt-5 inline-flex items-center gap-2 rounded-full bg-brand-blue px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-white"
                          >
                            Mua hoặc gia hạn gói
                          </Link>
                        ) : null}
                      </div>
                    ) : (
                      messages.map((message) => {
                        const ownMessage =
                          (meta?.isSupport && message.sender_type === 'support') ||
                          (!meta?.isSupport && message.sender_type === 'user');
                        const images = normalizeMessageImages(message);

                        return (
                          <div
                            key={message.id}
                            className={cn('flex', ownMessage ? 'justify-end' : 'justify-start')}
                          >
                            <div className="max-w-[85%] space-y-1">
                              <div
                                className={cn(
                                  'text-[10px] font-black uppercase tracking-[0.22em]',
                                  ownMessage ? 'text-right text-brand-blue' : 'text-slate-400'
                                )}
                              >
                                {message.sender_type === 'support'
                                  ? SUPPORT_LABEL
                                  : meta?.isSupport
                                    ? activeConversation?.username || `User #${message.user_id}`
                                    : user?.username || 'Bạn'}
                              </div>
                              <div
                                className={cn(
                                  'rounded-[1.55rem] px-4 py-3 text-sm font-bold leading-relaxed',
                                  ownMessage
                                    ? 'rounded-br-md bg-brand-blue text-white shadow-lg shadow-brand-blue/20'
                                    : 'rounded-bl-md border border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-100'
                                )}
                              >
                                <div className="whitespace-pre-wrap break-words">{message.message}</div>
                                {images.length > 0 ? (
                                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                    {images.map((image) => (
                                      <button
                                        key={image}
                                        type="button"
                                        onClick={() => setPreviewImage(image)}
                                        className="overflow-hidden rounded-2xl border border-white/10 bg-black/10 text-left"
                                      >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={image} alt="Ảnh chat TikTok support" className="max-h-72 w-full object-cover" />
                                      </button>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                              <div className={cn('text-[10px] font-mono text-slate-400', ownMessage && 'text-right')}>
                                {formatShortTime(message.created_at)}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="space-y-3">
                    <textarea
                      rows={3}
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          void sendMessage();
                        }
                      }}
                      placeholder={
                        !meta?.chatModuleAvailable
                          ? 'Phần chat đang chờ tạo bảng dữ liệu'
                          : !meta?.isSupport && !canUseChat
                            ? meta?.chatBlockedReason || 'Mua hàng thành công rồi mới chat được.'
                            : meta?.isSupport && !activeUserId
                              ? 'Chọn khách ở cột trái để phản hồi'
                              : 'Nhập tin nhắn...'
                      }
                      disabled={!meta?.chatModuleAvailable || !canUseChat || sending || (meta?.isSupport && !activeChatUserId)}
                      className="field-elevated min-h-[112px] w-full rounded-[1.6rem] px-4 py-3 text-sm font-bold text-slate-900 outline-none dark:text-white"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="surface-chip inline-flex cursor-pointer items-center gap-2 rounded-2xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-200">
                          <ImageIcon className="h-4 w-4" />
                          Ảnh chat
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif"
                            className="hidden"
                            onChange={(event) => setAttachment(event.target.files?.[0] || null)}
                            disabled={!meta?.chatModuleAvailable || !canUseChat || sending || (meta?.isSupport && !activeChatUserId)}
                          />
                        </label>
                        {attachment ? (
                          <button
                            type="button"
                            onClick={() => setAttachment(null)}
                            className="inline-flex items-center gap-2 rounded-2xl bg-brand-blue/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-brand-blue"
                          >
                            {attachment.name}
                            <X className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        className="min-w-[168px]"
                        onClick={() => void sendMessage()}
                        loading={sending}
                        loadingText="Đang gửi..."
                        disabled={!meta?.chatModuleAvailable || !canUseChat || (meta?.isSupport && !activeChatUserId)}
                      >
                        <SendHorizonal className="mr-2 h-4 w-4" />
                        Gửi phản hồi
                      </Button>
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                      Enter để gửi, Shift + Enter để xuống dòng
                    </div>
                  </div>
                </>
              ) : null}

              {tab === 'orders' ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-black uppercase tracking-[0.16em] text-slate-950 dark:text-white">
                      {meta?.isSupport ? 'Đơn của khách đang chọn' : 'Đơn Support TikTok của bạn'}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void loadOrders(activeChatUserId)}
                      loading={loadingOrders}
                      loadingText="Đang tải..."
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh
                    </Button>
                  </div>
                  {!meta?.isSupport || activeChatUserId ? (
                    loadingOrders ? (
                      <div className="rounded-[1.4rem] border border-slate-200 px-4 py-10 text-center text-sm font-bold text-slate-500 dark:border-white/10 dark:text-slate-300">
                        Đang tải đơn TikTok...
                      </div>
                    ) : orders.length === 0 ? (
                      <div className="rounded-[1.4rem] border border-dashed border-slate-200 px-4 py-10 text-center text-sm font-bold text-slate-400 dark:border-white/10">
                        Chưa có đơn TikTok nào trong mục này.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {orders.map((order) => (
                          <OrderCard
                            key={order.id}
                            order={order}
                            supportMode={Boolean(meta?.isSupport)}
                            onOpenConversation={(conversationUserId) => selectConversation(conversationUserId, 'chat')}
                            onMarkCompleted={(orderId) => void updateOrderStatus(orderId, 'completed')}
                            onMarkCanceled={(orderId) => void updateOrderStatus(orderId, 'canceled')}
                            updating={updatingOrderId === order.id}
                          />
                        ))}
                      </div>
                    )
                  ) : (
                    <div className="rounded-[1.4rem] border border-dashed border-slate-200 px-4 py-10 text-center text-sm font-bold text-slate-400 dark:border-white/10">
                      Chọn một khách ở cột trái để xem đơn theo user.
                    </div>
                  )}
                </div>
              ) : null}

              {tab === 'all-orders' ? (
                <div className="space-y-4">
                  <SectionHeader
                    eyebrow="Support Orders"
                    title="Tất cả đơn TikTok"
                    description="Bản mới dùng lại luồng source cũ: support có thể lọc đơn, mở chat với user và đổi trạng thái ngay tại đây."
                    actions={
                      <Button type="button" size="sm" variant="outline" onClick={() => void loadAllOrders()} loading={loadingAllOrders} loadingText="Đang tải...">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                      </Button>
                    }
                  />
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={orderSearch}
                      onChange={(event) => setOrderSearch(event.target.value)}
                      placeholder="Tìm user, TikTok ID, dịch vụ..."
                      className="pl-11"
                    />
                  </div>

                  {loadingAllOrders ? (
                    <div className="rounded-[1.4rem] border border-slate-200 px-4 py-10 text-center text-sm font-bold text-slate-500 dark:border-white/10 dark:text-slate-300">
                      Đang tải danh sách đơn...
                    </div>
                  ) : filteredAllOrders.length === 0 ? (
                    <div className="rounded-[1.4rem] border border-dashed border-slate-200 px-4 py-10 text-center text-sm font-bold text-slate-400 dark:border-white/10">
                      Không có đơn nào khớp bộ lọc hiện tại.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredAllOrders.map((order) => (
                        <OrderCard
                          key={order.id}
                          order={order}
                          supportMode
                          onOpenConversation={(conversationUserId) => selectConversation(conversationUserId, 'chat')}
                          onMarkCompleted={(orderId) => void updateOrderStatus(orderId, 'completed')}
                          onMarkCanceled={(orderId) => void updateOrderStatus(orderId, 'canceled')}
                          updating={updatingOrderId === order.id}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </SectionPanel>

            {!meta?.isSupport ? (
              <SectionPanel className="space-y-5">
                <SectionHeader
                  eyebrow="Thông Tin Module"
                  title="Kênh hỗ trợ hiện tại"
                  description="Mình đã bỏ chỗ hiển thị handle cố định kiểu @nhatmediatiktok. Từ giờ giao diện chỉ hiện nhãn chung của đội hỗ trợ."
                />
                <div className="grid gap-3">
                  <div className="surface-card rounded-[1.35rem] p-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                      Kênh hỗ trợ
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-blue/10 text-brand-blue">
                        <Headphones className="h-5 w-5" />
                      </div>
                      <div className="text-base font-black uppercase tracking-tight text-slate-950 dark:text-white">
                        {SUPPORT_LABEL}
                      </div>
                    </div>
                  </div>
                  <div className="surface-card rounded-[1.35rem] p-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                      Trạng thái chat
                    </div>
                    <div className="mt-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                      {canUseChat
                        ? 'Chat đã mở. Bạn có thể gửi tin nhắn và ảnh lỗi trực tiếp cho đội hỗ trợ.'
                        : meta?.chatBlockedReason || 'Mua hàng thành công rồi mới chat được.'}
                    </div>
                    {meta?.latestOrderStatus ? (
                      <div className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                        Đơn gần nhất: {getOrderStatusLabel(meta.latestOrderStatus)}
                        {meta.latestOrderExpiresAt ? ` · Hết hạn ${formatShortTime(meta.latestOrderExpiresAt)}` : ''}
                      </div>
                    ) : null}
                  </div>
                  <div className="surface-card rounded-[1.35rem] p-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                      Gợi ý gửi support
                    </div>
                    <div className="mt-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                      Gửi TikTok ID, mô tả lỗi, ảnh chụp màn hình hoặc mã đơn để đội support kiểm tra nhanh hơn.
                    </div>
                  </div>
                </div>

                {orders.length > 0 ? (
                  <div className="space-y-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                      Đơn gần đây
                    </div>
                    {orders.slice(0, 3).map((order) => (
                      <div key={`summary-${order.id}`} className="surface-chip rounded-[1.2rem] px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-black uppercase tracking-tight text-slate-950 dark:text-white">
                              {order.service_name || order.service_key || `Đơn #${order.id}`}
                            </div>
                            <div className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                              TikTok ID: {order.tiktok_id || '-'}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono text-sm font-black text-emerald-500">
                              {formatCurrency(toNumber(order.price, 0))}
                            </div>
                            <div className={cn('mt-1 text-[10px] font-black uppercase tracking-[0.16em]', String(order.status || '').toLowerCase() === 'canceled' ? 'text-rose-500' : 'text-slate-400')}>
                              {getOrderStatusLabel(order.status)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </SectionPanel>
            ) : null}
          </div>
        </div>
      )}

      <Dialog.Root open={Boolean(previewImage)} onOpenChange={(open) => { if (!open) setPreviewImage(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[120] bg-slate-950/86 backdrop-blur-md" />
          <Dialog.Content className="fixed inset-0 z-[121] flex items-center justify-center p-3 outline-none sm:p-6">
            <Dialog.Title className="sr-only">Ảnh chat Support TikTok</Dialog.Title>
            <div className="relative max-h-full w-full max-w-5xl">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-slate-950/80 text-white transition hover:bg-slate-900"
                >
                  <X className="h-5 w-5" />
                </button>
              </Dialog.Close>
              {previewImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewImage} alt="Ảnh chat Support TikTok" className="max-h-[88vh] w-full rounded-[1.6rem] object-contain" />
              ) : null}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );

  if (embedded) {
    return content;
  }

  return <AppShell user={user}>{content}</AppShell>;
}
