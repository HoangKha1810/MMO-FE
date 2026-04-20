import type { Metadata } from 'next';
import { LegalPage } from '@/components/marketing/legal-page';

export const metadata: Metadata = {
  title: 'Giới thiệu',
  description:
    'Giới thiệu kiến trúc mới của TRUNGTAMMMO.VN: giữ logic từ source PHP cũ, tách FE/BE rõ hơn và tối ưu trải nghiệm theo hướng product.',
  alternates: {
    canonical: '/about',
  },
};

export default function AboutPage() {
  return (
    <LegalPage
      eyebrow="Giới thiệu"
      title="Kiến trúc mới, tinh thần cũ"
      description="TRUNGTAMMMO được dựng lại theo hướng sản phẩm rõ ràng hơn: giữ nguyên logic vận hành từ source PHP cũ, nhưng tái cấu trúc trải nghiệm, dữ liệu và khả năng mở rộng để hệ thống bền hơn khi đi tiếp."
      accent="violet"
      stats={[
        { value: '10+', label: 'Module chính' },
        { value: 'FE / BE', label: 'Kiến trúc tách lớp' },
        { value: 'MySQL thật', label: 'Dữ liệu kế thừa' },
        { value: 'Legacy-first', label: 'Giữ logic gốc' },
      ]}
      highlights={[
        {
          title: 'Không làm lại từ con số 0',
          body: 'Dự án ưu tiên bám theo dữ liệu, rule và hành vi xử lý đã tồn tại ở source PHP thay vì thay đổi logic chỉ để “đẹp hơn”.',
        },
        {
          title: 'Thiết kế lại để dễ vận hành',
          body: 'Giao diện được tinh gọn theo hướng giống một product dashboard thật: rõ hierarchy, ít màu thừa, ít cảm giác template, nhưng vẫn giữ chất MMO.',
        },
      ]}
      sections={[
        {
          title: 'Tư duy sản phẩm',
          body: 'Thay vì tiếp tục chồng thêm tính năng lên một khối PHP MVC cũ, bản mới tách frontend và backend để giao diện mạch lạc hơn, backend có đường nâng cấp rõ hơn và những phần dễ hỏng được cô lập tốt hơn.',
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
          body: 'Những phần dùng dữ liệu thật được ưu tiên đọc trực tiếp từ MySQL kế thừa. Mock chỉ tồn tại tạm thời ở các khu vực chưa import đủ dữ liệu hoặc cần map lại schema an toàn hơn.',
        },
        {
          title: 'Hướng phát triển tiếp',
          body: 'Sau khi nền tảng ổn định, hệ thống có thể mở rộng sang tối ưu hiệu năng, đồng bộ provider sâu hơn, đẩy cron/job queue chuẩn hơn và tinh chỉnh trải nghiệm admin theo từng nghiệp vụ chuyên biệt.',
        },
      ]}
    />
  );
}
