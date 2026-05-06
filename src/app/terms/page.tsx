import type { Metadata } from 'next';
import { LegalPage } from '@/components/marketing/legal-page';
import { readPolicySections } from '@/lib/legal-content';

export const metadata: Metadata = {
  title: 'Điều khoản sử dụng',
  description:
    'Điều khoản sử dụng hệ thống TRUNGTAMMMO.COM giúp người dùng nắm rõ quyền lợi, trách nhiệm và nguyên tắc giao dịch.',
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
      description="Điều khoản này quy định quyền lợi, trách nhiệm sử dụng, nguyên tắc bảo hành và cách xử lý giao dịch khi bạn sử dụng các dịch vụ trên TRUNGTAMMMO."
      accent="blue"
      stats={[
        { value: `${sections.length}+`, label: 'Điều khoản' },
        { value: 'Rule thật', label: 'Không viết lại màu mè' },
        { value: 'Giao dịch', label: 'Trọng tâm chính sách' },
        { value: 'Rõ ràng', label: 'Dễ đối chiếu' },
      ]}
      highlights={[
        {
          title: 'Quy tắc giao dịch rõ ràng',
          body: 'Điều khoản tập trung vào những nguyên tắc có ảnh hưởng trực tiếp tới giao dịch, thanh toán, trạng thái đơn hàng, bảo hành và việc sử dụng tài khoản.',
        },
        {
          title: 'Ưu tiên tính rõ ràng khi giao dịch',
          body: 'Người dùng có thể đối chiếu nhanh các mốc trách nhiệm, quy định hoàn tiền, bảo hành và cơ chế xử lý tranh chấp trước khi sử dụng dịch vụ.',
        },
      ]}
      sections={sections}
    />
  );
}
