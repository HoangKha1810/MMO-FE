import type { Metadata } from 'next';
import { LegalPage } from '@/components/marketing/legal-page';
import { readPolicySections } from '@/lib/legal-content';

export const metadata: Metadata = {
  title: 'Điều khoản sử dụng',
  description:
    'Điều khoản sử dụng hệ thống TRUNGTAMMMO.VN để người dùng theo dõi rõ rule giao dịch và vận hành.',
  alternates: {
    canonical: '/terms',
  },
};

export default async function TermsPage() {
  const sections = await readPolicySections('csdv');

  return (
    <LegalPage
      eyebrow="Điều khoản"
      title="Điều khoản sử dụng hệ thống"
      description="Nội dung dưới đây được trình bày lại bằng bố cục đọc dài tốt hơn, giúp người dùng nắm nhanh rule giao dịch, bảo hành và trách nhiệm sử dụng."
      accent="blue"
      stats={[
        { value: `${sections.length}+`, label: 'Điều khoản' },
        { value: 'Rule thật', label: 'Không viết lại màu mè' },
        { value: 'Giao dịch', label: 'Trọng tâm chính sách' },
        { value: 'Rõ ràng', label: 'Dễ đối chiếu' },
      ]}
      highlights={[
        {
          title: 'Điều khoản gốc, trình bày mới',
          body: 'Rule hệ thống không bị thay đổi chỉ vì migrate giao diện. Phần này chủ yếu được làm lại về bố cục và hierarchy để dễ đọc hơn.',
        },
        {
          title: 'Ưu tiên tính rõ ràng khi giao dịch',
          body: 'Điều khoản tập trung vào những thứ ảnh hưởng trực tiếp tới người dùng: trách nhiệm sử dụng, hoàn tiền, bảo hành, xử lý tranh chấp và cách hệ thống ghi nhận đơn hàng.',
        },
      ]}
      sections={sections}
    />
  );
}
