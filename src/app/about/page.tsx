import type { Metadata } from 'next';
import { LegalPage } from '@/components/marketing/legal-page';

export const metadata: Metadata = {
  title: 'Giới thiệu',
  description:
    'Giới thiệu TRUNGTAMMMO.VN: nền tảng MMO đa dịch vụ hỗ trợ SMM, Auto MXH, tài nguyên số, thanh toán, forum và công cụ vận hành.',
  alternates: {
    canonical: '/about',
  },
};

export default function AboutPage() {
  return (
    <LegalPage
      eyebrow="Giới thiệu"
      title="TRUNGTAMMMO.VN là trung tâm dịch vụ MMO đa hệ"
      description="Chúng tôi xây dựng một hệ sinh thái phục vụ tăng trưởng, giao dịch và vận hành MMO với các module SMM, Auto MXH, tài nguyên số, game market, forum và công cụ hỗ trợ chuyên biệt."
      accent="violet"
      stats={[
        { value: '10+', label: 'Nhóm dịch vụ' },
        { value: '24/7', label: 'Vận hành liên tục' },
        { value: 'Live', label: 'Giao dịch cập nhật' },
        { value: 'Secure', label: 'Kiểm soát an toàn' },
      ]}
      highlights={[
        {
          title: 'Một tài khoản, nhiều dịch vụ',
          body: 'Từ tăng tương tác, tự động hóa mạng xã hội, tài nguyên MMO, thẻ cào, game market tới forum và công cụ hỗ trợ đều được kết nối trong cùng một hệ sinh thái.',
        },
        {
          title: 'Vận hành rõ ràng, giao dịch nhanh',
          body: 'Mỗi module được tổ chức để người dùng dễ hiểu giá trị dịch vụ, dễ thao tác thanh toán và dễ theo dõi trạng thái đơn trong quá trình sử dụng.',
        },
      ]}
      sections={[
        {
          title: 'Hệ sinh thái dịch vụ',
          body: 'TRUNGTAMMMO phát triển theo mô hình nền tảng đa dịch vụ, nơi người dùng có thể tăng trưởng mạng xã hội, giao dịch tài nguyên số, mua bán sản phẩm game, nạp tiền và sử dụng các tiện ích MMO trong cùng một tài khoản.',
        },
        {
          title: 'Không gian người dùng',
          body: 'Người dùng có thể quản lý đơn hàng, lịch sử giao dịch, số dư, hồ sơ cá nhân và các dịch vụ đang hoạt động trong một workspace tập trung, thuận tiện cho cả mua nhanh lẫn theo dõi dài hạn.',
        },
        {
          title: 'Cụm công cụ chuyên biệt',
          body: 'Bên cạnh các dịch vụ cốt lõi, nền tảng còn cung cấp công cụ tiện ích như tra cứu Social ID, 2FA Live, Support TikTok và những module hỗ trợ khác để phục vụ công việc thực chiến của cộng đồng MMO.',
        },
        {
          title: 'Vận hành và kiểm soát',
          body: 'Đội ngũ quản trị có trung tâm điều phối riêng để kiểm tra dữ liệu, cập nhật giá, duyệt giao dịch, theo dõi nhật ký hệ thống và duy trì chất lượng dịch vụ ổn định trong quá trình vận hành.',
        },
        {
          title: 'Định hướng phát triển',
          body: 'TRUNGTAMMMO tiếp tục mở rộng theo hướng tối ưu hiệu năng, làm sâu kết nối provider, nâng cấp độ an toàn giao dịch và phát triển thêm các nhóm dịch vụ sát với nhu cầu kiếm tiền online thực tế.',
        },
      ]}
    />
  );
}
