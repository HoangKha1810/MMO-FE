'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Database, FileKey2, FileSearch, FileText, Loader2, MessageSquarePlus, Send, ShieldAlert, Trash2 } from 'lucide-react';
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
        title: 'Database read-only',
        description: 'Liệt kê bảng, xem schema và chạy SELECT hoặc SHOW để kiểm tra dữ liệu.',
      },
      {
        icon: FileKey2,
        title: 'Env access',
        description: 'Đọc key môi trường hoặc toàn bộ file .env khi cần xác minh cấu hình.',
      },
      {
        icon: FileSearch,
        title: 'Workspace file search',
        description: 'Tìm text và đọc file code trong workspace để debug hoặc audit luồng xử lý.',
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
    <div className="flex h-full flex-col overflow-hidden rounded-[2rem] border border-slate-200/70 bg-[#0b1020] text-white shadow-[0_40px_120px_-60px_rgba(15,23,42,0.95)] dark:border-white/10">
      <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-b border-white/8 bg-[#090e19]/95 px-4 py-4 lg:border-b-0 lg:border-r lg:overflow-hidden">
          <div className="space-y-3">
            <div className="rounded-[1.7rem] border border-white/8 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/45">
                    AI nội bộ
                  </div>
                  <div className="mt-2 text-xl font-semibold tracking-[-0.03em] text-white">
                    OpenAI Admin Console
                  </div>
                </div>
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                  <ShieldAlert className="h-5 w-5" />
                </span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge variant="danger" className="rounded-full border-none bg-rose-500/15 px-3 py-1 text-rose-100">
                  Admin only
                </Badge>
                <Badge variant="muted" className="rounded-full border-none bg-white/[0.06] px-3 py-1 text-white/70">
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
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/35">
                Phiên gần đây
              </div>
              <div className="mt-3 space-y-1.5">
                {conversations.length === 0 ? (
                  <div className="rounded-[1.4rem] border border-dashed border-white/10 px-4 py-4 text-sm text-white/45">
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
                            ? 'border-emerald-400/30 bg-emerald-400/12 text-white shadow-[0_24px_60px_-42px_rgba(16,185,129,0.45)]'
                            : 'border-white/8 bg-white/[0.03] text-white/75 hover:border-white/15 hover:bg-white/[0.05]'
                        )}
                      >
                        <div className="line-clamp-2 text-sm font-semibold leading-6">{item.title}</div>
                        <div className="mt-1 text-xs text-white/40">
                          {formatConversationMeta(item.updated_at, item.message_count)}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteConversation(item.id)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-xl bg-transparent text-white/20 opacity-0 transition-all hover:bg-red-500/20 hover:text-red-400 group-hover:opacity-100"
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

        <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_28%),linear-gradient(180deg,#0d1323_0%,#090d17_100%)]">
          <div className="shrink-0 border-b border-white/8 px-4 py-4">
            <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">
                  Bảng điều khiển admin
                </div>
                <div className="mt-2 text-xl font-semibold tracking-[-0.03em] text-white">
                  {conversation?.title || 'Cuộc trò chuyện nội bộ mới'}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="muted" className="rounded-full border-none bg-white/[0.06] px-3 py-1 text-white/70">
                  OpenAI + docs + tool nội bộ
                </Badge>
                <Badge variant="danger" className="rounded-full border-none bg-amber-500/15 px-3 py-1 text-amber-100">
                  DB / ENV / File / Action
                </Badge>
              </div>
            </div>
          </div>

          <div ref={messageViewportRef} className="custom-scrollbar flex-1 min-h-0 overflow-y-auto">
            <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col px-4 pb-8 pt-6 sm:px-6">
              {booting ? (
                <div className="flex min-h-[50vh] items-center justify-center">
                  <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm text-white/70">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang tải AI admin...
                  </div>
                </div>
              ) : visibleMessages.length === 0 ? (
                <div className="flex min-h-[50vh] flex-1 flex-col items-center justify-center py-10 text-center">
                  <Badge variant="muted" className="rounded-full border-none bg-white/[0.06] px-4 py-1.5 text-white/60">
                    Công cụ vận hành nội bộ
                  </Badge>
                  <h1 className="mt-6 max-w-3xl text-3xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
                    Bạn cần kiểm tra hệ thống nào hôm nay?
                  </h1>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-white/55 sm:text-base">
                    AI admin có thể đọc docs nội bộ, xem schema, đọc file workspace, kiểm tra cấu hình môi trường
                    và thực thi action quản trị hoặc fix hệ thống khi admin ra lệnh rõ ràng. Mặc định AI vẫn ưu tiên
                    chế độ chỉ đọc để tránh thay đổi ngoài ý muốn.
                  </p>

                  <div className="mt-8 grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {adminPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => void submitQuestion(prompt)}
                        disabled={loading}
                        className="rounded-[1.5rem] border border-white/8 bg-white/[0.04] px-4 py-4 text-left text-sm font-medium leading-6 text-white/80 transition-all hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/[0.06] disabled:opacity-50"
                      >
                        {prompt}
                      </button>
                    ))}
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
                            ? 'border border-white/8 bg-white/[0.045] text-white'
                            : 'border border-emerald-400/20 bg-[linear-gradient(135deg,rgba(5,150,105,0.92),rgba(14,165,233,0.72))] text-white'
                        )}
                      >
                        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
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
                        <MarkdownMessage content={message.content} className="text-white/90" />
                      </div>
                    </div>
                  ))}

                  {loading ? (
                    <div className="flex justify-start">
                      <div className="rounded-[1.6rem] border border-white/8 bg-white/[0.045] px-5 py-4 text-sm text-white/70">
                        <div className="flex items-center gap-3">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          AI admin đang phân tích và gọi tool nội bộ...
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {toolTrail.length > 0 ? (
                    <div className="rounded-[1.75rem] border border-amber-400/20 bg-amber-400/10 p-5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-100/80">
                        Tool vừa được gọi
                      </div>
                      <div className="mt-4 space-y-3">
                        {toolTrail.map((item, index) => (
                          <div key={`${item.name}-${index}`} className="rounded-[1.35rem] border border-white/8 bg-[#0d1424]/80 p-4">
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
                              {item.name}
                            </div>
                            <pre className="custom-scrollbar mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-[1rem] border border-white/8 bg-black/20 p-3 text-[11px] leading-6 text-white/75">
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

          <div className="sticky bottom-0 z-10 shrink-0 border-t border-white/8 bg-[#0a0f1b]/88 px-4 py-3 backdrop-blur-xl">
            <form
              className="mx-auto max-w-4xl"
              onSubmit={(event) => {
                event.preventDefault();
                void submitQuestion(input);
              }}
            >
              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.05] p-2.5 shadow-[0_28px_80px_-52px_rgba(15,23,42,0.95)]">
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
                  className="min-h-[56px] w-full resize-none bg-transparent px-2 py-1.5 text-sm leading-6 text-white outline-none placeholder:text-white/30"
                />
                <div className="flex flex-col gap-2 border-t border-white/8 px-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-0.5 text-xs leading-5 text-white/50">
                    <div>AI này có quyền đọc dữ liệu nhạy cảm nội bộ và có thể dùng quyền cao khi admin ra lệnh thay đổi rõ ràng.</div>
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
