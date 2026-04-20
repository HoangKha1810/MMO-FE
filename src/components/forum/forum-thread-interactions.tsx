'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Flag, HeartHandshake, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ForumThreadInteractions({
  threadId,
  locked,
  disabledMessage,
}: {
  threadId: number;
  locked: boolean;
  disabledMessage?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [content, setContent] = useState('');

  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0f1726]">
      <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Trả lời chủ đề</div>
      {locked ? (
        <div className="mt-4 rounded-[1.25rem] border border-amber-300/60 bg-amber-50/70 p-4 text-sm font-bold leading-7 text-amber-700 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200">
          {disabledMessage || 'Thread đang bị khóa nên hiện không thể phản hồi.'}
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={7}
            placeholder="Nhập phản hồi của bạn..."
            className="w-full rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-semibold leading-7 text-slate-900 outline-none transition focus:border-brand-blue/40 dark:border-white/10 dark:bg-slate-950/50 dark:text-white"
          />
          <div className="flex justify-end">
            <Button
              type="button"
              loading={isPending}
              onClick={() => {
                startTransition(async () => {
                  try {
                    const response = await fetch('/api/forum/post', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ thread_id: threadId, content }),
                    });
                    const payload = await response.json();
                    if (!response.ok || !payload.success) {
                      throw new Error(payload.message || 'Không phản hồi được');
                    }
                    toast.success(payload.message || 'Đã đăng phản hồi');
                    setContent('');
                    router.refresh();
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : 'Không phản hồi được');
                  }
                });
              }}
            >
              <Send className="mr-1 h-4 w-4" />
              Đăng phản hồi
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

export function ForumPostActions({
  postId,
  initialCount,
}: {
  postId: number;
  initialCount: number;
}) {
  const [count, setCount] = useState(initialCount);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [isPending, startTransition] = useTransition();

  function react() {
    startTransition(async () => {
      try {
        const response = await fetch('/api/forum/reaction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ post_id: postId, type: 'like' }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.message || 'Không thể reaction');
        }
        setCount(Number(payload.data?.total || 0));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Không thể reaction');
      }
    });
  }

  function report() {
    startTransition(async () => {
      try {
        const response = await fetch('/api/forum/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ post_id: postId, reason, details }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.message || 'Không thể report');
        }
        toast.success(payload.message || 'Đã gửi report');
        setReason('');
        setDetails('');
        setReportOpen(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Không thể report');
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={react}
          className="inline-flex items-center gap-2 rounded-xl border border-brand-blue/15 bg-brand-blue/5 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-brand-blue transition hover:border-brand-blue/30"
        >
          <HeartHandshake className="h-4 w-4" />
          Glow Up {count > 0 ? `(${count})` : ''}
        </button>
        <button
          type="button"
          onClick={() => setReportOpen((value) => !value)}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500 transition hover:border-rose-400/40 hover:text-rose-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300"
        >
          <Flag className="h-4 w-4" />
          Report
        </button>
      </div>

      {reportOpen ? (
        <div className="rounded-[1.25rem] border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
          <div className="grid gap-3">
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Lý do report"
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none dark:border-white/10 dark:bg-slate-950/50 dark:text-white"
            />
            <textarea
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              rows={4}
              placeholder="Mô tả thêm (không bắt buộc)"
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold leading-7 outline-none dark:border-white/10 dark:bg-slate-950/50 dark:text-white"
            />
            <div className="flex justify-end">
              <Button type="button" size="sm" loading={isPending} onClick={report}>
                Gửi report
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
