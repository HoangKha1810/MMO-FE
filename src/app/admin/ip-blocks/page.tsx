import { AdminDataPage } from '@/components/admin/admin-data-page';
import { adminPageSections } from '@/lib/admin-page-config';

export default function AdminIpBlocksPage() {
  return (
    <AdminDataPage
      title="Chặn IP đăng ký"
      description="Giới hạn một địa chỉ IP tạo tối đa 10 tài khoản, theo dõi auto-ban và mở khóa khi admin xác nhận."
      sections={adminPageSections['ip-blocks']}
    />
  );
}
