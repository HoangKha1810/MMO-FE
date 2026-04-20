import { WalletCards } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { LegacyActionForm } from '@/components/legacy/action-form';
import { listSellerWithdrawals } from '@/lib/legacy-modules';
import { formatCurrency, toNumber } from '@/lib/utils';
import { getCurrentUserForShell } from '@/lib/user-session';

export const dynamic = 'force-dynamic';

export default async function SellerWithdrawPage() {
  const { raw, shell } = await getCurrentUserForShell();
  const withdrawals = await listSellerWithdrawals(raw.id);

  return (
    <AppShell user={shell}>
      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <aside className="rounded-[2rem] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-2 text-sm font-black uppercase text-slate-950 dark:text-white">
            <WalletCards className="h-4 w-4 text-emerald-500" />
            Tạo yêu cầu rút
          </div>
          <LegacyActionForm
            endpoint="/api/seller/withdraw"
            submitLabel="Gửi yêu cầu"
            fields={[
              { name: 'amount', label: 'Số tiền', type: 'number', required: true },
              { name: 'content', label: 'Thông tin ngân hàng / ghi chú', type: 'textarea', required: true },
            ]}
          />
        </aside>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-900">
          <div className="mb-5">
            <div className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-500">Withdraw history</div>
            <h1 className="mt-2 text-3xl font-black uppercase tracking-[-0.05em] text-slate-950 dark:text-white">Lịch sử rút tiền</h1>
          </div>
          <div className="space-y-3">
            {withdrawals.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm font-bold text-slate-400 dark:border-white/10">Chưa có yêu cầu rút.</div>
            ) : withdrawals.map((item) => (
              <div key={String(item.id)} className="rounded-2xl bg-slate-50 p-4 dark:bg-white/[0.03]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="font-black text-slate-950 dark:text-white">#{String(item.id)} · {formatCurrency(toNumber(item.amount))}</div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase text-slate-500 dark:bg-white/10">{String(item.status)}</span>
                </div>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{String(item.content || '')}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
