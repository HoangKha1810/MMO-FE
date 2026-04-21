import { PageLoader } from '@/components/ui/page-loader';

export default function UserLoading() {
  return <PageLoader compact title="Đang mở workspace" subtitle="Hệ thống đang cập nhật số dư, dịch vụ và trạng thái tài khoản của bạn." />;
}
