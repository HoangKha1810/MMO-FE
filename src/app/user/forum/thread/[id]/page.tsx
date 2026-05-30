import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Clock, Eye, Lock, MessageSquare, Pin, ShieldCheck } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { ForumPostActions, ForumThreadInteractions } from '@/components/forum/forum-thread-interactions';
import { buildLegacyAssetUrl } from '@/lib/legacy-settings';
import { getForumThreadDetails, isActiveForumStatus } from '@/lib/forum';
import { cn, formatNumber } from '@/lib/utils';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '...';
  }

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function isBlueTickActive(isBlueTick: unknown, expiry: Date | string | null) {
  if (!isBlueTick) {
    return false;
  }

  if (!expiry) {
    return true;
  }

  return new Date(expiry).getTime() > Date.now();
}

function roleClass(role: string | null) {
  const normalized = String(role || 'member').toLowerCase();
  const map: Record<string, string> = {
    admin: 'border-rose-500/20 bg-rose-500/10 text-rose-500',
    vip: 'border-amber-500/20 bg-amber-500/10 text-amber-500',
    pro: 'border-blue-500/20 bg-blue-500/10 text-blue-500',
    member: 'border-slate-500/20 bg-slate-500/10 text-slate-400',
  };

  return map[normalized] || map.member;
}

export default async function ForumThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const threadId = Number(id);
  if (!Number.isFinite(threadId) || threadId <= 0) {
    notFound();
  }

  const { raw, shell } = await getCurrentUserForShell();
  const data = await getForumThreadDetails(threadId, raw.id, String(raw.role || 'member'));

  if (!data) {
    notFound();
  }

  const { thread, posts } = data;
  const threadStatus = String(thread.status || 'active').toLowerCase();
  const isThreadActive = isActiveForumStatus(threadStatus);
  const replyLocked = Boolean(thread.is_locked) || !isThreadActive;

  return (
    <AppShell user={shell}>
      <div className="space-y-6">
        <div className="flex flex-wrap gap-3">
          <Link href={`/user/forum/forum/${thread.forum_id}`} className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-brand-blue">
            <ChevronLeft className="h-4 w-4" />
            {thread.forum_name || 'Folder'}
          </Link>
          <Link href="/user/forum" className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-brand-blue">
            Forum chính
          </Link>
        </div>

        <section className="relative overflow-hidden rounded-[2.25rem] border border-slate-200 bg-[#f7f1e6] p-7 shadow-sm dark:border-white/10 dark:bg-[#0c1422]">
          <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full bg-brand-blue/15 blur-3xl" />
          <div className="relative">
            <div className="flex flex-wrap items-center gap-2">
              {thread.is_pinned ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                  <Pin className="h-3.5 w-3.5" />
                  Ghim
                </span>
              ) : null}
              {thread.is_locked ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white dark:bg-white dark:text-slate-950">
                  <Lock className="h-3.5 w-3.5" />
                  Đã khóa
                </span>
              ) : null}
              {!isThreadActive ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                  Chờ admin duyệt
                </span>
              ) : null}
              <span className="rounded-full border border-slate-900/10 bg-white/55 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300">
                {thread.forum_name || thread.category_name || 'Forum'}
              </span>
            </div>
            <h1 className="mt-4 max-w-5xl text-3xl font-black uppercase leading-[1.2] tracking-[-0.04em] text-slate-950 dark:text-white md:text-5xl md:leading-[1.16]">
              {thread.title}
            </h1>
            <div className="mt-5 flex flex-wrap gap-4 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <span>By {thread.username || `User #${thread.user_id}`}</span>
              <span className="inline-flex items-center gap-1.5"><Eye className="h-4 w-4" /> {formatNumber(thread.views)} lượt xem</span>
              <span className="inline-flex items-center gap-1.5"><MessageSquare className="h-4 w-4" /> {formatNumber(Math.max(0, posts.length - 1))} trả lời</span>
              <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" /> {formatDate(thread.created_at)}</span>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <section className="space-y-4">
            {posts.length === 0 ? (
              <div className="rounded-[2rem] border border-dashed border-slate-300 p-10 text-center text-sm font-bold text-slate-400 dark:border-white/10">
                Thread này chưa có nội dung hiển thị.
              </div>
            ) : posts.map((post, index) => {
              const avatar = buildLegacyAssetUrl(post.avatar);
              const username = post.username || `User #${post.user_id}`;
              const hasTick = isBlueTickActive(post.is_blue_tick, post.blue_tick_expiry);

              return (
                <article
                  key={post.id}
                  id={`post-${post.id}`}
                  className={cn(
                    'overflow-hidden rounded-[1.5rem] border bg-white shadow-sm dark:bg-[#0f1726]',
                    index === 0 ? 'border-brand-blue/30 dark:border-brand-blue/30' : 'border-slate-200 dark:border-white/10'
                  )}
                >
                  <div className="grid gap-0 md:grid-cols-[180px_1fr]">
                    <aside className="border-b border-slate-100 bg-slate-50/70 p-5 dark:border-white/5 dark:bg-white/[0.03] md:border-b-0 md:border-r">
                      <div className="flex items-center gap-3 md:block">
                        <div className="h-14 w-14 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-blue to-blue-500 text-white md:h-20 md:w-20">
                          {avatar ? (
                            <img src={avatar} alt={username} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-2xl font-black">
                              {username.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 md:mt-4">
                          <div className="flex items-center gap-1.5 truncate text-sm font-black text-slate-950 dark:text-white">
                            {username}
                            {hasTick ? <ShieldCheck className="h-4 w-4 shrink-0 text-brand-blue" /> : null}
                          </div>
                          <span className={cn('mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest', roleClass(post.role))}>
                            {String(post.role || 'member')}
                          </span>
                        </div>
                      </div>
                      <div className="mt-5 hidden border-t border-slate-200 pt-4 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:border-white/10 md:block">
                        {formatNumber(post.user_posts_count)} bài viết
                      </div>
                    </aside>

                    <div className="p-5">
                      <div className="mb-4 flex items-center justify-between gap-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        <span>{formatDate(post.created_at)}</span>
                        {!isActiveForumStatus(post.status) ? (
                          <span className="rounded-full bg-orange-500/10 px-2 py-1 text-[10px] font-black text-orange-500">
                            Chờ duyệt
                          </span>
                        ) : null}
                        <span>#{index + 1}</span>
                      </div>
                      <div
                        className="forum-content min-h-20 text-sm leading-7 text-slate-700 dark:text-slate-300 [&_a]:font-bold [&_a]:text-brand-blue [&_img]:my-3 [&_img]:max-h-[460px] [&_img]:rounded-xl [&_p]:mb-3"
                        dangerouslySetInnerHTML={{ __html: post.content || '<p>Không có nội dung.</p>' }}
                      />
                      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-white/5">
                        <ForumPostActions postId={post.id} initialCount={post.total_reactions} />
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>

          <aside className="space-y-4">
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#0f1726]">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Thông tin</div>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-400">Folder</span>
                  <span className="text-right font-black text-brand-blue">{thread.forum_name || 'Forum'}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-400">Trạng thái</span>
                  <span className="font-black text-slate-900 dark:text-white">{thread.is_locked ? 'Đã khóa' : 'Đang mở'}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-400">Lượt xem</span>
                  <span className="font-black text-slate-900 dark:text-white">{formatNumber(thread.views)}</span>
                </div>
              </div>
            </div>
            <ForumThreadInteractions
              threadId={threadId}
              locked={replyLocked}
              disabledMessage={!isThreadActive ? 'Thread đang chờ admin duyệt nên chưa thể phản hồi thêm.' : undefined}
            />
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
