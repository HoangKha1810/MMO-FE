import type { Metadata } from 'next';
import { AdminShell } from '@/components/admin/admin-shell';
import { requireAdminPage } from '@/lib/admin-auth';

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

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();

  return <AdminShell>{children}</AdminShell>;
}
