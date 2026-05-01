import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { SocialConversationBoard } from '@/components/social/social-conversation-board';
import { getGameMarketChatContext } from '@/lib/game-market-actions';
import { getConversationAdvanced } from '@/lib/social';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

function getSearchParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value || '';
}

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ item?: string | string[]; order?: string | string[]; compose?: string | string[] }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const otherUserId = Number(id);
  if (!Number.isFinite(otherUserId) || otherUserId <= 0) notFound();

  const { raw, shell } = await getCurrentUserForShell();
  const itemId = Number(getSearchParamValue(resolvedSearchParams?.item));
  const orderId = Number(getSearchParamValue(resolvedSearchParams?.order));
  const compose = getSearchParamValue(resolvedSearchParams?.compose).trim().toLowerCase();

  const [conversation, tradeItem] = await Promise.all([
    getConversationAdvanced(raw.id, otherUserId),
    itemId > 0 ? getGameMarketChatContext(itemId) : Promise.resolve(null),
  ]);

  if (!conversation) notFound();

  const viewerIsSeller = tradeItem ? Number(tradeItem.seller_id || 0) === raw.id : false;
  const tradeTitle = tradeItem ? String(tradeItem.title || `Bài đăng #${tradeItem.id}`) : '';
  const contextCard = tradeItem ? {
    eyebrow:
      compose === 'handover-seller' || compose === 'handover-buyer'
        ? 'Bàn giao sau mua'
        : 'Chat thương lượng',
    title: orderId > 0 ? `${tradeTitle} · Order #${orderId}` : tradeTitle,
    description:
      compose === 'handover-seller'
        ? 'Bạn đang ở kênh bàn giao chính thức của đơn game này. Hãy gửi tài khoản, mật khẩu, mail, số điện thoại, mã dự phòng và mọi lưu ý đăng nhập ngay trong đoạn chat để người mua dễ đối soát.'
        : compose === 'handover-buyer'
          ? 'Bạn đang ở kênh nhận bàn giao chính thức của đơn game này. Hãy yêu cầu seller gửi đầy đủ tài khoản, mật khẩu, mail, số điện thoại và các thông tin đăng nhập ngay trong đoạn chat này.'
          : 'Hãy dùng đoạn chat này để thương lượng giá, xác nhận tình trạng account và thống nhất rõ cách bàn giao trước khi thanh toán.',
    href: `/user/game-market/${itemId}`,
    linkLabel: 'Mở bài đăng',
  } : undefined;

  const initialDraft = tradeItem ? (
    compose === 'handover-seller'
      ? `Mình bàn giao ${orderId > 0 ? `order #${orderId}` : `bài "${tradeTitle}"`} tại đây nhé:\n- Tài khoản:\n- Mật khẩu:\n- Mail / SĐT:\n- Mã dự phòng / backup:\n- Lưu ý đăng nhập thêm:`
      : compose === 'handover-buyer'
        ? `Mình đã thanh toán ${orderId > 0 ? `order #${orderId}` : `bài "${tradeTitle}"`}. Bạn vui lòng gửi tài khoản, mật khẩu, mail / số điện thoại và các thông tin đăng nhập liên quan qua đoạn chat này giúp mình nhé.`
        : `Chào ${String(conversation.other.fullname || conversation.other.username || 'bạn')}, mình đang quan tâm tới bài "${tradeTitle}". Mình muốn hỏi thêm vài thông tin trước khi chốt mua.`
  ) : (viewerIsSeller ? 'Mình gửi thông tin bàn giao cho bạn tại đây nhé.' : '');

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
          contextCard={contextCard}
          initialDraft={initialDraft}
        />
      </div>
    </AppShell>
  );
}
