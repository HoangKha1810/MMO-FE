import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { LegacyActionForm } from '@/components/legacy/action-form';
import { getConversation } from '@/lib/legacy-modules';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

function dateLabel(value: unknown) {
  const date = new Date(String(value || ''));
  return Number.isNaN(date.getTime()) ? '...' : date.toLocaleString('vi-VN');
}

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const otherUserId = Number(id);
  if (!Number.isFinite(otherUserId) || otherUserId <= 0) notFound();

  const { raw, shell } = await getCurrentUserForShell();
  const conversation = await getConversation(raw.id, otherUserId);
  if (!conversation) notFound();

  return (
    <AppShell user={shell}>
      <div className="mx-auto max-w-5xl space-y-5">
        <Link href="/user/social/inbox" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-brand-blue">
          <ArrowLeft className="h-4 w-4" />
          Hộp thư
        </Link>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-900">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-white/5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-blue/10 text-brand-blue">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase text-slate-950 dark:text-white">{String(conversation.other.username || `User #${otherUserId}`)}</h1>
              <p className="text-xs font-bold text-slate-400">Rank {String(conversation.other.rank || 'Member')}</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {conversation.messages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm font-bold text-slate-400 dark:border-white/10">Chưa có hội thoại.</div>
            ) : conversation.messages.map((message) => {
              const mine = Number(message.sender_id) === raw.id;
              return (
                <div key={String(message.id)} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm font-semibold leading-6 ${mine ? 'bg-brand-blue text-white' : 'bg-slate-100 text-slate-700 dark:bg-white/5 dark:text-slate-200'}`}>
                    <div>{String(message.content || '')}</div>
                    <div className={`mt-2 text-[10px] font-black uppercase ${mine ? 'text-white/60' : 'text-slate-400'}`}>{dateLabel(message.created_at)}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 rounded-2xl bg-slate-50 p-4 dark:bg-white/[0.03]">
            <LegacyActionForm
              endpoint="/api/social/message"
              submitLabel="Gửi phản hồi"
              defaults={{ receiver_id: otherUserId }}
              fields={[
                { name: 'receiver_id', label: 'ID người nhận', type: 'number', required: true },
                { name: 'content', label: 'Nội dung', type: 'textarea', required: true },
              ]}
            />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
