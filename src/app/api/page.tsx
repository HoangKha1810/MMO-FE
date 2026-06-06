import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, KeyRound, Server, ShieldCheck } from 'lucide-react';
import { PageHero } from '@/components/ui/page-layout';
import { buildAbsoluteUrl, siteName, siteUrl } from '@/lib/seo';

const apiBase = process.env.API_DOMAIN || process.env.NEXT_PUBLIC_BASE_URL || siteUrl;

export const metadata: Metadata = {
  title: 'Tài liệu API SMM',
  description:
    'Tài liệu API SMM của TRUNGTAMMMO.VN cho reseller và đội kỹ thuật tích hợp services, add order, status, multi-status và balance.',
  keywords: ['API SMM', 'SMM API docs', 'TRUNGTAMMMO API', 'reseller SMM', 'tích hợp SMM'],
  alternates: {
    canonical: '/api',
  },
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    siteName,
    url: buildAbsoluteUrl('/api'),
    title: 'Tài liệu API SMM',
    description:
      'Tài liệu API SMM của TRUNGTAMMMO.VN cho reseller và đội kỹ thuật tích hợp dịch vụ SMM.',
  },
};

interface SmmApiDocSection {
  key: string;
  label: string;
  description: string;
  parameters: Array<{ name: string; description: string }>;
  example: string;
  footer?: string;
}

const docs: SmmApiDocSection[] = [
  {
    key: 'services',
    label: 'Services',
    description: 'Lấy danh sách dịch vụ đang mở từ provider.',
    parameters: [
      { name: 'key', description: 'API Key' },
      { name: 'action', description: '"services"' },
    ],
    example: `[
  {
    "service": 1,
    "name": "Facebook views",
    "type": "Default",
    "category": "Facebook",
    "rate": "2,5",
    "min": "200",
    "max": "10000",
    "refill": true
  },
  {
    "service": 2,
    "name": "Tiktok views",
    "type": "Default",
    "category": "Tiktok",
    "rate": "4",
    "min": "10",
    "max": "1500",
    "refill": false
  }
]`,
  },
  {
    key: 'add',
    label: 'Add order',
    description: 'Tạo đơn mới trên nguồn SMM.',
    parameters: [
      { name: 'key', description: 'API Key' },
      { name: 'action', description: '"add"' },
      { name: 'service', description: 'Service ID' },
      { name: 'link', description: 'Link' },
      { name: 'quantity', description: 'Needed quantity' },
    ],
    example: `{
  "order": 99999
}`,
  },
  {
    key: 'status',
    label: 'Order status',
    description: 'Kiểm tra trạng thái 1 đơn.',
    parameters: [
      { name: 'key', description: 'API Key' },
      { name: 'action', description: '"status"' },
      { name: 'order', description: 'Order ID' },
    ],
    example: `{
  "charge": "2.5",
  "start_count": "168",
  "status": "Completed",
  "remains": "-2"
}`,
    footer: 'Status: Pending, Processing, In progress, Completed, Partial, Canceled',
  },
  {
    key: 'multi-status',
    label: 'Multiple orders status',
    description: 'Kiểm tra nhiều đơn cùng lúc.',
    parameters: [
      { name: 'key', description: 'API Key' },
      { name: 'action', description: '"status"' },
      { name: 'orders', description: 'Order IDs separated by comma (E.g: 123,456,789) (Limit 100)' },
    ],
    example: `{
  "123": {
    "charge": "0.27819",
    "start_count": "3572",
    "status": "Partial",
    "remains": "157"
  },
  "456": {
    "error": "Incorrect order ID"
  },
  "789": {
    "charge": "1.44219",
    "start_count": "234",
    "status": "In progress",
    "remains": "10"
  }
}`,
  },
  {
    key: 'balance',
    label: 'Balance',
    description: 'Lấy số dư còn lại trên nguồn API.',
    parameters: [
      { name: 'key', description: 'API Key' },
      { name: 'action', description: '"balance"' },
    ],
    example: `{
  "balance": "343423",
  "currency": "VND"
}`,
  },
] as const;

