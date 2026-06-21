'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Headphones,
  ImageIcon,
  ListChecks,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  SendHorizonal,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { SupportTiktokOrdersPage } from '@/components/support/support-tiktok-orders-page';
import { useSessionUser } from '@/hooks/use-session-user';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHero, SectionHeader, SectionPanel } from '@/components/ui/page-layout';
import { serializeDatabaseDateTime } from '@/lib/date-time';
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
  order_id?: number | null;
  support_category?: string;
  order_tiktok_id?: string;
  order_service_name?: string;
  order_status?: string;
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
  order_id?: number | null;
  tiktok_id?: string;
  service_name?: string;
  order_status?: string;
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

interface SupportPricingService {
  id: number;
  region_slug: string;
  name: string;
  service_key: string;
  price: number;
  description: string;
  display_order: number;
  status: string;
}

type SupportPricingForm = {
  region_slug: string;
  name: string;
  service_key: string;
  price: string;
  description: string;
  display_order: string;
  status: string;
};

type SupportTab = 'chat' | 'orders' | 'all-orders' | 'pricing';

const SUPPORT_LABEL = 'Nhân viên hỗ trợ TikTok';
const GENERAL_CHAT_KEY = 'general';
const SUPPORT_TIKTOK_CATEGORIES = [
  'Giao dịch',
  'Đình chỉ truy cập LIVE',
  'Đình chỉ tài khoản',
  'Đình chỉ tham gia bảng xếp hạng',
  'Đình chỉ chế độ đã kháng mới',
  'Khác',
];

const EMPTY_PRICING_FORM: SupportPricingForm = {
  region_slug: 'jp',
  name: '',
  service_key: '',
  price: '',
  description: '',
  display_order: '',
  status: 'active',
};

const SUPPORT_PRICING_REGIONS = [
  { slug: 'jp', label: 'SP Tik Nhật' },
  { slug: 'vn', label: 'SP Tik VN' },
  { slug: 'uk', label: 'SP Tik UK' },
  { slug: 'thai', label: 'SP Tik Thái Lan' },
  { slug: 'td', label: 'SP Thụy Sĩ' },
  { slug: 'id', label: 'SP Indonesia' },
  { slug: 'fi', label: 'SP Finland' },
  { slug: 'us', label: 'SP US' },
];

function toOrderChatKey(orderId?: number | string | null) {
  const numeric = Number(orderId || 0);
  return numeric > 0 ? String(numeric) : GENERAL_CHAT_KEY;
}

function parseOrderChatKey(value?: string | null) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized === GENERAL_CHAT_KEY) {
    return null;
  }

  const numeric = Number(normalized);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function getDatabaseDateParts(value: string) {
  const serialized = serializeDatabaseDateTime(value);
  const match = serialized.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  return match
    ? {
        year: match[1],
        month: match[2],
        day: match[3],
        hour: match[4],
        minute: match[5],
      }
    : null;
}

function formatShortTime(value: string) {
  const parts = getDatabaseDateParts(value);
  if (!parts) {
    return '';
  }

  return `${parts.hour}:${parts.minute} ${parts.day}/${parts.month}`;
}

