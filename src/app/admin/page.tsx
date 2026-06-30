import { redirect } from 'next/navigation';
import { requireAdminPage } from '@/lib/admin-auth';
import { isOperatorAdminRole } from '@/lib/admin-permissions';

export default async function AdminRootPage() {
  const user = await requireAdminPage();
  redirect(isOperatorAdminRole(user.role) ? '/admin/orders' : '/admin/dashboard');
}
