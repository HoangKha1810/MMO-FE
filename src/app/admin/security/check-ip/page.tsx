import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminCheckIpPage() {
  return <AdminDataPage title="Check IP" description="Kiểm tra số lượng tài khoản theo IP, quản lý blacklist và khóa mở truy cập theo địa chỉ đăng ký." sections={adminPageSections.security.filter((section) => ['registration-ips', 'ip-blacklist', 'banned-ips'].includes(section.resource))} />;
}
