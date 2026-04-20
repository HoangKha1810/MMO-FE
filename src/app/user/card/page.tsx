'use client';

import { AppShell } from '@/components/layout/app-shell';
import { useSessionUser } from '@/hooks/use-session-user';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, MetricCard, PageHero, SectionHeader, SectionPanel } from '@/components/ui/page-layout';
import { ArrowRightLeft, CheckCircle2, CreditCard, ShieldCheck, Wallet } from 'lucide-react';
import { useState } from 'react';
import { formatCurrency } from '@/lib/utils';

const telcos = [
  { id: 'viettel', name: 'Viettel', logo: '📱', color: 'from-red-500 to-orange-500' },
  { id: 'mobifone', name: 'Mobifone', logo: '📲', color: 'from-yellow-500 to-green-500' },
  { id: 'vinaphone', name: 'Vinaphone', logo: '📞', color: 'from-blue-500 to-indigo-500' },
  { id: 'vietnamobile', name: 'Vietnamobile', logo: '💬', color: 'from-orange-500 to-red-500' },
  { id: 'garena', name: 'Garena', logo: '🎮', color: 'from-blue-600 to-blue-800' },
  { id: 'zalo', name: 'Zalo Pay', logo: '💚', color: 'from-green-500 to-emerald-600' },
];

const denominations = [10000, 20000, 30000, 50000, 100000, 200000, 300000, 500000];

