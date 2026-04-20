import Link from 'next/link';
import { MessageCircle, Send, ShieldAlert, UsersRound } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { LegacyActionForm } from '@/components/legacy/action-form';
import { getSocialInbox } from '@/lib/legacy-modules';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

function dateLabel(value: unknown) {
  const date = new Date(String(value || ''));
  return Number.isNaN(date.getTime()) ? '...' : date.toLocaleString('vi-VN');
}

export default async function SocialInboxPage() {
  const { raw, shell } = await getCurrentUserForShell();
  const inbox = await getSocialInbox(raw.id);

  return (
    <AppShell user={shell}>
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-[2.25rem] border border-slate-200 bg-[#f7f3ea] p-7 dark:border-white/10 dark:bg-[#101520]">
          <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-brand-blue/10 blur-3xl" />
          <div className="relative grid gap-5 lg:grid-cols-[1fr_360px]">
            <div>
              <div className="inline-flex rounded-full bg-brand-blue/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-brand-blue">Social messenger</div>
              <h1 className="mt-4 text-4xl font-black uppercase tracking-[-0.06em] text-slate-950 dark:text-white md:text-5xl">Hộp thư legacy, đọc từ MySQL thật</h1>
              <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-slate-600 dark:text-slate-300">
                Tin nhắn, bạn bè và block list được nối trực tiếp từ bảng private_messages, friendships, msg_blocks.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/user/social/friends" className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-black uppercase text-white dark:bg-white dark:text-slate-950">Bạn bè</Link>
                <Link href="/user/forum/members" className="rounded-xl border border-slate-200 bg-white/70 px-4 py-2 text-xs font-black uppercase text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">Tìm thành viên</Link>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Tin nhắn', value: inbox.messages.length, icon: MessageCircle },
                { label: 'Bạn bè', value: inbox.friends.length, icon: UsersRound },
                { label: 'Đã chặn', value: inbox.blocked.length, icon: ShieldAlert },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/70 bg-white/60 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                  <stat.icon className="h-4 w-4 text-brand-blue" />
                  <div className="mt-3 text-2xl font-black text-slate-950 dark:text-white">{stat.value}</div>
                  <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-500">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <div className="space-y-3">
            {inbox.messages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm font-bold text-slate-400 dark:border-white/10">Chưa có tin nhắn.</div>
            ) : inbox.messages.map((message) => {
              const otherId = Number(message.sender_id) === raw.id ? Number(message.receiver_id) : Number(message.sender_id);
              const title = Number(message.sender_id) === raw.id ? String(message.receiver_username || `User #${otherId}`) : String(message.sender_username || `User #${otherId}`);
              return (
                <Link key={String(message.id)} href={`/user/social/conversation/${otherId}`} className="block rounded-[1.5rem] border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-brand-blue/40 dark:border-white/10 dark:bg-slate-900">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-black uppercase text-slate-950 dark:text-white">{title}</div>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{String(message.content || '')}</p>
                    </div>
                    <span className="shrink-0 text-[10px] font-black uppercase text-slate-400">{dateLabel(message.created_at)}</span>
                  </div>
                </Link>
              );
            })}
          </div>

          <aside className="rounded-[1.75rem] border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-2 text-sm font-black uppercase text-slate-950 dark:text-white">
              <Send className="h-4 w-4 text-brand-blue" />
              Gửi nhanh
            </div>
            <LegacyActionForm
              endpoint="/api/social/message"
              submitLabel="Gửi tin"
              fields={[
                { name: 'receiver_id', label: 'ID người nhận', type: 'number', required: true },
                { name: 'content', label: 'Nội dung', type: 'textarea', required: true },
              ]}
            />
          </aside>
        </section>
      </div>
    </AppShell>
  );
}
