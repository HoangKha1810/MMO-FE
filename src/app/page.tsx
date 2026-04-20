import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { LandingPage } from '@/components/marketing/landing-page';

export default async function RootPage() {
  const cookieStore = await cookies();
  const userId = Number(cookieStore.get('user_id')?.value || 0);

  if (userId) {
    redirect('/user/home');
  }

  return <LandingPage />;
}
