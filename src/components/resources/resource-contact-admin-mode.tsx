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
            ? `Sản phẩm "${resourceTitle}" đang chuyển sang chế độ tư vấn trực tiếp. Admin sẽ kiểm tra tồn kho, giá và cách bàn giao trước khi xử lý đơn. Tiền mua tài nguyên sẽ được trừ trực tiếp từ ví game sau khi admin xác nhận.`
            : 'Kho tài nguyên đang chuyển sang chế độ tư vấn trực tiếp. Admin sẽ kiểm tra tồn kho, giá và cách bàn giao trước khi xử lý đơn. Tiền mua tài nguyên sẽ được trừ trực tiếp từ ví game sau khi admin xác nhận.'}
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
            { label: 'Thanh toán', value: 'Ví game', hint: 'Trừ trực tiếp khi xác nhận', tone: 'emerald' },
            { label: 'Trạng thái', value: 'Tư vấn', hint: 'Chưa thanh toán tự động', tone: 'amber' },
          ]}
        />

        <SectionPanel className="border-emerald-400/30 bg-emerald-500/10">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.22em] text-emerald-500">Lưu ý thanh toán</div>
              <p className="mt-2 text-sm font-bold leading-7 text-slate-700 dark:text-slate-200">
                Tiền mua tài nguyên sẽ được trừ thẳng từ ví game sau khi admin xác nhận đơn qua Telegram.
              </p>
            </div>
            <Badge variant="success" className="w-fit rounded-full px-3 py-1.5">
              Trừ ví game
            </Badge>
          </div>
        </SectionPanel>

        <SectionPanel className="grid gap-4 md:grid-cols-3">
          {[
            'Gửi tên tài nguyên hoặc link trang này cho admin.',
            'Admin xác nhận tồn kho, giá và phương thức bàn giao.',
            'Sau khi chốt đơn, tiền sẽ được trừ trực tiếp từ ví game và admin xử lý bàn giao.',
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
