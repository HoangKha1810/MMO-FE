import type { Metadata } from 'next';
import { LegalPage } from '@/components/marketing/legal-page';
import { readPolicySections } from '@/lib/legal-content';

export const metadata: Metadata = {
  title: 'Chính sách riêng tư',
  description:
    'Chính sách quyền riêng tư và vận hành dữ liệu của TRUNGTAMMMO.COM dành cho người dùng, đối tác và hoạt động nội bộ.',
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
      description="Chính sách này giải thích cách TRUNGTAMMMO thu thập, lưu trữ, xử lý và bảo vệ dữ liệu trong quá trình cung cấp dịch vụ và hỗ trợ người dùng."
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
          title: 'Bảo vệ quyền riêng tư thực tế',
          body: 'Mọi nguyên tắc xử lý dữ liệu đều hướng tới việc giảm rủi ro lộ lọt thông tin, kiểm soát truy cập hợp lý và duy trì môi trường giao dịch an toàn cho cộng đồng.',
        },
      ]}
      sections={sections}
    />
  );
}
