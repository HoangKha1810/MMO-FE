import { PageLoader } from '@/components/ui/page-loader';

export default function AdminLoading() {
  return <PageLoader compact title="Đang mở control room" subtitle="Module quản trị đang tải bảng dữ liệu, bộ lọc và action hiện hành." />;
}
