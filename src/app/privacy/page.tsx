import type { Metadata } from 'next';
import { LegalPage } from '@/components/marketing/legal-page';
import { readPolicySections } from '@/lib/legal-content';

export const metadata: Metadata = {
  title: 'Chính sách riêng tư',
  description:
    'Chính sách quyền riêng tư và vận hành dữ liệu của TRUNGTAMMMO.VN, trình bày theo cấu trúc dễ đọc hơn.',
  alternates: {
    canonical: '/privacy',
  },
};

export default async function PrivacyPage() {
  const sections = await readPolicySections('csht');

  return (
    <LegalPage
      eyebrow="Chính sách"
      title="Quyền riêng tư và vận hành dữ liệu"
      description="Nội dung dưới đây được trình bày lại theo cấu trúc dễ đọc hơn để người dùng theo dõi rõ cách hệ thống lưu trữ, xử lý và bảo vệ dữ liệu."
      accent="emerald"
      stats={[
        { value: `${sections.length}+`, label: 'Mục chính sách' },
        { value: 'Bảo mật', label: 'Ưu tiên vận hành' },
        { value: 'Logs + Audit', label: 'Theo dõi hệ thống' },
        { value: 'Rõ ràng', label: 'Dễ tra cứu' },
      ]}
      highlights={[
        {
          title: 'Minh bạch phạm vi dữ liệu',
          body: 'Chính sách tập trung giải thích những gì hệ thống ghi nhận trong quá trình vận hành: tài khoản, giao dịch, lịch sử thao tác, bảo mật và liên lạc hỗ trợ.',
        },
        {
          title: 'Giữ đúng tinh thần vận hành',
          body: 'Chúng tôi không viết policy theo kiểu marketing. Nội dung được trình bày lại để đọc rõ hơn, dễ tra cứu hơn và sát với cách hệ thống vận hành.',
        },
      ]}
      sections={sections}
    />
  );
}
