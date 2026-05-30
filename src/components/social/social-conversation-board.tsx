'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Ban, Eraser, ImagePlus, LoaderCircle, MessageSquareText, ShieldCheck, Trash2, UserRoundX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { readJsonResponse } from '@/lib/client-api';
import { timeAgo } from '@/lib/utils';

type ConversationMessage = Record<string, unknown>;
type ConversationUser = Record<string, unknown>;

interface ConversationContextCard {
  eyebrow?: string;
  title: string;
  description: string;
  href?: string;
  linkLabel?: string;
}

interface SocialConversationBoardProps {
  userId: number;
  otherUserId: number;
  other: ConversationUser;
  initialMessages: ConversationMessage[];
  blockedByMe: boolean;
  blockedMe: boolean;
  typing: boolean;
  contextCard?: ConversationContextCard;
  initialDraft?: string;
}

function mergeMessages(current: ConversationMessage[], incoming: ConversationMessage[]) {
  const seen = new Set(current.map((item) => Number(item.id || 0)));
  const next = [...current];

  for (const message of incoming) {
    const id = Number(message.id || 0);
    if (id && seen.has(id)) {
      continue;
    }
    if (id) {
      seen.add(id);
    }
    next.push(message);
  }

  return next;
}

function isUserOnline(lastActivity: unknown) {
  const value = String(lastActivity || '').trim();
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && Date.now() - timestamp <= 70 * 1000;
}

function formatPresenceLabel(other: ConversationUser) {
  if (isUserOnline(other.last_activity)) {
    return 'Đang online';
  }

  const lastActivity = String(other.last_activity || '').trim();
  if (!lastActivity) {
    return 'Ít hoạt động gần đây';
  }

  try {
    return `Hoạt động ${timeAgo(lastActivity)}`;
  } catch {
    return `Hoạt động ${new Date(lastActivity).toLocaleString('vi-VN')}`;
  }
}

async function postJson(payload: Record<string, unknown>) {
  const response = await fetch('/api/social/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await readJsonResponse(response, 'Không xử lý được hội thoại');
  if (!result.success) {
    throw new Error(result.message || 'Không xử lý được hội thoại');
  }
  return result;
}

async function friendAction(targetUserId: number, action: string) {
  const response = await fetch('/api/social/friend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_user_id: targetUserId, action }),
  });
  const result = await readJsonResponse(response, 'Không cập nhật được quan hệ');
  if (!result.success) {
    throw new Error(result.message || 'Không cập nhật được quan hệ');
  }
  return result;
}

