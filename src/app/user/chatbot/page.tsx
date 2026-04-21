import { UserChatbotPage } from '@/components/ai/user-chatbot-page';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function UserChatbotRoute() {
  const currentUser = await getCurrentUserForShell();

  return <UserChatbotPage user={currentUser.shell} />;
}
