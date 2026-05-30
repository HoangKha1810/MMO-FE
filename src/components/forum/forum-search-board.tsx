'use client';

import { useDeferredValue, useEffect, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { readJsonResponse } from '@/lib/client-api';

type SearchRow = Record<string, unknown>;

interface ForumSearchBoardProps {
  initialKeyword: string;
  initialThreads: SearchRow[];
  initialPosts: SearchRow[];
}

export function ForumSearchBoard({ initialKeyword, initialThreads, initialPosts }: ForumSearchBoardProps) {
  const [keyword, setKeyword] = useState(initialKeyword);
  const [threads, setThreads] = useState(initialThreads);
  const [posts, setPosts] = useState(initialPosts);
  const deferredKeyword = useDeferredValue(keyword.trim());

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const response = await fetch(`/api/forum/search?q=${encodeURIComponent(deferredKeyword)}`, { cache: 'no-store' });
        const payload = await readJsonResponse(response, 'Không tìm kiếm được forum');
        if (!cancelled) {
          if (payload.success) {
            setThreads(payload.data.threads || []);
            setPosts(payload.data.posts || []);
          } else {
            toast.error(payload.message || 'Không tìm kiếm được forum');
          }
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : 'Không tìm kiếm được forum');
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [deferredKeyword]);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
        <Search className="h-7 w-7 text-brand-blue" />
        <h1 className="mt-3 text-3xl font-black uppercase tracking-[-0.04em] text-slate-950 dark:text-white">Tìm kiếm forum realtime</h1>
        <div className="mt-5">
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Nhập từ khóa..."
            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-950 dark:text-white">Threads</h2>
          <div className="mt-4 space-y-3">
            {threads.length === 0 ? <p className="text-sm text-slate-400">Không có thread phù hợp.</p> : threads.map((thread) => (
              <Link key={String(thread.id)} href={`/user/forum/thread/${String(thread.id)}`} className="block rounded-xl bg-slate-50 p-4 dark:bg-white/5">
                <div className="font-black text-slate-950 dark:text-white">{String(thread.title)}</div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{String(thread.forum_name || 'Forum')} · {String(thread.username || '')}</div>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-950 dark:text-white">Posts</h2>
          <div className="mt-4 space-y-3">
            {posts.length === 0 ? <p className="text-sm text-slate-400">Không có post phù hợp.</p> : posts.map((post) => (
              <Link key={String(post.id)} href={`/user/forum/thread/${String(post.thread_id)}#post-${String(post.id)}`} className="block rounded-xl bg-slate-50 p-4 dark:bg-white/5">
                <div className="font-black text-slate-950 dark:text-white">{String(post.title)}</div>
                <p className="mt-2 line-clamp-2 text-sm leading-7 text-slate-500 dark:text-slate-400">{String(post.content || '')}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
