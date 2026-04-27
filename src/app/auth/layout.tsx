import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionCookieState } from '@/lib/admin-auth';
import { buildAccessPageUrl } from '@/lib/access-page';

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

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionCookieState();

  if (session.hasUserSession && !session.hasPending2fa) {
    redirect(buildAccessPageUrl({
      reason: 'already-authenticated',
      area: 'auth',
    }));
  }

  return children;
}