export function SocialConversationBoard({
  userId,
  otherUserId,
  other,
  initialMessages,
  blockedByMe,
  blockedMe,
  typing,
  contextCard,
  initialDraft,
}: SocialConversationBoardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [messages, setMessages] = useState(initialMessages);
  const [otherState, setOtherState] = useState(other);
  const [content, setContent] = useState(initialDraft || '');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isTyping, setIsTyping] = useState(typing);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const lastTypingPingRef = useRef(0);
  const pollInFlightRef = useRef(false);
  const lastMessageId = useMemo(() => Number(messages[messages.length - 1]?.id || 0), [messages]);

  useEffect(() => {
    setOtherState(other);
  }, [other]);

  useEffect(() => {
    setIsTyping(typing);
  }, [typing]);

  useEffect(() => {
    if (!content.trim() && initialDraft) {
      setContent(initialDraft);
    }
  }, [initialDraft]);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    const interval = window.setInterval(async () => {
      if (pollInFlightRef.current || document.visibilityState === 'hidden') {
        return;
      }

      pollInFlightRef.current = true;
      try {
        const response = await fetch(`/api/social/message?mode=poll&other_id=${otherUserId}&after_id=${lastMessageId}`, { cache: 'no-store' });
        const result = await readJsonResponse(response, 'Không tải được tin nhắn mới');
        if (result.success) {
          const incoming = Array.isArray(result.data?.messages) ? result.data.messages : [];
          if (incoming.length > 0) {
            setMessages((current) => mergeMessages(current, incoming));
          }
          setIsTyping(Boolean(result.data?.typing));
          if (result.data?.other && typeof result.data.other === 'object') {
            setOtherState(result.data.other as ConversationUser);
          }
        }
      } catch {
        // best-effort polling
      } finally {
        pollInFlightRef.current = false;
      }
    }, 2400);

    return () => window.clearInterval(interval);
  }, [lastMessageId, otherUserId]);

  async function handleSend() {
    startTransition(async () => {
      try {
        if (!content.trim() && !attachment) {
          toast.error('Nhập nội dung hoặc đính kèm tệp');
          return;
        }

        const formData = new FormData();
        formData.append('receiver_id', String(otherUserId));
        formData.append('content', content);
        if (attachment) {
          formData.append('attachment_file', attachment);
        }

        const response = await fetch('/api/social/message', {
          method: 'POST',
          body: formData,
        });
        const result = await readJsonResponse(response, 'Không gửi được tin nhắn');
        if (!result.success) {
          throw new Error(result.message || 'Không gửi được tin nhắn');
        }

        setMessages((current) => mergeMessages(current, [result.data]));
        setContent('');
        setAttachment(null);
        toast.success(result.message || 'Đã gửi tin nhắn');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Không gửi được tin nhắn');
      }
    });
  }

  async function sendTyping() {
    const now = Date.now();
    if (now - lastTypingPingRef.current < 2500) {
      return;
    }

    lastTypingPingRef.current = now;
    try {
      await postJson({ action: 'typing', other_id: otherUserId });
    } catch {
      // typing best-effort
    }
  }

  async function handleDelete(messageId: number) {
    startTransition(async () => {
      try {
        await postJson({ action: 'delete', message_id: messageId });
        setMessages((current) => current.filter((item) => Number(item.id) !== messageId));
        toast.success('Đã xóa tin nhắn');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Không thể xóa tin nhắn');
      }
    });
  }

  async function handleClear() {
    startTransition(async () => {
      try {
        await postJson({ action: 'clear', other_id: otherUserId });
        setMessages([]);
        toast.success('Đã xóa đoạn chat');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Không thể xóa đoạn chat');
      }
    });
  }

  async function handleFriendAction(action: string) {
    startTransition(async () => {
      try {
        const result = await friendAction(otherUserId, action);
        toast.success(result.message || 'Đã cập nhật');
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Không thể cập nhật');
      }
    });
  }

  const conversationBlocked = blockedByMe || blockedMe;

  return (
    <div className="space-y-5">
      <section className="rounded-[1.6rem] border border-slate-200 bg-white/90 p-4 shadow-[0_36px_80px_-55px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-white/[0.04] sm:rounded-[2rem] sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-4">
            <div className="relative h-14 w-14 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-blue to-cyan-400">
              {String(otherState.avatar || '') ? (
                <img src={String(otherState.avatar)} alt={String(otherState.username || 'avatar')} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xl font-black text-white">
                  {String(otherState.username || otherState.fullname || '?').slice(0, 1).toUpperCase()}
                </div>
              )}
              <span className={`absolute bottom-1.5 right-1.5 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-slate-950 ${isUserOnline(otherState.last_activity) ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-lg font-black uppercase tracking-[-0.04em] text-slate-950 dark:text-white sm:text-xl">
                {String(otherState.fullname || otherState.username || `User #${otherUserId}`)}
                {String(otherState.role || '').toLowerCase() === 'admin' ? <ShieldCheck className="h-4 w-4 text-brand-blue" /> : null}
              </div>
              <div className="mt-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                @{String(otherState.username || 'unknown')} · {String(otherState.rank || otherState.role || 'Member')}
              </div>
              <div className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                isUserOnline(otherState.last_activity)
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300'
              }`}>
                <span className={`h-2 w-2 rounded-full ${isUserOnline(otherState.last_activity) ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-slate-500'}`} />
                {formatPresenceLabel(otherState)}
              </div>
              {isTyping ? (
                <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  Đang nhập
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => handleFriendAction(blockedByMe ? 'unblock' : 'block')} loading={isPending}>
              {blockedByMe ? <UserRoundX className="mr-1 h-4 w-4" /> : <Ban className="mr-1 h-4 w-4" />}
              {blockedByMe ? 'Gỡ chặn' : 'Chặn'}
            </Button>
            <Button size="sm" variant="outline" onClick={handleClear} loading={isPending}>
              <Eraser className="mr-1 h-4 w-4" />
              Xóa chat
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <Link href="/user/social/inbox">Quay về inbox</Link>
            </Button>
          </div>
        </div>
      </section>

      {contextCard ? (
        <section className="rounded-[1.6rem] border border-brand-blue/15 bg-brand-blue/5 p-4 dark:border-brand-blue/20 dark:bg-brand-blue/10 sm:rounded-[2rem] sm:p-5">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-brand-blue">{contextCard.eyebrow || 'Ngữ cảnh giao dịch'}</div>
          <div className="mt-2 text-xl font-black uppercase tracking-[-0.04em] text-slate-950 dark:text-white">{contextCard.title}</div>
          <p className="mt-3 text-sm font-semibold leading-7 text-slate-600 dark:text-slate-300">
            {contextCard.description}
          </p>
          {contextCard.href ? (
            <div className="mt-4">
              <Link href={contextCard.href} className="inline-flex rounded-xl border border-brand-blue/20 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-brand-blue dark:border-brand-blue/25 dark:bg-slate-950/40">
                {contextCard.linkLabel || 'Xem bài đăng'}
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white/90 shadow-[0_36px_90px_-60px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-white/[0.04] sm:rounded-[2rem]">
        <div ref={boxRef} className="max-h-[560px] space-y-3 overflow-y-auto p-4 sm:p-5">
          {messages.length === 0 ? (
            <div className="rounded-[1.4rem] border border-dashed border-slate-300 p-8 text-center text-sm font-bold text-slate-400 dark:border-white/10">
              Chưa có tin nhắn trong hội thoại này.
            </div>
          ) : messages.map((message) => {
            const mine = Number(message.sender_id) === userId;
            return (
              <div key={String(message.id)} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] rounded-[1.5rem] px-4 py-3 shadow-[0_24px_50px_-40px_rgba(15,23,42,0.45)] sm:max-w-[78%] ${mine ? 'bg-[linear-gradient(135deg,#2563eb_0%,#0ea5e9_100%)] text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-950/60 dark:text-slate-200'}`}>
                  <div className="whitespace-pre-wrap text-sm font-semibold leading-7">{String(message.content || '')}</div>
                  {String(message.attachment || '') ? (
                    <a href={String(message.attachment)} target="_blank" rel="noreferrer" className={`mt-3 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black uppercase tracking-[0.16em] ${mine ? 'bg-white/15 text-white' : 'bg-white text-slate-700 dark:bg-white/10 dark:text-white'}`}>
                      <ImagePlus className="h-4 w-4" />
                      Mở tệp đính kèm
                    </a>
                  ) : null}
                  <div className={`mt-3 flex flex-col items-start gap-2 text-[10px] font-black uppercase tracking-[0.18em] sm:flex-row sm:items-center sm:justify-between sm:gap-3 ${mine ? 'text-white/65' : 'text-slate-400'}`}>
                    <span>{new Date(String(message.created_at || '')).toLocaleString('vi-VN')}</span>
                    <button
                      type="button"
                      onClick={() => handleDelete(Number(message.id))}
                      className="inline-flex items-center gap-1.5 hover:opacity-80"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Xóa
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-slate-200/80 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-slate-950/40 sm:p-5">
          {conversationBlocked ? (
            <div className="rounded-[1.4rem] border border-rose-300/70 bg-rose-50/80 p-4 text-sm font-bold leading-7 text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
              {blockedByMe ? 'Bạn đang chặn người dùng này. Gỡ chặn để tiếp tục nhắn tin.' : 'Người dùng này đang chặn bạn. Bạn không thể tiếp tục gửi tin nhắn.'}
            </div>
          ) : (
            <div className="space-y-4">
              <textarea
                value={content}
                onChange={(event) => {
                  setContent(event.target.value);
                  void sendTyping();
                }}
                rows={5}
                placeholder="Nhập nội dung nhắn riêng..."
                className="w-full rounded-[1.5rem] border border-slate-200 bg-white px-4 py-4 text-sm font-semibold leading-7 text-slate-900 outline-none transition focus:border-brand-blue/40 dark:border-white/10 dark:bg-slate-950/50 dark:text-white"
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-600 transition hover:border-brand-blue/30 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200">
                  <ImagePlus className="h-4 w-4" />
                  {attachment ? attachment.name : 'Đính kèm tệp'}
                  <input type="file" className="hidden" onChange={(event) => setAttachment(event.target.files?.[0] || null)} />
                </label>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                  <Button type="button" variant="outline" onClick={() => setAttachment(null)} disabled={!attachment}>
                    Bỏ tệp
                  </Button>
                  <Button type="button" onClick={handleSend} loading={isPending}>
                    <MessageSquareText className="mr-1 h-4 w-4" />
                    Gửi phản hồi
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
