import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminCheckIpPage() {
  return <AdminDataPage title="Check IP" description="Kiểm tra IP kiểu legacy: số tài khoản theo IP, ban/mở ban, blacklist và khóa/mở user theo IP." sections={adminPageSections.security.filter((section) => ['registration-ips', 'ip-blacklist', 'banned-ips'].includes(section.resource))} />;
}
