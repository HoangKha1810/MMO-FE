'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Bot, Clock3, FileText, Loader2, MessageSquarePlus, Send, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MarkdownMessage } from '@/components/ui/markdown-message';
import type { SessionUser } from '@/hooks/use-session-user';
import { cn } from '@/lib/utils';

interface ConversationSummary {
  id: string;
  title: string;
  updated_at: string;
  message_count: number;
}

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface ConversationDetail {
  id: string;
  title: string;
  messages: ConversationMessage[];
}

interface DocumentCatalogItem {
  id: string;
  title: string;
  summary: string;
  downloadUrl: string;
}

interface UserChatbotPageProps {
  user: SessionUser;
  documents: DocumentCatalogItem[];
}

const starterPrompts = [
  'TRUNGTAMMMO là gì và hiện có những dịch vụ nào?',
  'Hướng dẫn tôi cách mua dịch vụ SMM trên website.',
  'Tôi muốn mua tài nguyên MMO thì bắt đầu từ đâu?',
  'Nạp tiền vào hệ thống như thế nào?',
  'Nếu muốn mua VPS thì tôi cần thao tác theo quy trình nào?',
];

function formatConversationMeta(updatedAt: string, messageCount: number) {
  const parsedDate = new Date(updatedAt);
  const dateLabel = Number.isNaN(parsedDate.getTime())
    ? ''
    : parsedDate.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });

  return `${messageCount} tin${dateLabel ? ` • ${dateLabel}` : ''}`;
}

