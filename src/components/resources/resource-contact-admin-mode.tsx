import Link from 'next/link';
import { ArrowLeft, MessageCircleMore, ShieldCheck } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHero, SectionPanel } from '@/components/ui/page-layout';
import type { SessionUser } from '@/hooks/use-session-user';
import { RESOURCE_TELEGRAM_CONTACT_URL } from '@/lib/support-links';

interface ResourceContactAdminModeProps {
  user?: SessionUser;
  resourceTitle?: string;
}

export function ResourceContactAdminMode({ user, resourceTitle }: ResourceContactAdminModeProps) {
  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <Link href="/user/resources" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-brand-blue">
          <ArrowLeft className="h-4 w-4" />
          Quay lại tài nguyên
        </Link>

        <PageHero
          eyebrow="MMO Resources"
          title="Đặt mua tài nguyên liền tay - Liên hệ qua Telegram"
          description={resourceTitle
            ? `Sản phẩm "${resourceTitle}" đang chuyển sang chế độ tư vấn trực tiếp. Admin sẽ kiểm tra tồn kho, giá và cách bàn giao trước khi xử lý đơn.`
            : 'Kho tài nguyên đang chuyển sang chế độ tư vấn trực tiếp. Admin sẽ kiểm tra tồn kho, giá và cách bàn giao trước khi xử lý đơn.'}
          actions={
            <>
              <Button asChild size="lg">
                <a href={RESOURCE_TELEGRAM_CONTACT_URL} target="_blank" rel="noreferrer">
                  <MessageCircleMore className="mr-2 h-4 w-4" />
                  Liên hệ Telegram
                </a>
              </Button>
              <Badge variant="warning" className="rounded-full px-3 py-1.5">
                Tư vấn trước khi mua
              </Badge>
            </>
          }
          stats={[
            { label: 'Kênh', value: 'Telegram', hint: 'Liên hệ trực tiếp admin', tone: 'blue' },
            { label: 'Trạng thái', value: 'Tư vấn', hint: 'Chưa thanh toán tự động', tone: 'amber' },
          ]}
        />

        <SectionPanel className="grid gap-4 md:grid-cols-2">
          {[
            'Gửi tên tài nguyên hoặc link trang này cho admin.',
            'Admin xác nhận tồn kho, giá và phương thức bàn giao.',
          ].map((item, index) => (
            <div key={item} className="rounded-[1.2rem] border border-slate-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.04]">
              <div className="flex items-center gap-2 text-brand-blue">
                <ShieldCheck className="h-4 w-4" />
                <span className="font-mono text-xs font-black">0{index + 1}</span>
              </div>
              <p className="mt-3 text-sm font-semibold leading-7 text-slate-600 dark:text-slate-300">{item}</p>
            </div>
          ))}
        </SectionPanel>
      </div>
    </AppShell>
  );
}
