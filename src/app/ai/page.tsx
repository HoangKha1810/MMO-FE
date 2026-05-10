import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { buildAccessPageUrl } from '@/lib/access-page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AiBridgePage() {
  const cookieStore = await cookies();
  const userId = Number(cookieStore.get('user_id')?.value || 0);

  if (!userId) {
    redirect(buildAccessPageUrl({
      reason: 'login-required',
      area: 'user',
      next: '/ai',
    }));
  }

  const user = await db.users.findUnique({
    where: { id: userId },
    select: { role: true, status: true },
  });

  if (!user || user.status !== 'active') {
    redirect(buildAccessPageUrl({
      reason: 'login-required',
      area: 'user',
      next: '/ai',
    }));
  }

  const isAdmin = String(user.role || '').toLowerCase() === 'admin';
  redirect(isAdmin ? '/admin/ai' : '/user/chatbot');
}
