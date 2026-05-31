import Link from 'next/link';
import { Eye, MessageCircle, MessageSquare, Pin } from 'lucide-react';
import type { ForumThreadSummary } from '@/lib/forum';
import { formatDatabaseDateTime } from '@/lib/date-time';
import { formatNumber } from '@/lib/utils';

function formatDate(value: Date | string) {
  const formatted = formatDatabaseDateTime(value);
  return formatted ? formatted.replace(/^(\d{2}:\d{2}):\d{2}\s+/, '$1 ') : '...';
}

export function ForumThreadList({ threads, emptyText = 'Chưa có bài viết.' }: { threads: ForumThreadSummary[]; emptyText?: string }) {
  return (
    <div className="divide-y divide-slate-100 dark:divide-white/5">
      {threads.length === 0 ? (
        <div className="p-10 text-center text-sm font-bold text-slate-400">{emptyText}</div>
      ) : threads.map((thread) => (
        <Link
          key={thread.id}
          href={`/user/forum/thread/${thread.id}`}
          className={`group block p-5 transition-all hover:bg-slate-50 dark:hover:bg-white/[0.03] ${
            thread.is_pinned ? 'bg-amber-50/60 dark:bg-amber-400/[0.04]' : ''
          }`}
        >
          <div className="flex items-start gap-4">
            <div className={`mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
              thread.is_pinned
                ? 'bg-amber-500 text-white'
                : 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-300'
            }`}>
              {thread.is_pinned ? <Pin className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {thread.is_pinned ? (
                  <span className="rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                    Ghim
                  </span>
                ) : null}
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:bg-white/10 dark:text-slate-300">
                  {thread.forum_name || thread.category_name || 'Forum'}
                </span>
                <span className="text-[10px] font-bold uppercase text-slate-400">{formatDate(thread.updated_at)}</span>
              </div>
              <h3 className="mt-2 text-base font-black uppercase tracking-[-0.02em] text-slate-950 transition-colors group-hover:text-brand-blue dark:text-white">
                {thread.title}
              </h3>
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{thread.content}</p>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <span>By {thread.username || `User #${thread.user_id}`}</span>
                <span className="inline-flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" /> {formatNumber(thread.views)} views</span>
                <span className="inline-flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> {formatNumber(thread.replies)} replies</span>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
