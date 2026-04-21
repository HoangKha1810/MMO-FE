import Link from 'next/link';
import { Code2, KeyRound, Server, ShieldCheck } from 'lucide-react';
import { PageHero, SectionHeader, SectionPanel } from '@/components/ui/page-layout';
import { siteUrl } from '@/lib/seo';

const apiBase = process.env.API_DOMAIN || process.env.NEXT_PUBLIC_BASE_URL || siteUrl;

const endpoints = [
  { method: 'POST', path: '/api/smm/services', note: 'Đọc/sync dịch vụ SMM từ provider đang hoạt động.' },
  { method: 'POST', path: '/api/smm/order', note: 'Tạo đơn SMM bằng số dư user.' },
  { method: 'GET', path: '/api/smm/status', note: 'Kiểm tra trạng thái order provider.' },
  { method: 'POST', path: '/api/resources/order', note: 'Mua tài nguyên MMO.' },
  { method: 'GET', path: '/api/resources/download/[orderId]', note: 'Tải tài nguyên sau mua.' },
  { method: 'POST', path: '/api/social/get-id', note: 'Tách UID/username từ link social.' },
  { method: 'POST', path: '/api/cron/run', note: 'Cron nội bộ, yêu cầu API_KEY.' },
];

export default function ApiDocsPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fbff,#eef4ff_45%,#ffffff)] px-5 py-8 dark:bg-[linear-gradient(180deg,#050913,#0b1222_50%,#050913)]">
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHero
          eyebrow="Developer API"
          title="Tài liệu API dành cho tích hợp TRUNGTAMMMO"
          description="Tổng hợp các endpoint phục vụ SMM, tài nguyên, social tools và tác vụ nội bộ để đội vận hành hoặc đối tác kỹ thuật tích hợp an toàn."
          stats={[
            { label: 'Base URL', value: apiBase.replace(/^https?:\/\//, ''), hint: 'API_DOMAIN/NEXT_PUBLIC_BASE_URL', tone: 'blue' },
            { label: 'Auth', value: 'Cookie/API_KEY', hint: 'User API dùng session, cron dùng key', tone: 'emerald' },
            { label: 'Format', value: 'JSON', hint: 'Một số upload dùng multipart', tone: 'violet' },
            { label: 'Data', value: 'Live', hint: 'Đồng bộ theo hệ thống', tone: 'amber' },
          ]}
          actions={<Link href="/user/home" className="btn-kinetic rounded-full bg-brand-blue px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-white">Về workspace</Link>}
        />

        <SectionPanel className="space-y-5">
          <SectionHeader eyebrow="Endpoints" title="Danh sách endpoint chính" description="Các endpoint bên dưới phục vụ xử lý dịch vụ, tiện ích social và tác vụ vận hành nội bộ của hệ thống." />
          <div className="grid gap-3">
            {endpoints.map((item) => (
              <div key={`${item.method}-${item.path}`} className="surface-card grid gap-4 rounded-[1.5rem] p-5 md:grid-cols-[110px_minmax(0,1fr)_1.2fr] md:items-center">
                <div className="inline-flex w-fit rounded-full border border-brand-blue/20 bg-brand-blue/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-brand-blue">{item.method}</div>
                <code className="font-mono text-sm font-black text-slate-950 dark:text-white">{item.path}</code>
                <div className="text-sm font-semibold leading-7 text-slate-500 dark:text-slate-400">{item.note}</div>
              </div>
            ))}
          </div>
        </SectionPanel>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            { icon: <KeyRound className="h-5 w-5" />, title: 'API_KEY', body: 'Tác vụ hệ thống và cron sử dụng xác thực API_KEY riêng để bảo vệ các lệnh vận hành nhạy cảm.' },
            { icon: <ShieldCheck className="h-5 w-5" />, title: 'Session', body: 'Các endpoint người dùng dựa trên phiên đăng nhập hiện tại để đảm bảo chỉ truy cập được đúng tài nguyên được cấp quyền.' },
            { icon: <Server className="h-5 w-5" />, title: 'Provider', body: 'Nhóm dịch vụ được liên kết với provider phù hợp để đồng bộ giá, tạo đơn và theo dõi trạng thái xử lý theo thời gian thực.' },
          ].map((item) => (
            <div key={item.title} className="surface-card rounded-[1.6rem] p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-blue/10 text-brand-blue">{item.icon || <Code2 />}</div>
              <h2 className="mt-4 text-lg font-black uppercase text-slate-950 dark:text-white">{item.title}</h2>
              <p className="mt-2 text-sm font-semibold leading-7 text-slate-500 dark:text-slate-400">{item.body}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