export default function CardPage() {
  const currentUser = useSessionUser();
  const user = currentUser.data;
  const [activeTab, setActiveTab] = useState<'exchange' | 'buy'>('exchange');
  const [selectedTelco, setSelectedTelco] = useState('');
  const [amount, setAmount] = useState('');
  const [serial, setSerial] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const selectedAmount = amount ? Number(amount) : 0;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedTelco || !amount || !serial || !pin) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/card/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telco: selectedTelco,
          amount: parseInt(amount),
          serial,
          pin,
          type: activeTab,
        }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ success: false, message: 'Có lỗi xảy ra' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <PageHero
          eyebrow="Card Center"
          title={activeTab === 'exchange' ? 'Đổi thẻ cào, thao tác nhanh và rõ hơn.' : 'Mua mã thẻ với flow gọn hơn nhưng logic giữ nguyên.'}
          description={
            activeTab === 'exchange'
              ? 'Giữ nguyên request tới API đổi thẻ hiện tại, nhưng form được dựng lại theo hướng sản phẩm tài chính: rõ nhà mạng, mệnh giá, trạng thái xử lý và khối tóm tắt.'
              : 'Luồng mua thẻ dùng cùng endpoint cũ. Mình chỉ làm lại mặt hiển thị để cảm giác tin cậy hơn và ít giống template hơn.'
          }
          stats={[
            { label: 'Nhà mạng', value: String(telcos.length), hint: 'Đang hỗ trợ thao tác', tone: 'blue' },
            { label: 'Mệnh giá', value: String(denominations.length), hint: 'Preset chọn nhanh', tone: 'emerald' },
            { label: 'Chế độ', value: activeTab === 'exchange' ? 'Đổi thẻ' : 'Mua thẻ', hint: 'Giữ nguyên backend flow', tone: 'amber' },
            { label: 'Mức chọn', value: selectedAmount ? formatCurrency(selectedAmount) : '—', hint: 'Giá trị đang thao tác', tone: 'violet' },
          ]}
          actions={
            <div className="inline-flex rounded-[1.2rem] border border-slate-200/80 bg-white/70 p-1 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
              {[
                { id: 'exchange', label: 'Đổi thẻ', icon: ArrowRightLeft },
                { id: 'buy', label: 'Mua thẻ', icon: CreditCard },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id as 'exchange' | 'buy');
                    setResult(null);
                  }}
                  className={`flex items-center gap-2 rounded-[1rem] px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] transition-all ${
                    activeTab === tab.id
                      ? 'bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          }
        />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <SectionPanel>
            <SectionHeader
              eyebrow="Transaction Form"
              title={activeTab === 'exchange' ? 'Nhập thông tin thẻ để đổi' : 'Nhập thông tin để mua mã thẻ'}
              description="Giữ đúng endpoint `/api/card/exchange` như hiện tại. Mình chỉ nhóm lại trường nhập và CTA để thao tác tự tin hơn."
            />

            <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-3">
                <label className="block text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">
                  Nhà mạng
                </label>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-3">
                  {telcos.map((telco) => (
                    <button
                      key={telco.id}
                      type="button"
                      onClick={() => setSelectedTelco(telco.id)}
                      className={`group relative overflow-hidden rounded-[1.45rem] border p-4 text-left transition-all ${
                        selectedTelco === telco.id
                          ? 'border-brand-blue/30 bg-brand-blue/10 shadow-[0_24px_50px_-34px_rgba(37,99,235,0.5)]'
                          : 'border-slate-200/80 bg-white/70 hover:border-slate-300 hover:bg-white dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]'
                      }`}
                    >
                      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${telco.color} opacity-0 transition-opacity group-hover:opacity-10 ${selectedTelco === telco.id ? 'opacity-15' : ''}`} />
                      <div className="relative flex items-center gap-3">
                        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/40 bg-white/70 text-2xl shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
                          {telco.logo}
                        </span>
                        <div>
                          <div className={`text-xs font-black uppercase tracking-[0.2em] ${selectedTelco === telco.id ? 'text-brand-blue' : 'text-slate-500 dark:text-slate-400'}`}>
                            {telco.name}
                          </div>
                          <div className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                            {activeTab === 'exchange' ? 'Đổi nhanh vào số dư' : 'Xuất mã thẻ theo flow cũ'}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">
                  Mệnh giá
                </label>
                <div className="flex flex-wrap gap-2">
                  {denominations.map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setAmount(String(val))}
                      className={`rounded-[1rem] border px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] transition-all ${
                        amount === String(val)
                          ? 'border-brand-blue bg-brand-blue text-white shadow-[0_22px_50px_-30px_rgba(37,99,235,0.68)]'
                          : 'border-slate-200/80 bg-white/80 text-slate-600 hover:border-slate-300 hover:bg-white dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:bg-white/[0.06]'
                      }`}
                    >
                      {new Intl.NumberFormat('vi-VN').format(val)}đ
                    </button>
                  ))}
                </div>
                <Input
                  type="number"
                  min="0"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="Hoặc nhập mệnh giá tùy chỉnh"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="block text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">
                    Serial thẻ
                  </span>
                  <Input
                    type="text"
                    value={serial}
                    onChange={(event) => setSerial(event.target.value)}
                    placeholder="Nhập serial thẻ"
                  />
                </label>
                <label className="space-y-2">
                  <span className="block text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">
                    Mã thẻ PIN
                  </span>
                  <Input
                    type="text"
                    value={pin}
                    onChange={(event) => setPin(event.target.value)}
                    placeholder="Nhập mã PIN"
                  />
                </label>
              </div>

              {result ? (
                <div className={`rounded-[1.35rem] border px-4 py-4 text-sm font-bold ${
                  result.success
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400'
                }`}>
                  {result.message}
                </div>
              ) : null}

              <Button
                type="submit"
                size="xl"
                className="w-full"
                disabled={loading || !selectedTelco || !amount || !serial || !pin}
                loading={loading}
                loadingText="Đang xử lý..."
              >
                <CreditCard className="mr-2 h-5 w-5" />
                {activeTab === 'exchange' ? 'Đổi thẻ ngay' : 'Mua thẻ ngay'}
              </Button>
            </form>
          </SectionPanel>

          <div className="space-y-4">
            <MetricCard
              label="Mệnh giá đang chọn"
              value={selectedAmount ? formatCurrency(selectedAmount) : '—'}
              hint="Bảng tóm tắt tức thời để tránh nhập sai giá trị."
              tone="blue"
              icon={<Wallet className="h-4 w-4" />}
            />
            <MetricCard
              label="Nhà mạng"
              value={selectedTelco ? telcos.find((item) => item.id === selectedTelco)?.name || selectedTelco : 'Chưa chọn'}
              hint="Trường này không đổi logic, chỉ hiển thị lại rõ hơn."
              tone="emerald"
              icon={<ShieldCheck className="h-4 w-4" />}
            />

            <SectionPanel className="space-y-4">
              <SectionHeader
                eyebrow="Guideline"
                title="Lưu ý thao tác"
                description="Khối này chỉ là trình bày hỗ trợ để user tránh nhập sai, không ảnh hưởng bất kỳ xử lý backend nào."
              />
              <div className="space-y-3">
                {[
                  'Chọn đúng nhà mạng trước khi nhập serial và mã thẻ.',
                  'Mệnh giá có thể chọn nhanh bằng preset hoặc tự nhập tay.',
                  'Phản hồi thành công/lỗi vẫn lấy trực tiếp từ API hiện tại.',
                ].map((item) => (
                  <div key={item} className="flex gap-3 rounded-[1.25rem] border border-slate-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                    <span className="mt-0.5 text-emerald-500">
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                    <p className="text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">{item}</p>
                  </div>
                ))}
              </div>
            </SectionPanel>

            {!selectedTelco ? (
              <EmptyState
                title="Chọn nhà mạng để bắt đầu"
                description="Mình giữ đúng flow cũ, nên chỉ khi đủ telco, mệnh giá, serial và pin thì nút submit mới chạy."
                icon={<CreditCard className="h-5 w-5" />}
              />
            ) : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
