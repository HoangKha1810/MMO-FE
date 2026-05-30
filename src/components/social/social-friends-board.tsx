'use client';

import type { ReactNode } from 'react';
import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Search, ShieldBan, UserCheck, UserMinus, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { readJsonResponse } from '@/lib/client-api';

type SocialListItem = Record<string, unknown>;

interface SocialFriendsBoardProps {
  initialFriends: SocialListItem[];
  initialPending: SocialListItem[];
  initialBlocked: SocialListItem[];
  initialCounters: Record<string, unknown>;
}

async function callFriendAction(targetUserId: number, action: string) {
  const response = await fetch('/api/social/friend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_user_id: targetUserId, action }),
  });

  const payload = await readJsonResponse(response, 'Không thể xử lý kết nối');
  if (!payload.success) {
    throw new Error(payload.message || 'Không thể xử lý kết nối');
  }
  return payload;
}

async function searchDirectory(keyword: string) {
  const response = await fetch(`/api/social/message?mode=search&q=${encodeURIComponent(keyword)}`, {
    cache: 'no-store',
  });
  const payload = await readJsonResponse(response, 'Không thể tìm kiếm');
  if (!payload.success) {
    throw new Error(payload.message || 'Không thể tìm kiếm');
  }
  return payload.data as { users: SocialListItem[]; conversations: SocialListItem[] };
}

