'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Bell, MessageCircle, Search, ShieldAlert, UsersRound } from 'lucide-react';

type InboxItem = Record<string, unknown>;

interface SocialInboxBoardProps {
  initialMessages: InboxItem[];
  initialFriends: InboxItem[];
  initialBlocked: InboxItem[];
  initialAdminMessages: InboxItem[];
}

export function SocialInboxBoard({
  initialMessages,
  initialFriends,
  initialBlocked,
  initialAdminMessages,
}: SocialInboxBoardProps) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<{ users: InboxItem[]; conversations: InboxItem[] }>({ users: [], conversations: [] });
  const deferredQuery = useDeferredValue(query.trim());

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!deferredQuery) {
        setResult({ users: [], conversations: [] });
        return;
      }

      try {
        const response = await fetch(`/api/social/message?mode=search&q=${encodeURIComponent(deferredQuery)}`, { cache: 'no-store' });
        const payload = await response.json();
        if (!cancelled) {
          if (payload.success) {
            setResult(payload.data);
          } else {
            toast.error(payload.message || 'Không thể tìm kiếm social');
          }
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : 'Không thể tìm kiếm');
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [deferredQuery]);

  const stats = useMemo(() => [
    { label: 'Tin nhắn', value: initialMessages.length, icon: MessageCircle },
    { label: 'Bạn bè', value: initialFriends.length, icon: UsersRound },
    { label: 'Đã chặn', value: initialBlocked.length, icon: ShieldAlert },
    { label: 'Admin nhắn', value: initialAdminMessages.length, icon: Bell },
  ], [initialAdminMessages.length, initialBlocked.length, initialFriends.length, initialMessages.length]);

  return (
    <div className="space-y-6">
      <section className="grid gap-3 md:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-[1.7rem] border border-slate-200 bg-white/90 p-5 shadow-[0_24px_70px_-46px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-white/[0.04]">
            <stat.icon className="h-5 w-5 text-brand-blue" />
            <div className="mt-3 text-3xl font-black tracking-[-0.05em] text-slate-950 dark:text-white">{stat.value}</div>
            <div className="mt-1 text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">{stat.label}</div>
          </div>
        ))}
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-5 shadow-[0_32px_80px_-55px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-white/[0.04]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm theo user hoặc nội dung chat..."
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-bold tracking-[0.06em] text-slate-900 outline-none transition focus:border-brand-blue/40 dark:border-white/10 dark:bg-slate-950/50 dark:text-white"
          />
        </div>
        {deferredQuery ? (
          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Người dùng</div>
              {result.users.length === 0 ? (
                <div className="rounded-[1.3rem] border border-dashed border-slate-300 p-5 text-sm font-bold text-slate-400 dark:border-white/10">Không có user phù hợp.</div>
              ) : result.users.map((user) => (
                <Link key={`search-user-${String(user.id)}`} href={`/user/social/conversation/${String(user.id)}`} className="block rounded-[1.3rem] border border-slate-200 bg-slate-50/70 p-4 transition hover:border-brand-blue/30 dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="font-black uppercase tracking-[-0.03em] text-slate-950 dark:text-white">{String(user.fullname || user.username)}</div>
                  <div className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">@{String(user.username || 'unknown')}</div>
                </Link>
              ))}
            </div>
            <div className="space-y-3">
              <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Đoạn chat</div>
              {result.conversations.length === 0 ? (
                <div className="rounded-[1.3rem] border border-dashed border-slate-300 p-5 text-sm font-bold text-slate-400 dark:border-white/10">Không có đoạn chat phù hợp.</div>
              ) : result.conversations.map((conversation) => (
                <Link key={`search-conv-${String(conversation.id)}`} href={`/user/social/conversation/${String(conversation.other_id)}`} className="block rounded-[1.3rem] border border-slate-200 bg-slate-50/70 p-4 transition hover:border-brand-blue/30 dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="font-black uppercase tracking-[-0.03em] text-slate-950 dark:text-white">{String(conversation.username || conversation.fullname)}</div>
                  <p className="mt-2 text-sm leading-7 text-slate-500 dark:text-slate-400">{String(conversation.content || '')}</p>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {initialAdminMessages.length > 0 ? (
        <section className="rounded-[2rem] border border-amber-300/70 bg-amber-50/80 p-5 dark:border-amber-500/20 dark:bg-amber-500/10">
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-600 dark:text-amber-300">Tin nhắn admin</div>
          <div className="mt-4 grid gap-3">
            {initialAdminMessages.map((message) => (
              <div key={String(message.id)} className="rounded-[1.35rem] border border-amber-200/80 bg-white/70 p-4 dark:border-amber-500/15 dark:bg-black/10">
                <div className="text-sm font-semibold leading-7 text-slate-700 dark:text-slate-100">{String(message.message || '')}</div>
                <div className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-amber-600/80 dark:text-amber-300/80">
                  #{String(message.id)} · {String(message.status || 'active')}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        {initialMessages.length === 0 ? (
          <div className="rounded-[1.6rem] border border-dashed border-slate-300 p-10 text-center text-sm font-bold text-slate-400 dark:border-white/10">Chưa có hội thoại.</div>
        ) : initialMessages.map((message) => (
          <Link key={String(message.id)} href={`/user/social/conversation/${String(message.other_id)}`} className="block rounded-[1.6rem] border border-slate-200 bg-white/90 p-5 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.3)] transition hover:-translate-y-0.5 hover:border-brand-blue/35 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="truncate text-base font-black uppercase tracking-[-0.03em] text-slate-950 dark:text-white">
                  {String(message.fullname || message.username || `User #${message.other_id}`)}
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-7 text-slate-500 dark:text-slate-400">{String(message.content || '')}</p>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  {new Date(String(message.created_at || '')).toLocaleString('vi-VN')}
                </div>
                {Number(message.unread_count || 0) > 0 ? (
                  <div className="mt-2 inline-flex rounded-full bg-brand-blue/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-brand-blue">
                    {Number(message.unread_count)} unread
                  </div>
                ) : null}
              </div>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
