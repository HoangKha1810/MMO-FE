'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Headphones, Loader2, MessageCircle, RefreshCw, Search, SendHorizonal, ShieldCheck } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { useSessionUser } from '@/hooks/use-session-user';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface SupportMeta {
  canAccess: boolean;
  isSupport: boolean;
  maintenance: boolean;
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

function formatTime(value: string) {
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

function buildInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join('');
}

export function SupportTiktokPage() {
  const currentUser = useSessionUser();
  const user = currentUser.data;
  const [meta, setMeta] = useState<SupportMeta | null>(null);
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [activeUserId, setActiveUserId] = useState<number | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const boxRef = useRef<HTMLDivElement | null>(null);

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

  async function loadMeta() {
    setLoadingMeta(true);
    setError('');

    try {
      const response = await fetch('/api/support-tiktok/meta', { cache: 'no-store' });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể tải cấu hình support');
      }

      setMeta(payload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải cấu hình support');
    } finally {
      setLoadingMeta(false);
    }
  }

  async function loadConversations(selectFirst = false) {
    if (!meta?.isSupport) {
      return;
    }

    setLoadingConversations(true);

    try {
      const response = await fetch('/api/support-tiktok/chat/conversations', { cache: 'no-store' });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể tải hội thoại');
      }

      const nextConversations = Array.isArray(payload.conversations) ? payload.conversations : [];
      setConversations(nextConversations);

      if (selectFirst && nextConversations.length > 0) {
        setActiveUserId((current) => current || nextConversations[0].user_id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải hội thoại');
    } finally {
      setLoadingConversations(false);
    }
  }

  async function loadMessages(targetUserId?: number | null) {
    if (!meta) {
      return;
    }

    const conversationUserId = meta.isSupport ? targetUserId : user?.id;
    if (!conversationUserId) {
      return;
    }

    setLoadingMessages(true);

    try {
      const params = new URLSearchParams();
      if (meta.isSupport) {
        params.set('user_id', String(conversationUserId));
      }

      const response = await fetch(`/api/support-tiktok/chat/messages?${params.toString()}`, {
        cache: 'no-store',
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể tải tin nhắn');
      }

      setMessages(Array.isArray(payload.messages) ? payload.messages : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải tin nhắn');
    } finally {
      setLoadingMessages(false);
    }
  }

  async function sendMessage() {
    if (!meta) {
      return;
    }

    const trimmed = draft.trim();
    if (!trimmed) {
      return;
    }

    setSending(true);
    setError('');

    try {
      const response = await fetch('/api/support-tiktok/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          user_id: meta.isSupport ? activeUserId : undefined,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể gửi tin nhắn');
      }

      setMessages((current) => [...current, payload.message as SupportMessage]);
      setDraft('');
      if (meta.isSupport) {
        void loadConversations();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể gửi tin nhắn');
    } finally {
      setSending(false);
    }
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
      return;
    }

    void loadMessages(user?.id);
  }, [meta, user?.id]);

  useEffect(() => {
    if (!meta?.isSupport || !activeUserId) {
      return;
    }

    void loadMessages(activeUserId);
  }, [meta?.isSupport, activeUserId]);

  useEffect(() => {
    if (!meta) {
      return;
    }

    const interval = window.setInterval(() => {
      if (meta.isSupport) {
        if (activeUserId) {
          void loadMessages(activeUserId);
        }
        void loadConversations();
        return;
      }

      void loadMessages(user?.id);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [activeUserId, meta, user?.id]);

  useEffect(() => {
    if (!boxRef.current) {
      return;
    }

    boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [messages]);

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-pink-500/20 bg-pink-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.3em] text-pink-500">
              <Headphones className="h-3.5 w-3.5" />
              Support Tiktok
            </div>
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
                Chat Support TikTok
              </h1>
              <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500 dark:text-slate-400">
                Bám theo env PHP cũ với tài khoản support hiển thị là{' '}
                <span className="font-black text-slate-900 dark:text-white">
                  @{meta?.supportUsername || '...'}
                </span>
                . Tin nhắn đang đọc trực tiếp từ bảng MySQL cũ `support_tiktok_messages`.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-[0.25em]',
                meta?.maintenance
                  ? 'bg-amber-500/10 text-amber-500'
                  : 'bg-emerald-500/10 text-emerald-500'
              )}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {meta?.maintenance ? 'Maintenance' : 'Active'}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 dark:bg-white/5 dark:text-slate-300">
              Order mode: {meta?.orderModuleAvailable ? 'Legacy full' : 'Chat only'}
            </span>
          </div>
        </div>

        {error ? (
          <div className="flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-500">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        ) : null}

        {loadingMeta ? (
          <Card>
            <CardContent className="flex min-h-[320px] items-center justify-center">
              <div className="flex items-center gap-3 text-sm font-bold text-slate-500 dark:text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                Đang tải module support...
              </div>
            </CardContent>
          </Card>
        ) : !meta?.canAccess ? (
          <Card>
            <CardContent className="space-y-4 py-10">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-black uppercase text-slate-900 dark:text-white">
                  Module đang bảo trì
                </h2>
                <p className="mt-2 max-w-xl text-sm font-medium text-slate-500 dark:text-slate-400">
                  Cấu hình MySQL cũ đang đặt dịch vụ Support TikTok ở trạng thái bảo trì. Tài khoản
                  support hoặc admin vẫn có thể truy cập để kiểm tra dữ liệu.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div
            className={cn(
              'grid gap-6',
              meta?.isSupport ? 'xl:grid-cols-[340px_minmax(0,1fr)]' : 'xl:grid-cols-[minmax(0,1fr)_320px]'
            )}
          >
            {meta?.isSupport ? (
              <Card className="overflow-hidden">
                <CardHeader className="border-b border-slate-100 bg-slate-50/80 dark:border-white/10 dark:bg-white/5">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>Hội Thoại</span>
                    <Button size="sm" variant="ghost" onClick={() => void loadConversations()}>
                      {loadingConversations ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  </CardTitle>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Tìm username hoặc ID..."
                      className="pl-11"
                    />
                  </div>
                </CardHeader>
                <CardContent className="max-h-[680px] space-y-2 overflow-y-auto p-3 custom-scrollbar">
                  {filteredConversations.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm font-bold text-slate-400 dark:border-white/10">
                      Chưa có hội thoại nào
                    </div>
                  ) : (
                    filteredConversations.map((conversation) => (
                      <button
                        key={conversation.user_id}
                        type="button"
                        onClick={() => setActiveUserId(conversation.user_id)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all',
                          activeUserId === conversation.user_id
                            ? 'border-brand-blue/30 bg-brand-blue/10'
                            : 'border-slate-200 bg-white hover:border-brand-blue/20 dark:border-white/10 dark:bg-white/5'
                        )}
                      >
                        <Avatar className="h-12 w-12 rounded-2xl border border-slate-200 dark:border-white/10">
                          <AvatarImage src={conversation.avatar || undefined} />
                          <AvatarFallback className="rounded-2xl bg-slate-200 text-xs font-black text-slate-700 dark:bg-white/10 dark:text-white">
                            {buildInitials(conversation.username)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <div className="truncate text-sm font-black text-slate-900 dark:text-white">
                              {conversation.username}
                            </div>
                            <div className="shrink-0 text-[10px] font-mono text-slate-400">
                              {formatTime(conversation.last_at)}
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
                    ))
                  )}
                </CardContent>
              </Card>
            ) : null}

            <Card className="overflow-hidden">
              <CardHeader className="border-b border-slate-100 bg-slate-50/80 dark:border-white/10 dark:bg-white/5">
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-blue/10 text-brand-blue">
                      <MessageCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                        Đang chat với
                      </div>
                      <div className="text-sm font-black text-slate-900 dark:text-white">
                        {meta?.isSupport ? activeConversation?.username || 'Chưa chọn khách' : `@${meta?.supportUsername}`}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void loadMessages(meta?.isSupport ? activeUserId : user?.id)}
                    disabled={loadingMessages}
                  >
                    {loadingMessages ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-4">
                <div
                  ref={boxRef}
                  className="flex h-[520px] flex-col gap-3 overflow-y-auto rounded-[28px] border border-slate-200 bg-slate-50 p-4 custom-scrollbar dark:border-white/10 dark:bg-[#0b1220]"
                >
                  {messages.length === 0 ? (
                    <div className="m-auto max-w-sm text-center">
                      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-blue/10 text-brand-blue">
                        <Headphones className="h-6 w-6" />
                      </div>
                      <h3 className="text-lg font-black uppercase text-slate-900 dark:text-white">
                        Chưa có tin nhắn
                      </h3>
                      <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                        {meta?.isSupport
                          ? 'Chọn một hội thoại bên trái để bắt đầu hỗ trợ.'
                          : 'Gửi yêu cầu trực tiếp cho đội Support TikTok từ module mới.'}
                      </p>
                    </div>
                  ) : (
                    messages.map((message) => {
                      const ownMessage =
                        (meta?.isSupport && message.sender_type === 'support') ||
                        (!meta?.isSupport && message.sender_type === 'user');

                      return (
                        <div
                          key={message.id}
                          className={cn('flex', ownMessage ? 'justify-end' : 'justify-start')}
                        >
                          <div className={cn('max-w-[82%] space-y-1', ownMessage ? 'items-end' : 'items-start')}>
                            <div
                              className={cn(
                                'text-[10px] font-black uppercase tracking-[0.25em]',
                                ownMessage ? 'text-brand-blue text-right' : 'text-slate-400'
                              )}
                            >
                              {message.sender_type === 'support'
                                ? `@${meta?.supportUsername}`
                                : meta?.isSupport
                                  ? `USER #${message.user_id}`
                                  : user?.username || 'Bạn'}
                            </div>
                            <div
                              className={cn(
                                'rounded-[24px] px-4 py-3 text-sm font-bold leading-relaxed',
                                ownMessage
                                  ? 'rounded-br-md bg-brand-blue text-white shadow-lg shadow-brand-blue/20'
                                  : 'rounded-bl-md border border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-100'
                              )}
                            >
                              {message.message}
                            </div>
                            <div className={cn('text-[10px] font-mono text-slate-400', ownMessage && 'text-right')}>
                              {formatTime(message.created_at)}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="flex items-end gap-3">
                  <div className="flex-1">
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
                        meta?.isSupport && !activeUserId
                          ? 'Chọn khách ở cột trái để phản hồi'
                          : 'Nhập tin nhắn...'
                      }
                      disabled={(meta?.isSupport && !activeUserId) || sending}
                      className="min-h-[104px] w-full rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition-all focus:border-brand-blue dark:border-white/10 dark:bg-white/5 dark:text-white"
                    />
                    <div className="mt-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                      Enter để gửi, Shift + Enter để xuống dòng
                    </div>
                  </div>
                  <Button
                    size="xl"
                    className="h-14 w-14 rounded-2xl px-0"
                    onClick={() => void sendMessage()}
                    disabled={sending || (meta?.isSupport && !activeUserId)}
                  >
                    {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <SendHorizonal className="h-5 w-5" />}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {!meta?.isSupport ? (
              <Card className="h-fit">
                <CardHeader>
                  <CardTitle className="text-base">Thông Tin Module</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm font-medium text-slate-500 dark:text-slate-400">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                    <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                      Support account
                    </div>
                    <div className="mt-2 text-base font-black text-slate-900 dark:text-white">
                      @{meta?.supportUsername}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                    <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                      Chế độ vận hành
                    </div>
                    <div className="mt-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                      {meta?.orderModuleAvailable
                        ? 'DB hiện có đủ schema cho order + chat.'
                        : 'DB production hiện chạy đúng phần chat/inbox; order TikTok chưa bật vì thiếu bảng legacy.'}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                    <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                      Gợi ý sử dụng
                    </div>
                    <div className="mt-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                      Gửi thẳng nội dung cần hỗ trợ, lỗi gặp phải hoặc TikTok ID để đội support xử lý nhanh hơn.
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        )}
      </div>
    </AppShell>
  );
}
