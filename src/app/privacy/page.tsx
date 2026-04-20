import { LegalPage } from '@/components/marketing/legal-page';
import { readPolicySections } from '@/lib/legal-content';

export default async function PrivacyPage() {
  const sections = await readPolicySections('csht');

  return (
    <LegalPage
      eyebrow="Chính sách"
      title="Quyền riêng tư và vận hành dữ liệu"
      description="Nội dung dưới đây được migrate từ thư mục `chinhsach/csht` của source PHP cũ, sau đó trình bày lại theo cấu trúc dễ đọc hơn để người dùng theo dõi rõ cách hệ thống lưu trữ, xử lý và bảo vệ dữ liệu."
      accent="emerald"
      stats={[
        { value: `${sections.length}+`, label: 'Mục chính sách' },
        { value: 'MySQL', label: 'Nguồn dữ liệu vận hành' },
        { value: 'Logs + Audit', label: 'Theo dõi hệ thống' },
        { value: 'Legacy PHP', label: 'Nội dung gốc' },
      ]}
      highlights={[
        {
          title: 'Minh bạch phạm vi dữ liệu',
          body: 'Chính sách tập trung giải thích những gì hệ thống ghi nhận trong quá trình vận hành: tài khoản, giao dịch, lịch sử thao tác, bảo mật và liên lạc hỗ trợ.',
        },
        {
          title: 'Bám nội dung source cũ',
          body: 'Chúng tôi không viết lại policy theo kiểu marketing. Nội dung được lấy từ thư mục chính sách cũ rồi làm lại bố cục để đọc rõ hơn và dễ tra cứu hơn.',
        },
      ]}
      sections={sections}
    />
  );
}