function PersonCard({
  item,
  children,
}: {
  item: SocialListItem;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-[1.6rem] border border-slate-200/80 bg-white/90 p-4 shadow-[0_24px_60px_-40px_rgba(15,23,42,0.25)] dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex items-start gap-4">
        <div className="h-14 w-14 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-blue to-cyan-400">
          {String(item.avatar || '') ? (
            <img src={String(item.avatar)} alt={String(item.username || 'avatar')} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-lg font-black text-white">
              {String(item.username || item.fullname || '?').slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-black uppercase tracking-[-0.03em] text-slate-950 dark:text-white">
            {String(item.fullname || item.username || `User #${item.id || item.friend_id}`)}
          </div>
          <div className="mt-1 truncate text-xs font-black uppercase tracking-[0.18em] text-slate-400">
            @{String(item.username || 'unknown')} · {String(item.rank || item.role || 'Member')}
          </div>
          {'unread_count' in item && Number(item.unread_count || 0) > 0 ? (
            <div className="mt-3 inline-flex rounded-full bg-brand-blue/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-brand-blue">
              {Number(item.unread_count)} chưa đọc
            </div>
          ) : null}
        </div>
      </div>
      {children ? <div className="mt-4 flex flex-wrap gap-2">{children}</div> : null}
    </div>
  );
}

export function SocialFriendsBoard({
  initialFriends,
  initialPending,
  initialBlocked,
  initialCounters,
}: SocialFriendsBoardProps) {
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState('');
  const [searchResult, setSearchResult] = useState<{ users: SocialListItem[]; conversations: SocialListItem[] }>({ users: [], conversations: [] });
  const [friends, setFriends] = useState(initialFriends);
  const [pending, setPending] = useState(initialPending);
  const [blocked, setBlocked] = useState(initialBlocked);
  const stats = useMemo(() => ([
    { label: 'Bạn bè', value: friends.filter((item) => String(item.status) === 'accepted').length || Number(initialCounters?.accepted || 0), icon: Users },
    { label: 'Chờ duyệt', value: pending.length || Number(initialCounters?.pendingRequests || 0), icon: UserPlus },
    { label: 'Đã chặn', value: blocked.length || Number(initialCounters?.blockedCount || 0), icon: ShieldBan },
  ]), [blocked.length, friends, initialCounters, pending.length]);

  async function runAction(targetUserId: number, action: string) {
    startTransition(async () => {
      try {
        const payload = await callFriendAction(targetUserId, action);
        toast.success(payload.message || 'Đã cập nhật');
        const refresh = await fetch('/api/social/friend', { cache: 'no-store' });
        const data = await readJsonResponse(refresh, 'Không tải được danh sách kết nối');
        if (data.success) {
          setFriends(data.data.friends || []);
          setPending(data.data.pending || []);
          setBlocked(data.data.blocked || []);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Không thể xử lý');
      }
    });
  }

  async function runSearch() {
    try {
      const data = await searchDirectory(search);
      setSearchResult(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể tìm kiếm');
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2 md:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-5 shadow-[0_30px_70px_-50px_rgba(15,23,42,0.4)] dark:border-white/10 dark:bg-white/[0.04]">
            <stat.icon className="h-5 w-5 text-brand-blue" />
            <div className="mt-3 text-3xl font-black tracking-[-0.05em] text-slate-950 dark:text-white">{stat.value}</div>
            <div className="mt-1 text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">{stat.label}</div>
          </div>
        ))}
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-5 shadow-[0_36px_80px_-55px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-white/[0.04]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-[1_1_100%] sm:min-w-[280px] sm:flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm user hoặc đoạn chat..."
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-bold tracking-[0.06em] text-slate-900 outline-none transition focus:border-brand-blue/40 dark:border-white/10 dark:bg-slate-950/50 dark:text-white"
            />
          </div>
          <Button type="button" onClick={runSearch} loading={isPending} loadingText="Đang tải">
            Quét social
          </Button>
        </div>
        {searchResult.users.length > 0 || searchResult.conversations.length > 0 ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Người dùng</div>
              {searchResult.users.map((user) => (
                <PersonCard key={`user-${String(user.id)}`} item={user}>
                  <Button size="sm" onClick={() => runAction(Number(user.id || 0), 'request')} loading={isPending}>
                    Kết bạn
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => runAction(Number(user.id || 0), 'block')} loading={isPending}>
                    Chặn
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={`/user/social/conversation/${String(user.id)}`}>Nhắn tin</Link>
                  </Button>
                </PersonCard>
              ))}
            </div>
            <div className="space-y-3">
              <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Hội thoại</div>
              {searchResult.conversations.map((conversation) => (
                <PersonCard key={`conversation-${String(conversation.id)}`} item={conversation}>
                  <Button size="sm" asChild>
                    <Link href={`/user/social/conversation/${String(conversation.other_id)}`}>Mở chat</Link>
                  </Button>
                </PersonCard>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-1">
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Lời mời đang chờ</div>
          {pending.length === 0 ? (
            <div className="rounded-[1.4rem] border border-dashed border-slate-300 p-6 text-sm font-bold text-slate-400 dark:border-white/10">Không có lời mời chờ duyệt.</div>
          ) : pending.map((item) => (
            <PersonCard key={`pending-${String(item.id)}`} item={item}>
              <Button size="sm" onClick={() => runAction(Number(item.requester || item.id || 0), 'accept')} loading={isPending}>
                <UserCheck className="mr-1 h-4 w-4" />
                Chấp nhận
              </Button>
              <Button size="sm" variant="outline" onClick={() => runAction(Number(item.requester || item.id || 0), 'decline')} loading={isPending}>
                Từ chối
              </Button>
            </PersonCard>
          ))}
        </div>

        <div className="space-y-3 xl:col-span-1">
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Bạn bè đã kết nối</div>
          {friends.length === 0 ? (
            <div className="rounded-[1.4rem] border border-dashed border-slate-300 p-6 text-sm font-bold text-slate-400 dark:border-white/10">Chưa có bạn bè.</div>
          ) : friends.map((item) => (
            <PersonCard key={`friend-${String(item.id)}`} item={item}>
              <Button size="sm" asChild>
                <Link href={`/user/social/conversation/${String(item.friend_id || item.id)}`}>Chat</Link>
              </Button>
              <Button size="sm" variant="outline" onClick={() => runAction(Number(item.friend_id || item.id || 0), 'remove')} loading={isPending}>
                <UserMinus className="mr-1 h-4 w-4" />
                Gỡ bạn
              </Button>
              <Button size="sm" variant="ghost" onClick={() => runAction(Number(item.friend_id || item.id || 0), 'block')} loading={isPending}>
                Chặn
              </Button>
            </PersonCard>
          ))}
        </div>

        <div className="space-y-3 xl:col-span-1">
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Danh sách chặn</div>
          {blocked.length === 0 ? (
            <div className="rounded-[1.4rem] border border-dashed border-slate-300 p-6 text-sm font-bold text-slate-400 dark:border-white/10">Bạn chưa chặn ai.</div>
          ) : blocked.map((item) => (
            <PersonCard key={`blocked-${String(item.id)}`} item={item}>
              <Button size="sm" variant="outline" onClick={() => runAction(Number(item.blocked_id || item.id || 0), 'unblock')} loading={isPending}>
                Gỡ chặn
              </Button>
            </PersonCard>
          ))}
        </div>
      </section>
    </div>
  );
}