export default function ApiDocsPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fbff,#eef4ff_45%,#ffffff)] px-4 py-6 dark:bg-[linear-gradient(180deg,#050913,#0b1222_50%,#050913)]">
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHero
          eyebrow="SMM API"
          title="Tài liệu tích hợp nguồn SMM"
          description="Bản tài liệu rút gọn cho đội kỹ thuật và vận hành, bám theo spec nguồn SMM đang dùng trong hệ thống."
          stats={[
            { label: 'Base URL', value: apiBase.replace(/^https?:\/\//, ''), hint: 'API_DOMAIN / NEXT_PUBLIC_BASE_URL', tone: 'blue' },
            { label: 'Method', value: 'POST', hint: 'application/x-www-form-urlencoded', tone: 'emerald' },
            { label: 'Response', value: 'JSON', hint: 'Dữ liệu raw từ provider', tone: 'violet' },
            { label: 'Limit', value: '100 orders', hint: 'Multiple status mỗi lần gọi', tone: 'amber' },
          ]}
          actions={
            <div className="flex flex-wrap gap-2">
              <Link href="/user/smm" className="btn-kinetic rounded-full bg-brand-blue px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white">
                Về SMM
              </Link>
              <Link href="/user/home" className="rounded-full border border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-700 transition hover:border-brand-blue hover:text-brand-blue dark:border-white/10 dark:bg-white/[0.04] dark:text-white">
                <span className="inline-flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Workspace
                </span>
              </Link>
            </div>
          }
        />

        <section className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-3 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
            <div className="text-sm font-black uppercase tracking-[0.18em] text-slate-600 dark:text-slate-300">
              Services
            </div>
            <nav className="space-y-2">
              {docs.map((item) => (
                <a
                  key={item.key}
                  href={`#${item.key}`}
                  className="block rounded-[1.2rem] px-5 py-4 text-[11px] font-black uppercase tracking-[0.18em] text-slate-600 transition hover:bg-brand-blue/10 hover:text-brand-blue dark:text-slate-200 dark:hover:bg-brand-blue/15"
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="grid gap-3 rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
              {[
                { icon: <KeyRound className="h-4 w-4" />, title: 'API Key', body: 'Tất cả request đều cần key hợp lệ của nguồn.' },
                { icon: <ShieldCheck className="h-4 w-4" />, title: 'Status chuẩn', body: 'Nên map về Pending / Processing / Completed / Refunded / Canceled ở phía web.' },
                { icon: <Server className="h-4 w-4" />, title: 'Provider raw', body: 'Khi provider trả lỗi nội bộ, chỉ hiện thông báo gọn cho user và giữ raw error ở log/admin.' },
              ].map((item) => (
                <div key={item.title} className="rounded-[1rem] bg-white px-4 py-3 dark:bg-slate-950/50">
                  <div className="flex items-center gap-2 text-sm font-black text-slate-900 dark:text-white">
                    {item.icon}
                    {item.title}
                  </div>
                  <div className="mt-2 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-400">
                    {item.body}
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <div className="space-y-5">
            {docs.map((item) => (
              <section
                key={item.key}
                id={item.key}
                className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900"
              >
                <div className="border-b border-slate-100 px-6 py-5 dark:border-white/5">
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                    Endpoint
                  </div>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950 dark:text-white">
                    {item.label}
                  </h2>
                  <p className="mt-2 text-sm font-semibold leading-7 text-slate-500 dark:text-slate-400">
                    {item.description}
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-left">
                    <thead className="bg-slate-50/70 text-[12px] font-black uppercase tracking-[0.18em] text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">
                      <tr>
                        <th className="px-6 py-4">Parameters</th>
                        <th className="px-6 py-4">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm font-semibold text-slate-700 dark:divide-white/5 dark:text-slate-200">
                      {item.parameters.map((parameter) => (
                        <tr key={`${item.key}-${parameter.name}`}>
                          <td className="px-6 py-4 font-mono text-[13px]">{parameter.name}</td>
                          <td className="px-6 py-4">{parameter.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="px-6 py-5">
                  <div className="mb-3 text-[12px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Example response
                  </div>
                  <pre className="custom-scrollbar overflow-x-auto rounded-[1.4rem] bg-slate-50 px-5 py-5 text-[13px] font-semibold leading-7 text-slate-800 dark:bg-slate-950/70 dark:text-slate-200">
                    {item.example}
                  </pre>
                  {item.footer ? (
                    <div className="mt-4 text-sm font-semibold italic text-slate-500 dark:text-slate-400">
                      {item.footer}
                    </div>
                  ) : null}
                </div>
              </section>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