export function UserChatbotPage({ user, documents }: UserChatbotPageProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [remainingMessages, setRemainingMessages] = useState(5);
  const [dailyLimit, setDailyLimit] = useState(5);
  const [citations, setCitations] = useState<Array<{ documentTitle: string; heading: string }>>([]);
  const didAutoCreateRef = useRef(false);
  const messageViewportRef = useRef<HTMLDivElement | null>(null);

  async function deleteConversation(conversationId: string) {
    try {
      const response = await fetch('/api/chatbot/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_conversation', conversationId }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message);
      setConversations(payload.conversations || []);
      setActiveConversationId(payload.activeConversationId || null);
      setConversation(payload.conversation || null);
      setRemainingMessages(Number(payload.remainingMessages ?? 0));
      setDailyLimit(Number(payload.dailyLimit ?? 5));
      setCitations([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể xóa cuộc trò chuyện.');
    }
  }

  const latestSuggestions = useMemo(() => starterPrompts.slice(0, 5), []);
  const knowledgeGuides = useMemo(() => documents, [documents]);
  const hasOnlyWelcomeMessage =
    (conversation?.messages?.length || 0) === 1 && conversation?.messages?.[0]?.role === 'assistant';
  const visibleMessages = useMemo(() => {
    const messages = hasOnlyWelcomeMessage ? [] : conversation?.messages || [];
    return [...messages].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [conversation?.messages, hasOnlyWelcomeMessage]);

  async function loadConversationData(conversationId?: string | null) {
    const params = new URLSearchParams();
    if (conversationId) {
      params.set('conversation_id', conversationId);
    }

    const response = await fetch(`/api/chatbot/user?${params.toString()}`, {
      cache: 'no-store',
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.message || 'Không thể tải dữ liệu chatbot.');
    }

    setConversations(payload.conversations || []);
    setActiveConversationId(payload.activeConversationId || null);
    setConversation(payload.conversation || null);
    setRemainingMessages(Number(payload.remainingMessages ?? 0));
    setDailyLimit(Number(payload.dailyLimit ?? 5));
    return payload;
  }

  async function createConversation() {
    setLoading(true);
    try {
      const response = await fetch('/api/chatbot/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_conversation' }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể tạo cuộc trò chuyện mới.');
      }

      setConversations(payload.conversations || []);
      setActiveConversationId(payload.activeConversationId || null);
      setConversation(payload.conversation || null);
      setRemainingMessages(Number(payload.remainingMessages ?? 0));
      setDailyLimit(Number(payload.dailyLimit ?? 5));
      setCitations([]);
      return payload;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể tạo cuộc trò chuyện mới.');
      return null;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        const payload = await loadConversationData();
        if (
          active &&
          Array.isArray(payload.conversations) &&
          payload.conversations.length === 0 &&
          !didAutoCreateRef.current
        ) {
          didAutoCreateRef.current = true;
          await createConversation();
        }
      } catch (error) {
        if (active) {
          toast.error(error instanceof Error ? error.message : 'Không thể tải chatbot.');
        }
      } finally {
        if (active) {
          setBooting(false);
        }
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const viewport = messageViewportRef.current;
    if (!viewport) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior: 'smooth',
      });
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [visibleMessages.length, loading]);

  async function handleSelectConversation(conversationId: string) {
    if (loading) {
      return;
    }

    setLoading(true);
    try {
      await loadConversationData(conversationId);
      setCitations([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể mở cuộc trò chuyện.');
    } finally {
      setLoading(false);
    }
  }

  async function submitQuestion(question: string) {
    const content = question.trim();
    if (!content || loading) {
      return;
    }

    let nextConversationId = activeConversationId || conversations[0]?.id || null;
    if (!nextConversationId) {
      const created = await createConversation();
      nextConversationId = created?.activeConversationId || created?.conversation?.id || null;
    }

    if (!nextConversationId) {
      toast.error('Chưa tạo được cuộc trò chuyện để gửi tin nhắn.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/chatbot/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_message',
          conversationId: nextConversationId,
          content,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể gọi chatbot lúc này.');
      }

      setConversations(payload.conversations || []);
      setActiveConversationId(payload.activeConversationId || nextConversationId);
      setConversation(payload.conversation || null);
      setRemainingMessages(Number(payload.remainingMessages ?? 0));
      setDailyLimit(Number(payload.dailyLimit ?? 5));
      setInput('');
      setCitations(payload.citations || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể gọi chatbot lúc này.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell user={user} fullHeight>
      <div className="flex h-full flex-col overflow-hidden rounded-[2rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(242,246,255,0.94))] text-slate-900 shadow-[0_40px_120px_-60px_rgba(15,23,42,0.24)] dark:border-white/10 dark:bg-[#0b1020] dark:text-white dark:shadow-[0_40px_120px_-60px_rgba(15,23,42,0.95)]">
        <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col border-b border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,251,255,0.98),rgba(240,245,255,0.92))] px-4 py-4 lg:border-b-0 lg:border-r lg:border-r-slate-200/80 lg:overflow-hidden dark:border-white/8 dark:bg-[#090e19]/95 dark:lg:border-r-white/8">
            <div className="space-y-3">
              <div className="rounded-[1.7rem] border border-slate-200/80 bg-white/80 p-4 dark:border-white/8 dark:bg-white/[0.03]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400 dark:text-white/45">
                      Trợ lý người dùng
                    </div>
                    <div className="mt-2 text-xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                      Chatbot TRUNGTAMMMO
                    </div>
                  </div>
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
                    <Bot className="h-5 w-5" />
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Badge variant="info" className="rounded-full border-none bg-sky-500/15 px-3 py-1 text-sky-700 dark:text-sky-100">
                    AI hỗ trợ
                  </Badge>
                  <Badge variant="muted" className="rounded-full border-none bg-slate-100 px-3 py-1 text-slate-600 dark:bg-white/[0.06] dark:text-white/70">
                    {remainingMessages}/{dailyLimit} tin hôm nay
                  </Badge>
                </div>
              </div>

              <Button
                type="button"
                onClick={() => void createConversation()}
                disabled={loading}
                className="h-10 w-full justify-start rounded-2xl normal-case tracking-normal text-sm font-semibold"
              >
                <MessageSquarePlus className="mr-2 h-4 w-4" />
                Cuộc trò chuyện mới
              </Button>
            </div>

            <div className="custom-scrollbar mt-4 flex-1 space-y-6 overflow-y-auto pr-1">
              <section>
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-white/35">
                  <Clock3 className="h-3.5 w-3.5" />
                  Gần đây
                </div>
                <div className="mt-3 space-y-1.5">
                  {conversations.length === 0 ? (
                    <div className="rounded-[1.4rem] border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-400 dark:border-white/10 dark:text-white/45">
                      Chưa có cuộc trò chuyện nào.
                    </div>
                  ) : (
                    conversations.map((item) => (
                      <div key={item.id} className="group relative">
                        <button
                          type="button"
                          onClick={() => void handleSelectConversation(item.id)}
                        className={cn(
                          'w-full rounded-[1.4rem] border px-4 py-3 pr-10 text-left transition-all',
                          activeConversationId === item.id
                              ? 'border-sky-300/70 bg-sky-50 text-slate-950 shadow-[0_24px_60px_-42px_rgba(56,189,248,0.26)] dark:border-sky-400/30 dark:bg-sky-400/12 dark:text-white dark:shadow-[0_24px_60px_-42px_rgba(56,189,248,0.45)]'
                              : 'border-slate-200/80 bg-white/82 text-slate-600 hover:border-slate-300 hover:bg-white dark:border-white/8 dark:bg-white/[0.03] dark:text-white/75 dark:hover:border-white/15 dark:hover:bg-white/[0.05]'
                        )}
                      >
                        <div className="line-clamp-2 text-sm font-semibold leading-6">{item.title}</div>
                        <div className="mt-1 text-xs text-slate-400 dark:text-white/40">
                          {formatConversationMeta(item.updated_at, item.message_count)}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteConversation(item.id)}
                        className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-xl bg-transparent text-slate-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:text-white/20 dark:hover:bg-red-500/20 dark:hover:text-red-400"
                        title="Xóa cuộc trò chuyện"
                      >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </aside>

          <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.12),_transparent_32%),linear-gradient(180deg,#f8fbff_0%,#eff4ff_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.22),_transparent_32%),linear-gradient(180deg,#0d1323_0%,#090d17_100%)]">
            <div className="shrink-0 border-b border-slate-200/70 px-4 py-4 dark:border-white/8">
              <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-white/40">
                    Hội thoại hỗ trợ
                  </div>
                  <div className="mt-2 text-xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                    {conversation?.title || 'Cuộc trò chuyện mới'}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="muted" className="rounded-full border-none bg-slate-100 px-3 py-1 text-slate-600 dark:bg-white/[0.06] dark:text-white/70">
                    RAG nội bộ + lịch sử hội thoại
                  </Badge>
                  <Badge variant="info" className="rounded-full border-none bg-emerald-500/15 px-3 py-1 text-emerald-700 dark:text-emerald-100">
                    Hướng dẫn cho người dùng
                  </Badge>
                </div>
              </div>
            </div>

            <div ref={messageViewportRef} className="custom-scrollbar flex-1 min-h-0 overflow-y-auto">
              <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col px-4 pb-8 pt-6 sm:px-6">
              {booting ? (
                <div className="flex min-h-[50vh] items-center justify-center">
                  <div className="flex items-center gap-3 rounded-full border border-slate-200/80 bg-white/80 px-5 py-3 text-sm text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/70">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang tải chatbot...
                  </div>
                </div>
              ) : visibleMessages.length === 0 ? (
                <div className="flex min-h-[50vh] flex-1 flex-col items-center justify-center py-10 text-center">
                    <Badge variant="muted" className="rounded-full border-none bg-slate-100 px-4 py-1.5 text-slate-500 dark:bg-white/[0.06] dark:text-white/60">
                      Hỏi đáp theo tri thức RAG nội bộ
                    </Badge>
                    <h1 className="mt-6 max-w-3xl text-3xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-white sm:text-5xl">
                      Hôm nay bạn muốn hỏi gì về TRUNGTAMMMO?
                    </h1>
                    <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-500 dark:text-white/55 sm:text-base">
                      Chatbot dùng RAG để đọc tài liệu nội bộ về tổng quan hệ thống, tài khoản, nạp tiền, đơn hàng,
                      tài nguyên, module user và các tình huống hỗ trợ thường gặp. Bạn cứ hỏi theo nhu cầu thực tế,
                      AI sẽ ưu tiên trả lời từng bước rõ ràng.
                    </p>

                    <div className="mt-8 grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {latestSuggestions.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => void submitQuestion(prompt)}
                          disabled={loading || remainingMessages <= 0}
                          className="rounded-[1.5rem] border border-slate-200/80 bg-white/82 px-4 py-4 text-left text-sm font-medium leading-6 text-slate-700 transition-all hover:-translate-y-0.5 hover:border-brand-blue/30 hover:bg-white disabled:opacity-50 dark:border-white/8 dark:bg-white/[0.04] dark:text-white/80 dark:hover:border-white/15 dark:hover:bg-white/[0.06]"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>

                    {knowledgeGuides.length > 0 ? (
                      <div className="mt-8 w-full rounded-[1.7rem] border border-slate-200/80 bg-white/82 p-5 text-left dark:border-white/8 dark:bg-white/[0.04]">
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-white/45">
                          <FileText className="h-3.5 w-3.5" />
                          Nguồn tri thức RAG đang dùng
                        </div>
                        <div className="mt-4 grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                          {knowledgeGuides.map((doc) => (
                            <div
                              key={doc.id}
                              className="rounded-[1.3rem] border border-slate-200/80 bg-slate-50/70 p-4 dark:border-white/8 dark:bg-white/[0.03]"
                            >
                              <div className="text-sm font-semibold leading-6 text-slate-900 dark:text-white">
                                {doc.title}
                              </div>
                              <p className="mt-2 text-xs leading-6 text-slate-500 dark:text-white/55">
                                {doc.summary}
                              </p>
                              <Link
                                href={doc.downloadUrl}
                                target="_blank"
                                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-blue transition hover:opacity-80"
                              >
                                Mở PDF hướng dẫn
                                <ArrowUpRight className="h-3.5 w-3.5" />
                              </Link>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-6 py-2">
                    {visibleMessages.map((message) => (
                      <div
                        key={message.id}
                        className={cn('flex', message.role === 'assistant' ? 'justify-start' : 'justify-end')}
                      >
                        <div
                          className={cn(
                            'max-w-[92%] rounded-[1.75rem] px-5 py-4 shadow-[0_28px_80px_-52px_rgba(15,23,42,0.95)] sm:max-w-[82%]',
                            message.role === 'assistant'
                              ? 'border border-slate-200/80 bg-white/88 text-slate-900 shadow-[0_28px_80px_-52px_rgba(15,23,42,0.16)] dark:border-white/8 dark:bg-white/[0.045] dark:text-white dark:shadow-[0_28px_80px_-52px_rgba(15,23,42,0.95)]'
                              : 'border border-sky-400/20 bg-[linear-gradient(135deg,rgba(37,99,235,0.92),rgba(14,165,233,0.82))] text-white'
                          )}
                        >
                          <div className={cn('mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em]', message.role === 'assistant' ? 'text-slate-400 dark:text-white/45' : 'text-white/55')}>
                            {message.role === 'assistant' ? (
                              <>
                                <Bot className="h-3.5 w-3.5" />
                                TRUNGTAMMMO AI
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-3.5 w-3.5" />
                                Bạn
                              </>
                            )}
                          </div>
                          <MarkdownMessage content={message.content} className={message.role === 'assistant' ? 'text-slate-700 dark:text-white/90' : 'text-white/95'} />
                        </div>
                      </div>
                    ))}

                    {loading ? (
                      <div className="flex justify-start">
                        <div className="rounded-[1.6rem] border border-slate-200/80 bg-white/88 px-5 py-4 text-sm text-slate-500 dark:border-white/8 dark:bg-white/[0.045] dark:text-white/70">
                          <div className="flex items-center gap-3">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Chatbot đang xử lý câu hỏi...
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {citations.length > 0 ? (
                      <div className="rounded-[1.75rem] border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-400/20 dark:bg-emerald-400/10">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-100/80">
                          Nguồn RAG vừa dùng
                        </div>
                        <div className="mt-3 space-y-2">
                          {citations.map((citation, index) => (
                            <div
                              key={`${citation.documentTitle}-${citation.heading}-${index}`}
                              className="text-sm leading-6 text-emerald-700 dark:text-emerald-50/90"
                            >
                              {citation.documentTitle} • {citation.heading}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 z-10 shrink-0 border-t border-slate-200/70 bg-white/82 px-4 py-3 backdrop-blur-xl dark:border-white/8 dark:bg-[#0a0f1b]/88">
              <form
                className="mx-auto max-w-4xl"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitQuestion(input);
                }}
              >
                <div className="rounded-[1.5rem] border border-slate-200/80 bg-white/88 p-2.5 shadow-[0_28px_80px_-52px_rgba(15,23,42,0.18)] dark:border-white/10 dark:bg-white/[0.05] dark:shadow-[0_28px_80px_-52px_rgba(15,23,42,0.95)]">
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        void submitQuestion(input);
                      }
                    }}
                    placeholder="Ví dụ: Tôi muốn nạp tiền rồi mua tài nguyên thì nên thao tác theo thứ tự nào?"
                    className="min-h-[56px] w-full resize-none bg-transparent px-2 py-1.5 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-white/30"
                  />
                  <div className="flex flex-col gap-2 border-t border-slate-200/70 px-2 pt-2 sm:flex-row sm:items-center sm:justify-between dark:border-white/8">
                    <div className="space-y-0.5 text-xs leading-5 text-slate-500 dark:text-white/50">
                      <div>
                        {remainingMessages > 0
                          ? `Bạn còn ${remainingMessages}/${dailyLimit} tin nhắn trong hôm nay.`
                          : 'Bạn đã dùng hết quota chatbot người dùng trong hôm nay.'}
                      </div>
                      <div>RAG đang bám tài liệu nội bộ và lịch sử hội thoại để hướng dẫn theo từng bước cụ thể.</div>
                    </div>
                    <Button
                      type="submit"
                      disabled={!input.trim() || loading || remainingMessages <= 0}
                      loading={loading}
                      loadingText="Đang gửi..."
                      className="h-9 min-w-[130px] rounded-xl normal-case tracking-normal text-sm font-semibold"
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Gửi câu hỏi
                    </Button>
                  </div>
                </div>
              </form>
            </div>

          </section>
        </div>
      </div>
    </AppShell>
  );
}
