import { AdminAiPage } from '@/components/ai/admin-ai-page';
import { getChatbotDocumentCatalog } from '@/lib/chatbot-knowledge';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function AdminAiRoute() {
  return <AdminAiPage documents={getChatbotDocumentCatalog()} />;
}
