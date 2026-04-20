import { unstable_noStore as noStore } from 'next/cache';
import { AdminDashboardRealtime } from '@/components/admin/admin-dashboard-realtime';
import { getAdminDashboardStats } from '@/lib/admin-dashboard-stats';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminDashboardPage() {
  noStore();
  const stats = await getAdminDashboardStats();

  return <AdminDashboardRealtime initialStats={stats} />;
}
