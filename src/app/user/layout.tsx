import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { getVerifiedSessionUserId } from '@/lib/session-cookie';
import { isSupportTikTokStaffRole } from '@/lib/support-tiktok';
import { UserLayoutContent } from './user-layout-content';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

const SUPPORT_TIKTOK_USER_PATH_PREFIXES = ['/user/support-tiktok'];

function canSupportTikTokOpenUserPath(pathname: string) {
  return SUPPORT_TIKTOK_USER_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const userId = await getVerifiedSessionUserId();

  if (userId) {
    const [headerStore, user] = await Promise.all([
      headers(),
      db.users.findUnique({
        where: { id: userId },
        select: { role: true, status: true },
      }).catch(() => null),
    ]);
    const pathname = headerStore.get('x-pathname') || '/user/home';

    if (
      user &&
      String(user.status || '').trim().toLowerCase() === 'active' &&
      isSupportTikTokStaffRole(user.role) &&
      !canSupportTikTokOpenUserPath(pathname)
    ) {
      redirect('/user/support-tiktok');
    }
  }

  return <UserLayoutContent>{children}</UserLayoutContent>;
}
