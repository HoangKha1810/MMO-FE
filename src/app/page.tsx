import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { LandingPage } from '@/components/marketing/landing-page';
import { siteDescription } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Nền tảng MMO đa dịch vụ',
  description: siteDescription,
  alternates: {
    canonical: '/',
  },
};

export default async function RootPage() {
  const cookieStore = await cookies();
  const userId = Number(cookieStore.get('user_id')?.value || 0);

  if (userId) {
    redirect('/user/home');
  }

  return <LandingPage />;
}
