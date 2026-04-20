import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { SocialConversationBoard } from '@/components/social/social-conversation-board';
import { getConversationAdvanced } from '@/lib/social';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const otherUserId = Number(id);
  if (!Number.isFinite(otherUserId) || otherUserId <= 0) notFound();

  const { raw, shell } = await getCurrentUserForShell();
  const conversation = await getConversationAdvanced(raw.id, otherUserId);
  if (!conversation) notFound();

  return (
    <AppShell user={shell}>
      <div className="mx-auto max-w-5xl space-y-5">
        <Link href="/user/social/inbox" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-brand-blue">
          <ArrowLeft className="h-4 w-4" />
          Hộp thư
        </Link>

        <SocialConversationBoard
          userId={raw.id}
          otherUserId={otherUserId}
          other={conversation.other}
          initialMessages={conversation.messages}
          blockedByMe={conversation.blockedByMe}
          blockedMe={conversation.blockedMe}
          typing={conversation.typing}
        />
      </div>
    </AppShell>
  );
}
