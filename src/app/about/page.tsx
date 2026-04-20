import type { Metadata } from 'next';
import { LegalPage } from '@/components/marketing/legal-page';

export const metadata: Metadata = {
  title: 'Giới thiệu',
  description:
    'Giới thiệu TRUNGTAMMMO.VN: nền tảng MMO đa dịch vụ với trải nghiệm rõ ràng, tốc độ tốt hơn và cụm module vận hành đầy đủ.',
  alternates: {
    canonical: '/about',
  },
};

export default function AboutPage() {
  return (
    <LegalPage
      eyebrow="Giới thiệu"
      title="Kiến trúc mới, tinh thần cũ"
      description="TRUNGTAMMMO được tổ chức lại theo hướng sản phẩm rõ ràng hơn: trải nghiệm mạch lạc, dữ liệu nhất quán và khả năng mở rộng tốt hơn khi hệ thống phát triển."
      accent="violet"
      stats={[
        { value: '10+', label: 'Module chính' },
        { value: 'Realtime', label: 'Cập nhật nhanh' },
        { value: 'Product', label: 'Tư duy vận hành' },
        { value: 'Stable', label: 'Giữ luồng xử lý' },
      ]}
      highlights={[
        {
          title: 'Không làm lại từ con số 0',
          body: 'Dự án ưu tiên giữ đúng rule vận hành, hành vi xử lý và trải nghiệm giao dịch đã quen thuộc, chỉ tinh gọn lại cách người dùng thao tác.',
        },
        {
          title: 'Thiết kế lại để dễ vận hành',
          body: 'Giao diện được tinh gọn theo hướng giống một product dashboard thật: rõ hierarchy, ít màu thừa, ít cảm giác template, nhưng vẫn giữ chất MMO.',
        },
      ]}
      sections={[
        {
          title: 'Tư duy sản phẩm',
          body: 'Hệ thống được chia lớp rõ hơn để giao diện mạch lạc, backend có đường nâng cấp tốt hơn và những phần dễ hỏng được cô lập hợp lý hơn.',
        },
        {
          title: 'Phạm vi module',
          body: 'Hệ thống giữ đầy đủ các lớp nghiệp vụ chính: SMM, Auto MXH, Resource Marketplace, Card Exchange, Deposit, Forum MMO, Game Market, Find Job MMO, Seller, Support, cùng cụm admin để vận hành nội bộ.',
        },
        {
          title: 'Định hướng giao diện',
          body: 'UI được đẩy sang hướng sắc hơn, đậm chất sản phẩm hơn và hạn chế cảm giác “AI-generated admin template”. Typography, motion và layout được đồng bộ để tạo trải nghiệm có nhịp hơn.',
        },
        {
          title: 'Nguyên tắc migrate',
          body: 'Những phần nghiệp vụ quan trọng được kiểm tra kỹ trước khi hiển thị, giúp dữ liệu giữa các module nhất quán và hạn chế lệch trạng thái.',
        },
        {
          title: 'Hướng phát triển tiếp',
          body: 'Sau khi nền tảng ổn định, hệ thống có thể mở rộng sang tối ưu hiệu năng, đồng bộ provider sâu hơn, đẩy cron/job queue chuẩn hơn và tinh chỉnh trải nghiệm admin theo từng nghiệp vụ chuyên biệt.',
        },
      ]}
    />
  );
}
