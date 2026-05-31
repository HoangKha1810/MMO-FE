import Link from 'next/link';
import { FilePenLine } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { formatDatabaseDateTime } from '@/lib/date-time';
import { listUserForumPosts } from '@/lib/forum-actions';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

export default async function UserForumPostsPage() {
  const { raw, shell } = await getCurrentUserForShell();
  const posts = (await listUserForumPosts(raw.id)) as Array<Record<string, unknown>>;

  return (
    <AppShell user={shell}>
      <div className="space-y-6">
        <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
          <FilePenLine className="h-7 w-7 text-brand-blue" />
          <h1 className="mt-3 text-3xl font-black uppercase tracking-[-0.04em] text-slate-950 dark:text-white">Bài viết của tôi</h1>
          <p className="mt-2 text-sm font-semibold leading-7 text-slate-500 dark:text-slate-400">
            Danh sách chủ đề, bài viết đầu tiên và các phản hồi bạn đã đăng trên Forum MMO.
          </p>
        </section>

        <div className="space-y-3">
          {posts.length === 0 ? (
            <div className="rounded-[1.6rem] border border-dashed border-slate-300 p-10 text-center text-sm font-bold text-slate-400 dark:border-white/10">
              Bạn chưa có bài viết nào trên forum.
            </div>
          ) : posts.map((post) => (
            <Link key={String(post.id)} href={`/user/forum/thread/${String(post.thread_id)}#post-${String(post.id)}`} className="block rounded-[1.6rem] border border-slate-200 bg-white/90 p-5 shadow-[0_22px_60px_-46px_rgba(15,23,42,0.35)] transition hover:border-brand-blue/30 dark:border-white/10 dark:bg-white/[0.04]">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-black uppercase tracking-[-0.03em] text-slate-950 dark:text-white">
                    {String(post.title || 'Không có tiêu đề')}
                  </div>
                  <div className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    {String(post.forum_name || 'Forum')} · {post.is_first_post ? 'Bài mở thread' : 'Bài trả lời'}
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm leading-7 text-slate-500 dark:text-slate-400">{String(post.preview || '')}</p>
                </div>
                <div className="shrink-0 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  {formatDatabaseDateTime(post.created_at)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