function formatFullTime(value: string) {
  const parts = getDatabaseDateParts(value);
  if (!parts) {
    return '-';
  }

  return `${parts.hour}:${parts.minute} ${parts.day}/${parts.month}/${parts.year}`;
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
  const galleryImages = (message.image_urls || [])
    .map((image) => buildPublicAssetUrl(image || ''))
    .filter((image): image is string => Boolean(image));
  const singleImage = buildPublicAssetUrl(message.image_url || '');

  return Array.from(
    new Set(
      galleryImages.length > 0
        ? galleryImages
        : [singleImage].filter((image): image is string => Boolean(image))
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

function getPricingRegionLabel(regionSlug: string) {
  const normalized = String(regionSlug || '').trim().toLowerCase();
  return SUPPORT_PRICING_REGIONS.find((region) => region.slug === normalized)?.label || normalized.toUpperCase();
}

function sortSupportConversations(conversations: SupportConversation[]) {
  return [...conversations].sort((left, right) => {
    const rightNeedsReply = right.last_sender_type === 'user' ? 1 : 0;
    const leftNeedsReply = left.last_sender_type === 'user' ? 1 : 0;
    const replyDiff = rightNeedsReply - leftNeedsReply;
    if (replyDiff !== 0) return replyDiff;

    const rightTime = serializeDatabaseDateTime(right.last_at || '');
    const leftTime = serializeDatabaseDateTime(left.last_at || '');
    return rightTime.localeCompare(leftTime) || Number(right.user_id || 0) - Number(left.user_id || 0);
  });
}

function isOrderChatOpen(order: SupportOrder) {
  const normalized = String(order.status || '').trim().toLowerCase();
  const expiresAt = order.ngay_het_han ? serializeDatabaseDateTime(order.ngay_het_han) : '';
  const nowText = serializeDatabaseDateTime(new Date().toISOString());

  return (
    ['active', 'completed', 'processing', 'success'].includes(normalized) &&
    Boolean(expiresAt && expiresAt >= nowText)
  );
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
  onOpenConversation?: (userId: number, orderId?: number | null) => void;
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
            <Button type="button" size="sm" variant="outline" onClick={() => onOpenConversation?.(Number(order.user_id), Number(order.id) || null)}>
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
  const [activeOrderKey, setActiveOrderKey] = useState<string>(GENERAL_CHAT_KEY);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [orders, setOrders] = useState<SupportOrder[]>([]);
  const [allOrders, setAllOrders] = useState<SupportOrder[]>([]);
  const [pricingServices, setPricingServices] = useState<SupportPricingService[]>([]);
  const [pricingForm, setPricingForm] = useState<SupportPricingForm>(EMPTY_PRICING_FORM);
  const [editingPricingId, setEditingPricingId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [tab, setTab] = useState<SupportTab>('chat');
  const [draft, setDraft] = useState('');
  const [supportCategory, setSupportCategory] = useState(SUPPORT_TIKTOK_CATEGORIES[0]);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingAllOrders, setLoadingAllOrders] = useState(false);
  const [loadingPricing, setLoadingPricing] = useState(false);
  const [sending, setSending] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);
  const [savingPricing, setSavingPricing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const activeConversation = useMemo(
    () =>
      conversations.find(
        (conversation) =>
          conversation.user_id === activeUserId &&
          toOrderChatKey(conversation.order_id) === activeOrderKey
      ) || null,
    [activeOrderKey, activeUserId, conversations]
  );

  const activeOrderId = useMemo(() => parseOrderChatKey(activeOrderKey), [activeOrderKey]);

  const chatOrderOptions = useMemo(() => {
    const sortedOrders = [...orders].sort((first, second) => {
      const firstTime = serializeDatabaseDateTime(first.created_at || first.ngay_gia_han || '');
      const secondTime = serializeDatabaseDateTime(second.created_at || second.ngay_gia_han || '');
      return secondTime.localeCompare(firstTime) || Number(second.id || 0) - Number(first.id || 0);
    });

    return sortedOrders.filter((order) => meta?.isSupport || isOrderChatOpen(order));
  }, [meta?.isSupport, orders]);

  const activeChatOrder = useMemo(
    () => chatOrderOptions.find((order) => Number(order.id) === Number(activeOrderId || 0)) || null,
    [activeOrderId, chatOrderOptions]
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
        String(conversation.tiktok_id || '').toLowerCase().includes(keyword) ||
        String(conversation.service_name || '').toLowerCase().includes(keyword) ||
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

  const pricingRegions = useMemo(() => {
    const byRegion = new Map<string, SupportPricingService[]>();
    pricingServices.forEach((service) => {
      const region = String(service.region_slug || 'jp').trim() || 'jp';
      byRegion.set(region, [...(byRegion.get(region) || []), service]);
    });

    return Array.from(byRegion.entries())
      .sort(([left], [right]) => {
        const leftWeight = left === 'jp' ? 0 : left === 'vn' ? 1 : 2;
        const rightWeight = right === 'jp' ? 0 : right === 'vn' ? 1 : 2;
        return leftWeight - rightWeight || left.localeCompare(right);
      })
      .map(([region, items]) => ({
        region,
        items: items.sort((left, right) => Number(left.display_order || 0) - Number(right.display_order || 0) || Number(left.id) - Number(right.id)),
      }));
  }, [pricingServices]);

  const canUseChat = Boolean(meta?.isSupport || meta?.canUseChat);
  const activeChatUserId = meta?.isSupport ? activeUserId : user?.id || null;
  const chatTitle = meta?.isSupport
    ? activeConversation
      ? `${activeConversation.username}${activeConversation.tiktok_id ? ` · ${activeConversation.tiktok_id}` : ''}`
      : 'Chưa chọn khách'
    : SUPPORT_LABEL;
  const mustSelectTikTokOrder = Boolean(!meta?.isSupport && canUseChat && !activeOrderId);
  const chatInputDisabled = Boolean(
    !meta?.chatModuleAvailable ||
      !canUseChat ||
      sending ||
      mustSelectTikTokOrder ||
      (meta?.isSupport && !activeChatUserId)
  );

  function openOrdersTab() {
    if (meta?.isSupport) {
      setTab('all-orders');
      void loadAllOrders();
      return;
    }

    setTab('orders');
    void loadOrders(user?.id);
  }

  function openUserOrdersTab() {
    setTab('orders');
    void loadOrders(activeChatUserId);
  }

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

      const nextConversations = sortSupportConversations(
        Array.isArray(payload.conversations) ? (payload.conversations as SupportConversation[]) : []
      );
      setConversations(nextConversations);

      if (selectFirst && nextConversations.length > 0) {
        setActiveUserId((current) => current || nextConversations[0].user_id);
        setActiveOrderKey((current) => (current === GENERAL_CHAT_KEY ? toOrderChatKey(nextConversations[0].order_id) : current));
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

  async function loadMessages(targetUserId?: number | null, silent = false, orderKey = activeOrderKey) {
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
      const orderId = parseOrderChatKey(orderKey);
      if (orderId) {
        params.set('order_id', String(orderId));
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

  async function loadPricing(silent = false) {
    if (!meta?.isSupport) {
      setPricingServices([]);
      return;
    }

    if (!silent) {
      setLoadingPricing(true);
    }

    try {
      const response = await fetch('/api/support-tiktok/pricing', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không tải được bảng giá Support TikTok');
      }

      setPricingServices(Array.isArray(payload.data) ? (payload.data as SupportPricingService[]) : []);
    } catch (loadError) {
      if (!silent) {
        setError(loadError instanceof Error ? loadError.message : 'Không tải được bảng giá Support TikTok');
      }
    } finally {
      if (!silent) {
        setLoadingPricing(false);
      }
    }
  }

  function editPricingService(service: SupportPricingService) {
    setEditingPricingId(service.id);
    setPricingForm({
      region_slug: service.region_slug || 'jp',
      name: service.name || '',
      service_key: service.service_key || '',
      price: String(service.price || ''),
      description: service.description || '',
      display_order: String(service.display_order || ''),
      status: service.status || 'active',
    });
    setTab('pricing');
  }

  function resetPricingForm() {
    setEditingPricingId(null);
    setPricingForm(EMPTY_PRICING_FORM);
  }

  function updatePricingField(field: keyof SupportPricingForm, value: string) {
    setPricingForm((current) => ({ ...current, [field]: value }));
  }

  async function savePricingService() {
    if (!pricingForm.name.trim()) {
      setError('Nhập tên gói Support TikTok trước khi lưu.');
      return;
    }

    setSavingPricing(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch('/api/support-tiktok/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: editingPricingId ? 'update' : 'create',
          id: editingPricingId || undefined,
          ...pricingForm,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không lưu được bảng giá');
      }

      setNotice(payload.message || 'Đã lưu bảng giá Support TikTok');
      resetPricingForm();
      await loadPricing(true);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không lưu được bảng giá');
    } finally {
      setSavingPricing(false);
    }
  }

  async function deletePricingService(serviceId: number) {
    const confirmed = window.confirm('Xóa gói Support TikTok này?');
    if (!confirmed) return;

    setSavingPricing(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch('/api/support-tiktok/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', id: serviceId }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không xóa được gói');
      }

      setNotice(payload.message || 'Đã xóa gói Support TikTok');
      if (editingPricingId === serviceId) resetPricingForm();
      await loadPricing(true);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không xóa được gói');
    } finally {
      setSavingPricing(false);
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
    if (!meta.isSupport && !activeOrderId) {
      setError('Vui lòng chọn ID TikTok đã mua trước khi gửi chat.');
      return;
    }

    setSending(true);
    setError('');
    setNotice('');

    try {
      const formData = new FormData();
      formData.set('message', trimmed);
      const orderId = parseOrderChatKey(activeOrderKey);
      if (meta.isSupport && activeUserId) {
        formData.set('user_id', String(activeUserId));
      }
      if (orderId) {
        formData.set('order_id', String(orderId));
      }
      if (!meta.isSupport && supportCategory) {
        formData.set('support_category', supportCategory);
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
      const conversationUserId = meta.isSupport ? activeUserId : user?.id;
      if (conversationUserId) {
        void loadMessages(conversationUserId, true, activeOrderKey);
        void loadOrders(conversationUserId, true);
      }
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

  function selectConversation(userId: number, nextTab: SupportTab = 'chat', orderKey = GENERAL_CHAT_KEY) {
    setActiveUserId(userId);
    setActiveOrderKey(orderKey);
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
      void loadPricing(true);
      return;
    }

    if (meta.orderModuleAvailable) {
      void loadOrders(user?.id);
    }
    if (meta.chatModuleAvailable && meta.canUseChat) {
      void loadMessages(user?.id, false, activeOrderKey);
    } else {
      setMessages([]);
    }
  }, [activeOrderKey, meta, user?.id]);

  useEffect(() => {
    if (!meta?.isSupport || !activeUserId) {
      return;
    }

    if (meta.chatModuleAvailable) {
      void loadMessages(activeUserId, false, activeOrderKey);
    }
    if (meta.orderModuleAvailable) {
      void loadOrders(activeUserId);
    }
  }, [meta?.isSupport, meta?.chatModuleAvailable, meta?.orderModuleAvailable, activeOrderKey, activeUserId]);

  useEffect(() => {
    if (!meta || !meta.chatModuleAvailable || (!meta.isSupport && !meta.canUseChat)) {
      return;
    }

    const interval = window.setInterval(() => {
      if (meta.isSupport) {
        void loadConversations(false, true);
        if (activeUserId) {
          void loadMessages(activeUserId, true, activeOrderKey);
        }
        return;
      }

      void loadMessages(user?.id, true, activeOrderKey);
    }, 3000);

    return () => window.clearInterval(interval);
  }, [activeOrderKey, activeUserId, meta, user?.id]);

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
            : 'Trao đổi trực tiếp với nhân viên hỗ trợ TikTok. Gửi TikTok ID, mã đơn hoặc ảnh lỗi để được xử lý nhanh.'
        }
        actions={
          <>
            <button
              type="button"
              onClick={openOrdersTab}
              className="btn-kinetic rounded-full bg-brand-blue px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white"
            >
              Đơn TikTok
            </button>
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
                    const active = activeUserId === conversation.user_id && activeOrderKey === toOrderChatKey(conversation.order_id);
                    const needsReply = conversation.last_sender_type === 'user';

                    return (
                      <button
                        key={`${conversation.user_id}:${toOrderChatKey(conversation.order_id)}`}
                        type="button"
                        onClick={() => selectConversation(conversation.user_id, 'chat', toOrderChatKey(conversation.order_id))}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-[1.35rem] border px-4 py-3 text-left transition-all',
                          active
                            ? 'border-brand-blue/30 bg-brand-blue/10'
                            : 'border-slate-200 bg-white hover:border-brand-blue/20 dark:border-white/10 dark:bg-white/[0.04]',
                          needsReply && 'animate-pulse border-rose-400/70 bg-rose-500/12 shadow-[0_0_0_3px_rgba(244,63,94,0.12)]'
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
                              {needsReply ? <span className="h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_14px_rgba(244,63,94,0.85)]" /> : null}
                              <div className="text-[10px] font-mono text-slate-400">
                                {formatShortTime(conversation.last_at)}
                              </div>
                            </div>
                          </div>
                          <div className="truncate text-xs font-bold text-slate-500 dark:text-slate-400">
                            {conversation.last_message || '(trống)'}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                            {needsReply ? (
                              <>
                                <span className="rounded-full bg-rose-500 px-2 py-0.5 text-white">Cần rep</span>
                                <span>·</span>
                              </>
                            ) : null}
                            <span>User {conversation.user_id}</span>
                            <span>·</span>
                            <span>{conversation.tiktok_id || 'Chat chung'}</span>
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
                  {meta?.isSupport ? (
                    <button
                      type="button"
                      onClick={() => {
                        setTab('pricing');
                        void loadPricing();
                      }}
                      className={cn(
                        'rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all',
                        tab === 'pricing'
                          ? 'border-brand-blue bg-brand-blue text-white'
                          : 'surface-chip text-slate-500 dark:text-slate-300'
                      )}
                    >
                      Bảng giá
                    </button>
                  ) : null}
                </div>
              </div>

              {tab === 'chat' ? (
                <>
                  {canUseChat ? (
                    <div className="rounded-[1.45rem] border border-slate-200 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                            {meta?.isSupport ? 'Thread đang xử lý' : 'Chọn tài khoản TikTok để chat'}
                          </div>
                          <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                            {meta?.isSupport
                              ? activeChatOrder
                                ? `${activeChatOrder.service_name || 'Đơn TikTok'} · ${activeChatOrder.tiktok_id || `#${activeChatOrder.id}`}`
                                : 'Chat chung của user'
                              : 'Mỗi ID TikTok đã mua sẽ có một luồng chat riêng để support xử lý đúng tài khoản.'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={openUserOrdersTab}
                          className="surface-chip rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-200"
                        >
                          Quản lý đơn
                        </button>
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                        {meta?.isSupport ? (
                          <button
                            type="button"
                            onClick={() => setActiveOrderKey(GENERAL_CHAT_KEY)}
                            className={cn(
                              'shrink-0 rounded-2xl border px-4 py-2 text-left transition-all',
                              activeOrderKey === GENERAL_CHAT_KEY
                                ? 'border-brand-blue bg-brand-blue text-white'
                                : 'surface-chip text-slate-600 dark:text-slate-200'
                            )}
                          >
                            <div className="text-[10px] font-black uppercase tracking-[0.2em]">Chat chung</div>
                            <div className={cn('mt-1 text-xs font-bold', activeOrderKey === GENERAL_CHAT_KEY ? 'text-white/80' : 'text-slate-400')}>
                              Không gắn đơn
                            </div>
                          </button>
                        ) : null}
                        {chatOrderOptions.map((order) => {
                          const orderKey = toOrderChatKey(order.id);
                          const active = orderKey === activeOrderKey;

                          return (
                            <button
                              key={order.id}
                              type="button"
                              onClick={() => setActiveOrderKey(orderKey)}
                              className={cn(
                                'min-w-[220px] shrink-0 rounded-2xl border px-4 py-2 text-left transition-all',
                                active
                                  ? 'border-brand-blue bg-brand-blue text-white'
                                  : 'surface-chip text-slate-600 dark:text-slate-200'
                              )}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate text-[10px] font-black uppercase tracking-[0.2em]">
                                  #{order.id} · {getOrderStatusLabel(order.status)}
                                </span>
                                <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-black uppercase', active ? 'bg-white/15 text-white' : 'bg-brand-blue/10 text-brand-blue')}>
                                  ID
                                </span>
                              </div>
                              <div className="mt-1 truncate text-sm font-black">
                                {order.tiktok_id || 'TikTok ID'}
                              </div>
                              <div className={cn('mt-0.5 truncate text-xs font-bold', active ? 'text-white/80' : 'text-slate-400')}>
                                {order.service_name || order.service_key || 'Support TikTok'}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      {!meta?.isSupport && chatOrderOptions.length === 0 ? (
                        <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-500">
                          Chưa có đơn TikTok đang mở để gắn vào chat. Bạn vẫn có thể xem lịch sử chat chung hoặc mua/gia hạn gói.
                        </div>
                      ) : null}
                      {mustSelectTikTokOrder ? (
                        <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-500">
                          Hãy chọn một ID TikTok đã mua để Support biết đúng tài khoản cần xử lý.
                        </div>
                      ) : null}
                    </div>
                  ) : null}
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
                                : 'Gửi nội dung cần hỗ trợ, TikTok ID hoặc mã đơn để nhân viên hỗ trợ TikTok xử lý nhanh hơn.'}
                        </p>
                        {!meta?.isSupport && !canUseChat ? (
                          <button
                            type="button"
                            onClick={openOrdersTab}
                            className="btn-kinetic mt-5 inline-flex items-center gap-2 rounded-full bg-brand-blue px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-white"
                          >
                            Chat Support TikTok
                          </button>
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
                              {message.order_id ? (
                                <div
                                  className={cn(
                                    'inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]',
                                    ownMessage
                                      ? 'ml-auto border-brand-blue/20 bg-brand-blue/10 text-brand-blue'
                                      : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500'
                                  )}
                                >
                                  <span className="truncate">
                                    {message.order_tiktok_id || `Đơn #${message.order_id}`}
                                  </span>
                                </div>
                              ) : null}
                              {message.support_category ? (
                                <div
                                  className={cn(
                                    'inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]',
                                    ownMessage
                                      ? 'ml-auto border-cyan-400/20 bg-cyan-400/10 text-cyan-200'
                                      : 'border-cyan-400/20 bg-cyan-400/10 text-cyan-500'
                                  )}
                                >
                                  <ListChecks className="h-3.5 w-3.5" />
                                  <span className="truncate">{message.support_category}</span>
                                </div>
                              ) : null}
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
                    {!meta?.isSupport && canUseChat ? (
                      <div className="rounded-[1.35rem] border border-slate-200 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.04]">
                        <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                          <ListChecks className="h-4 w-4" />
                          Danh mục cần hỗ trợ
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                          {SUPPORT_TIKTOK_CATEGORIES.map((category) => {
                            const active = category === supportCategory;

                            return (
                              <button
                                key={category}
                                type="button"
                                onClick={() => setSupportCategory(category)}
                                disabled={chatInputDisabled}
                                className={cn(
                                  'shrink-0 rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] transition-all disabled:cursor-not-allowed disabled:opacity-50',
                                  active
                                    ? 'border-brand-blue bg-brand-blue text-white'
                                    : 'surface-chip text-slate-500 dark:text-slate-200'
                                )}
                              >
                                {category}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
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
                            : mustSelectTikTokOrder
                              ? 'Chọn ID TikTok đã mua trước khi gửi chat.'
                              : meta?.isSupport && !activeUserId
                              ? 'Chọn khách ở cột trái để phản hồi'
                              : 'Nhập tin nhắn...'
                      }
                      disabled={chatInputDisabled}
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
                            disabled={chatInputDisabled}
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
                        disabled={chatInputDisabled}
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

              {tab === 'orders' && !meta?.isSupport ? (
                <SupportTiktokOrdersPage
                  embedded
                  onBackToChat={() => {
                    setTab('chat');
                    void loadMeta();
                    void loadOrders(user?.id, true);
                  }}
                  onOrdersChanged={() => {
                    void loadMeta();
                    void loadOrders(user?.id, true);
                  }}
                />
              ) : null}

              {tab === 'orders' && meta?.isSupport ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-black uppercase tracking-[0.16em] text-slate-950 dark:text-white">
                      Đơn của khách đang chọn
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
                  {activeChatUserId ? (
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
                            onOpenConversation={(conversationUserId, orderId) => selectConversation(conversationUserId, 'chat', toOrderChatKey(orderId))}
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
                          onOpenConversation={(conversationUserId, orderId) => selectConversation(conversationUserId, 'chat', toOrderChatKey(orderId))}
                          onMarkCompleted={(orderId) => void updateOrderStatus(orderId, 'completed')}
                          onMarkCanceled={(orderId) => void updateOrderStatus(orderId, 'canceled')}
                          updating={updatingOrderId === order.id}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {tab === 'pricing' && meta?.isSupport ? (
                <div className="space-y-5">
                  <SectionHeader
                    eyebrow="Pricing"
                    title="Bảng giá Support TikTok"
                    description="Thêm gói mới, sửa giá từng gói follow và bật/tắt gói theo region cho màn đặt đơn của khách."
                    actions={
                      <Button type="button" size="sm" variant="outline" onClick={() => void loadPricing()} loading={loadingPricing} loadingText="Đang tải...">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                      </Button>
                    }
                  />

                  <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                    <div className="rounded-[1.45rem] border border-slate-200 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                            {editingPricingId ? `Sửa #${editingPricingId}` : 'Thêm gói mới'}
                          </div>
                          <div className="text-lg font-black uppercase text-slate-950 dark:text-white">
                            Giá theo gói follow
                          </div>
                        </div>
                        {editingPricingId ? (
                          <Button type="button" size="sm" variant="outline" onClick={resetPricingForm}>
                            <Plus className="mr-2 h-4 w-4" />
                            Thêm mới
                          </Button>
                        ) : null}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="space-y-1.5">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Region</span>
                          <select
                            value={pricingForm.region_slug}
                            onChange={(event) => updatePricingField('region_slug', event.target.value)}
                            className="field-elevated h-11 w-full rounded-[1.1rem] px-3 text-sm font-bold text-slate-900 outline-none dark:text-white"
                          >
                            {SUPPORT_PRICING_REGIONS.map((region) => (
                              <option key={region.slug} value={region.slug}>
                                {region.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="space-y-1.5">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Trạng thái</span>
                          <select
                            value={pricingForm.status}
                            onChange={(event) => updatePricingField('status', event.target.value)}
                            className="field-elevated h-11 w-full rounded-[1.1rem] px-3 text-sm font-bold text-slate-900 outline-none dark:text-white"
                          >
                            <option value="active">Đang bật</option>
                            <option value="inactive">Tắt</option>
                          </select>
                        </label>
                        <label className="space-y-1.5">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Tên gói</span>
                          <Input
                            value={pricingForm.name}
                            onChange={(event) => updatePricingField('name', event.target.value)}
                            placeholder="Chat Support TikTok Nhật 0 - 10k FL"
                          />
                        </label>
                        <label className="space-y-1.5">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Service key</span>
                          <Input
                            value={pricingForm.service_key}
                            onChange={(event) => updatePricingField('service_key', event.target.value)}
                            placeholder="support-jp-0-10k"
                          />
                        </label>
                        <label className="space-y-1.5">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Giá bán</span>
                          <Input
                            type="number"
                            min="0"
                            value={pricingForm.price}
                            onChange={(event) => updatePricingField('price', event.target.value)}
                            placeholder="180000"
                          />
                        </label>
                        <label className="space-y-1.5">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Sắp xếp</span>
                          <Input
                            type="number"
                            min="0"
                            value={pricingForm.display_order}
                            onChange={(event) => updatePricingField('display_order', event.target.value)}
                            placeholder="1"
                          />
                        </label>
                      </div>

                      <label className="mt-3 block space-y-1.5">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Mô tả</span>
                        <textarea
                          rows={3}
                          value={pricingForm.description}
                          onChange={(event) => updatePricingField('description', event.target.value)}
                          placeholder="Gói chat support TikTok 30 ngày theo follow."
                          className="field-elevated min-h-[96px] w-full rounded-[1.25rem] px-4 py-3 text-sm font-bold text-slate-900 outline-none dark:text-white"
                        />
                      </label>

                      <div className="mt-4 flex flex-wrap justify-end gap-2">
                        <Button type="button" variant="outline" onClick={resetPricingForm} disabled={savingPricing}>
                          Hủy
                        </Button>
                        <Button type="button" onClick={() => void savePricingService()} loading={savingPricing} loadingText="Đang lưu...">
                          <Save className="mr-2 h-4 w-4" />
                          Lưu gói
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-[1.45rem] border border-slate-200 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Danh sách gói</div>
                          <div className="text-lg font-black uppercase text-slate-950 dark:text-white">
                            Giá đang cấu hình
                          </div>
                        </div>
                        <div className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-500">
                          {pricingServices.length} gói
                        </div>
                      </div>

                      {loadingPricing ? (
                        <div className="rounded-[1.25rem] border border-slate-200 px-4 py-10 text-center text-sm font-bold text-slate-500 dark:border-white/10 dark:text-slate-300">
                          Đang tải bảng giá...
                        </div>
                      ) : pricingRegions.length === 0 ? (
                        <div className="rounded-[1.25rem] border border-dashed border-slate-200 px-4 py-10 text-center text-sm font-bold text-slate-400 dark:border-white/10">
                          Chưa có gói Support TikTok nào.
                        </div>
                      ) : (
                        <div className="max-h-[620px] space-y-4 overflow-y-auto pr-1 custom-scrollbar">
                          {pricingRegions.map(({ region, items }) => (
                            <div key={region} className="space-y-2">
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">
                                  {getPricingRegionLabel(region)}
                                </div>
                                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                                  {items.length} gói
                                </div>
                              </div>
                              <div className="space-y-2">
                                {items.map((service) => (
                                  <div
                                    key={service.id}
                                    className={cn(
                                      'rounded-[1.25rem] border p-3 transition-all',
                                      editingPricingId === service.id
                                        ? 'border-brand-blue/40 bg-brand-blue/10'
                                        : 'border-slate-200 bg-slate-50/70 dark:border-white/10 dark:bg-[#0b1220]'
                                    )}
                                  >
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                      <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <div className="truncate text-sm font-black text-slate-950 dark:text-white">
                                            {service.name}
                                          </div>
                                          <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-black uppercase', service.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-400')}>
                                            {service.status === 'active' ? 'Đang bật' : 'Tắt'}
                                          </span>
                                        </div>
                                        <div className="mt-1 flex flex-wrap gap-2 text-[10px] font-bold text-slate-400">
                                          <span>{service.service_key || 'no-key'}</span>
                                          <span>Order {service.display_order || 0}</span>
                                        </div>
                                        {service.description ? (
                                          <div className="mt-2 line-clamp-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                                            {service.description}
                                          </div>
                                        ) : null}
                                      </div>
                                      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                                        <div className="rounded-full bg-emerald-500/10 px-3 py-1.5 text-sm font-black text-emerald-500">
                                          {formatCurrency(service.price)}
                                        </div>
                                        <Button type="button" size="sm" variant="outline" onClick={() => editPricingService(service)}>
                                          <Pencil className="mr-2 h-4 w-4" />
                                          Sửa
                                        </Button>
                                        <Button type="button" size="sm" variant="outline" onClick={() => void deletePricingService(service.id)} disabled={savingPricing}>
                                          <Trash2 className="mr-2 h-4 w-4" />
                                          Xóa
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </SectionPanel>

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
