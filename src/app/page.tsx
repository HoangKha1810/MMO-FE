import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { LandingPage } from '@/components/marketing/landing-page';
import { getVerifiedSessionUserId } from '@/lib/session-cookie';
import { siteDescription } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Nền tảng MMO đa dịch vụ',
  description: siteDescription,
  alternates: {
    canonical: '/',
  },
};

export default async function RootPage() {
  const userId = await getVerifiedSessionUserId();

  if (userId) {
    redirect('/user/home');
  }

  return <LandingPage />;
}
