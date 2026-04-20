'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Ban, Eraser, ImagePlus, LoaderCircle, MessageSquareText, ShieldCheck, Trash2, UserRoundX } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ConversationMessage = Record<string, unknown>;
type ConversationUser = Record<string, unknown>;

interface SocialConversationBoardProps {
  userId: number;
  otherUserId: number;
  other: ConversationUser;
  initialMessages: ConversationMessage[];
  blockedByMe: boolean;
  blockedMe: boolean;
  typing: boolean;
}

async function postJson(payload: Record<string, unknown>) {
  const response = await fetch('/api/social/message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
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
  const result = await response.json();
  if (!response.ok || !result.success) {
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
}: SocialConversationBoardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [messages, setMessages] = useState(initialMessages);
  const [content, setContent] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isTyping, setIsTyping] = useState(typing);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const lastMessageId = useMemo(() => Number(messages[messages.length - 1]?.id || 0), [messages]);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/social/message?mode=poll&other_id=${otherUserId}&after_id=${lastMessageId}`, { cache: 'no-store' });
        const result = await response.json();
        if (result.success) {
          const incoming = Array.isArray(result.data?.messages) ? result.data.messages : [];
          if (incoming.length > 0) {
            setMessages((current) => [...current, ...incoming]);
          }
          setIsTyping(Boolean(result.data?.typing));
        }
      } catch {
        // best-effort polling
      }
    }, 4000);

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
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || 'Không gửi được tin nhắn');
        }

        setMessages((current) => [...current, result.data]);
        setContent('');
        setAttachment(null);
        toast.success(result.message || 'Đã gửi tin nhắn');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Không gửi được tin nhắn');
      }
    });
  }

  async function sendTyping() {
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
      <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-5 shadow-[0_36px_80px_-55px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-white/[0.04]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-blue to-cyan-400">
              {String(other.avatar || '') ? (
                <img src={String(other.avatar)} alt={String(other.username || 'avatar')} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xl font-black text-white">
                  {String(other.username || other.fullname || '?').slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 text-xl font-black uppercase tracking-[-0.04em] text-slate-950 dark:text-white">
                {String(other.fullname || other.username || `User #${otherUserId}`)}
                {String(other.role || '').toLowerCase() === 'admin' ? <ShieldCheck className="h-4 w-4 text-brand-blue" /> : null}
              </div>
              <div className="mt-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                @{String(other.username || 'unknown')} · {String(other.rank || other.role || 'Member')}
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

      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white/90 shadow-[0_36px_90px_-60px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-white/[0.04]">
        <div ref={boxRef} className="max-h-[560px] space-y-3 overflow-y-auto p-5">
          {messages.length === 0 ? (
            <div className="rounded-[1.4rem] border border-dashed border-slate-300 p-8 text-center text-sm font-bold text-slate-400 dark:border-white/10">
              Chưa có tin nhắn trong hội thoại này.
            </div>
          ) : messages.map((message) => {
            const mine = Number(message.sender_id) === userId;
            return (
              <div key={String(message.id)} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[78%] rounded-[1.5rem] px-4 py-3 shadow-[0_24px_50px_-40px_rgba(15,23,42,0.45)] ${mine ? 'bg-[linear-gradient(135deg,#2563eb_0%,#0ea5e9_100%)] text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-950/60 dark:text-slate-200'}`}>
                  <div className="whitespace-pre-wrap text-sm font-semibold leading-7">{String(message.content || '')}</div>
                  {String(message.attachment || '') ? (
                    <a href={String(message.attachment)} target="_blank" rel="noreferrer" className={`mt-3 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black uppercase tracking-[0.16em] ${mine ? 'bg-white/15 text-white' : 'bg-white text-slate-700 dark:bg-white/10 dark:text-white'}`}>
                      <ImagePlus className="h-4 w-4" />
                      Mở tệp đính kèm
                    </a>
                  ) : null}
                  <div className={`mt-3 flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-[0.18em] ${mine ? 'text-white/65' : 'text-slate-400'}`}>
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

        <div className="border-t border-slate-200/80 bg-slate-50/70 p-5 dark:border-white/10 dark:bg-slate-950/40">
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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-600 transition hover:border-brand-blue/30 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200">
                  <ImagePlus className="h-4 w-4" />
                  {attachment ? attachment.name : 'Đính kèm tệp'}
                  <input type="file" className="hidden" onChange={(event) => setAttachment(event.target.files?.[0] || null)} />
                </label>
                <div className="flex gap-2">
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
