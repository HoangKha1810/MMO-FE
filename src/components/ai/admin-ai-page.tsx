'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Bot, Database, FileKey2, FileSearch, FileText, Loader2, MessageSquarePlus, Send, ShieldAlert, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MarkdownMessage } from '@/components/ui/markdown-message';
import { cn } from '@/lib/utils';

interface DocumentCatalogItem {
  id: string;
  title: string;
  summary: string;
  downloadUrl: string;
}

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

interface ToolTrailItem {
  name: string;
  input: Record<string, unknown>;
  output: unknown;
}

interface AdminAiPageProps {
  documents: DocumentCatalogItem[];
}

const adminPrompts = [
  'Cho tôi danh sách các bảng liên quan đến tài nguyên và tóm tắt vai trò của chúng.',
  'Đọc file .env và cho tôi biết các biến quan trọng của app.',
  'Mô tả schema của bảng users và transactions.',
  'Kiểm tra các bảng ai_* hiện có trong database.',
  'Tìm trong code route nạp tiền và tóm tắt luồng xử lý.',
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

export function AdminAiPage({ documents }: AdminAiPageProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [toolTrail, setToolTrail] = useState<ToolTrailItem[]>([]);
  const didAutoCreateRef = useRef(false);
  const messageViewportRef = useRef<HTMLDivElement | null>(null);
  const knowledgeDocs = useMemo(() => documents, [documents]);

  async function deleteConversation(conversationId: string) {
    try {
      const response = await fetch('/api/admin/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_conversation', conversationId }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message);
      setConversations(payload.conversations || []);
      setActiveConversationId(payload.activeConversationId || null);
      setConversation(payload.conversation || null);
      setToolTrail([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể xóa cuộc trò chuyện.');
    }
  }

  const toolCapabilities = useMemo(
    () => [
      {
        icon: Database,
        title: 'Đọc database an toàn',
        description: 'Liệt kê bảng, xem schema và chạy SELECT hoặc SHOW để kiểm tra dữ liệu mà không ghi đè.',
      },
      {
        icon: FileKey2,
        title: 'Kiểm tra cấu hình môi trường',
        description: 'Đọc biến môi trường hoặc file .env để xác minh key, domain, webhook và các cấu hình quan trọng.',
      },
      {
        icon: FileSearch,
        title: 'Đọc file và route xử lý',
        description: 'Tìm text và đọc file code trong workspace để debug, audit luồng xử lý hoặc truy vết lỗi.',
      },
    ],
    []
  );

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

    const response = await fetch(`/api/admin/ai?${params.toString()}`, {
      cache: 'no-store',
    });
    const payload = await response.json();
    if (!response.ok || !payload.success) {
      throw new Error(payload.message || 'Không thể tải dữ liệu AI admin.');
    }

    setConversations(payload.conversations || []);
    setActiveConversationId(payload.activeConversationId || null);
    setConversation(payload.conversation || null);
    return payload;
  }

  async function createConversation() {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/ai', {
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
      setToolTrail([]);
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
          toast.error(error instanceof Error ? error.message : 'Không thể tải AI admin.');
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
  }, [visibleMessages.length, loading, toolTrail.length]);

  async function handleSelectConversation(conversationId: string) {
    if (loading) {
      return;
    }

    setLoading(true);
    try {
      await loadConversationData(conversationId);
      setToolTrail([]);
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
      const response = await fetch('/api/admin/ai', {
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
        throw new Error(payload.message || 'Không thể gọi AI admin.');
      }

      setConversations(payload.conversations || []);
      setActiveConversationId(payload.activeConversationId || nextConversationId);
      setConversation(payload.conversation || null);
      setToolTrail(payload.toolTrail || []);
      setInput('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể gọi AI admin.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[2rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(242,246,255,0.94))] text-slate-900 shadow-[0_40px_120px_-60px_rgba(15,23,42,0.24)] dark:border-white/10 dark:bg-[linear-gradient(180deg,#0d1323_0%,#090d17_100%)] dark:text-white dark:shadow-[0_40px_120px_-60px_rgba(15,23,42,0.95)]">
      <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-b border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,251,255,0.98),rgba(240,245,255,0.92))] px-4 py-4 lg:border-b-0 lg:border-r lg:border-r-slate-200/80 lg:overflow-hidden dark:border-white/8 dark:bg-[linear-gradient(180deg,rgba(10,15,27,0.98),rgba(8,12,22,0.95))] dark:lg:border-r-white/8">
          <div className="space-y-3">
            <div className="rounded-[1.7rem] border border-slate-200/80 bg-white/80 p-4 dark:border-white/8 dark:bg-[#111827]/82">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400 dark:text-white/45">
                    AI nội bộ
                  </div>
                  <div className="mt-2 text-xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                    OpenAI Admin Console
                  </div>
                </div>
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                  <ShieldAlert className="h-5 w-5" />
                </span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge variant="danger" className="rounded-full border-none bg-rose-500/15 px-3 py-1 text-rose-700 dark:text-rose-100">
                  Admin only
                </Badge>
                <Badge variant="muted" className="rounded-full border-none bg-slate-100 px-3 py-1 text-slate-600 dark:bg-white/[0.08] dark:text-white/70">
                  Không giới hạn tin nhắn
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

          <div className="custom-scrollbar mt-4 flex-1 overflow-y-auto pr-1">
            <section>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-white/35">
                Phiên gần đây
              </div>
              <div className="mt-3 space-y-1.5">
                {conversations.length === 0 ? (
                  <div className="rounded-[1.4rem] border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-400 dark:border-white/10 dark:bg-[#0f1627]/65 dark:text-white/45">
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
                            ? 'border-emerald-300/70 bg-emerald-50 text-slate-950 shadow-[0_24px_60px_-42px_rgba(16,185,129,0.26)] dark:border-emerald-400/30 dark:bg-emerald-400/12 dark:text-white dark:shadow-[0_24px_60px_-42px_rgba(16,185,129,0.45)]'
                            : 'border-slate-200/80 bg-white/82 text-slate-600 hover:border-slate-300 hover:bg-white dark:border-white/8 dark:bg-[#0f1627]/78 dark:text-white/75 dark:hover:border-white/15 dark:hover:bg-[#141c30]'
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

        <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_28%),linear-gradient(180deg,#f8fbff_0%,#eef6ff_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_28%),linear-gradient(180deg,#0d1323_0%,#090d17_100%)]">
          <div className="shrink-0 border-b border-slate-200/70 px-4 py-4 dark:border-white/8">
            <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-white/40">
                  Bảng điều khiển admin
                </div>
                <div className="mt-2 text-xl font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                  {conversation?.title || 'Cuộc trò chuyện nội bộ mới'}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="muted" className="rounded-full border-none bg-slate-100 px-3 py-1 text-slate-600 dark:bg-white/[0.06] dark:text-white/70">
                  RAG nội bộ + tool quản trị
                </Badge>
                <Badge variant="danger" className="rounded-full border-none bg-amber-500/15 px-3 py-1 text-amber-700 dark:text-amber-100">
                  DB / ENV / File / Action
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
                    Đang tải AI admin...
                  </div>
                </div>
              ) : visibleMessages.length === 0 ? (
                <div className="flex min-h-[50vh] flex-1 flex-col items-center justify-center py-10 text-center">
                  <Badge variant="muted" className="rounded-full border-none bg-slate-100 px-4 py-1.5 text-slate-500 dark:bg-white/[0.06] dark:text-white/60">
                    Công cụ vận hành nội bộ
                  </Badge>
                  <h1 className="mt-6 max-w-3xl text-3xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-white sm:text-5xl">
                    Bạn cần kiểm tra hệ thống nào hôm nay?
                  </h1>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-500 dark:text-white/55 sm:text-base">
                    AI admin dùng RAG trên tài liệu nội bộ để nắm ngữ cảnh hệ thống, tài khoản user, giao dịch,
                    đơn hàng và playbook thao tác. Sau đó mới đọc schema, file, cấu hình hoặc chạy tool quản trị khi
                    admin yêu cầu rõ ràng. Mặc định vẫn ưu tiên chế độ chỉ đọc để tránh thay đổi ngoài ý muốn.
                  </p>

                  <div className="mt-8 grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {adminPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => void submitQuestion(prompt)}
                        disabled={loading}
                        className="rounded-[1.5rem] border border-slate-200/80 bg-white/82 px-4 py-4 text-left text-sm font-medium leading-6 text-slate-700 transition-all hover:-translate-y-0.5 hover:border-brand-blue/30 hover:bg-white disabled:opacity-50 dark:border-white/8 dark:bg-white/[0.04] dark:text-white/80 dark:hover:border-white/15 dark:hover:bg-white/[0.06]"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>

                  <div className="mt-8 grid w-full gap-4 xl:grid-cols-2">
                    <div className="rounded-[1.7rem] border border-slate-200/80 bg-white/82 p-5 text-left dark:border-white/8 dark:bg-white/[0.04]">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-white/45">
                        Năng lực admin AI
                      </div>
                      <div className="mt-4 grid gap-3">
                        {toolCapabilities.map((capability) => {
                          const Icon = capability.icon;
                          return (
                            <div
                              key={capability.title}
                              className="rounded-[1.3rem] border border-slate-200/80 bg-slate-50/70 p-4 dark:border-white/8 dark:bg-white/[0.03]"
                            >
                              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                                <Icon className="h-4 w-4 text-emerald-500" />
                                {capability.title}
                              </div>
                              <p className="mt-2 text-xs leading-6 text-slate-500 dark:text-white/55">
                                {capability.description}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-[1.7rem] border border-slate-200/80 bg-white/82 p-5 text-left dark:border-white/8 dark:bg-white/[0.04]">
                      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-white/45">
                        <FileText className="h-3.5 w-3.5" />
                        Nguồn tri thức RAG nội bộ
                      </div>
                      <div className="mt-4 grid gap-3">
                        {knowledgeDocs.map((doc) => (
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
                  </div>
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
                            : 'border border-emerald-400/20 bg-[linear-gradient(135deg,rgba(5,150,105,0.92),rgba(14,165,233,0.72))] text-white'
                          )}
                        >
                        <div className={cn('mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em]', message.role === 'assistant' ? 'text-slate-400 dark:text-white/45' : 'text-slate-500 dark:text-white/65')}>
                          {message.role === 'assistant' ? (
                            <>
                              <Bot className="h-3.5 w-3.5" />
                              OpenAI Admin
                            </>
                          ) : (
                            <>
                              <ShieldAlert className="h-3.5 w-3.5" />
                              Admin
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
                          AI admin đang phân tích và gọi tool nội bộ...
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {toolTrail.length > 0 ? (
                    <div className="rounded-[1.75rem] border border-amber-200 bg-amber-50 p-5 dark:border-amber-400/20 dark:bg-amber-400/10">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700 dark:text-amber-100/80">
                        Tool vừa được gọi
                      </div>
                      <div className="mt-4 space-y-3">
                        {toolTrail.map((item, index) => (
                          <div key={`${item.name}-${index}`} className="rounded-[1.35rem] border border-slate-200/80 bg-white/88 p-4 dark:border-white/8 dark:bg-[#0d1424]/80">
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-white/55">
                              {item.name}
                            </div>
                            <pre className="custom-scrollbar mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-[1rem] border border-slate-200 bg-slate-100 p-3 text-[11px] leading-6 text-slate-600 dark:border-white/8 dark:bg-black/20 dark:text-white/75">
{JSON.stringify(item.input, null, 2)}
                            </pre>
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
                    placeholder="Ví dụ: Đọc schema bảng transactions và giải thích luồng ghi nhận nạp tiền trong app."
                    className="min-h-[56px] w-full resize-none bg-transparent px-2 py-1.5 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-white/30"
                  />
                <div className="flex flex-col gap-2 border-t border-slate-200/70 px-2 pt-2 sm:flex-row sm:items-center sm:justify-between dark:border-white/8">
                  <div className="space-y-0.5 text-xs leading-5 text-slate-500 dark:text-white/50">
                    <div>AI này dùng RAG trên tài liệu nội bộ rồi mới đọc DB, file hoặc cấu hình để trả lời chính xác hơn.</div>
                    <div>Mọi lần gọi tool đều được ghi lại để audit nội bộ.</div>
                  </div>
                  <Button
                    type="submit"
                    disabled={!input.trim() || loading}
                    loading={loading}
                    loadingText="Đang gửi..."
                    className="h-9 min-w-[150px] rounded-xl normal-case tracking-normal text-sm font-semibold"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Gửi cho AI admin
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
