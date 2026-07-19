'use client';

import { AppShell } from '@/components/layout/app-shell';
import { useSessionUser } from '@/hooks/use-session-user';
import { useWalletBalance } from '@/components/layout/wallet-balance-context';
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

type PurchasedCard = {
  type?: string;
  amount?: number;
  code?: string;
  serial?: string;
};

type CardSubmitResult = {
  success: boolean;
  message: string;
  data?: {
    cards?: PurchasedCard[];
    balance_after?: number;
  };
};

function cleanResponseText(text: string) {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fallbackSubmitMessage(status: number, text: string) {
  const cleaned = cleanResponseText(text);
  if (cleaned && cleaned.length <= 180 && !/^<!doctype/i.test(text.trim())) {
    return cleaned;
  }
  if (status === 401) return 'Vui lòng đăng nhập để tiếp tục.';
  if (status === 403) return 'Bạn không có quyền thực hiện thao tác này.';
  if (status === 503) return 'Dịch vụ mua thẻ chưa sẵn sàng. Vui lòng thử lại sau hoặc liên hệ hỗ trợ.';
  if (status >= 500) return 'Máy chủ đang lỗi khi xử lý giao dịch thẻ. Vui lòng thử lại sau.';
  return `Không thể xử lý giao dịch thẻ (${status}).`;
}

async function readCardSubmitResponse(res: Response): Promise<CardSubmitResult> {
  const text = await res.text();
  try {
    const payload = JSON.parse(text || '{}') as Partial<CardSubmitResult>;
    return {
      success: payload.success === true,
      message: typeof payload.message === 'string' && payload.message.trim()
        ? payload.message
        : fallbackSubmitMessage(res.status, text),
      data: payload.data,
    };
  } catch {
    return {
      success: false,
      message: fallbackSubmitMessage(res.status, text),
    };
  }
}

export default function CardPage() {
  const currentUser = useSessionUser();
  const user = currentUser.data;
  const { setBalances } = useWalletBalance();
  const [activeTab, setActiveTab] = useState<'exchange' | 'buy'>('exchange');
  const [selectedTelco, setSelectedTelco] = useState('');
  const [amount, setAmount] = useState('');
  const [serial, setSerial] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CardSubmitResult | null>(null);

  const selectedAmount = amount ? Number(amount) : 0;
  const requiresCardCredential = activeTab === 'exchange';
  const canSubmit = Boolean(selectedTelco && amount && (!requiresCardCredential || (serial.trim() && pin.trim())));
  const purchasedCards = result?.data?.cards || [];
  const guidelineItems = activeTab === 'exchange'
    ? [
      'Kiểm tra đúng nhà mạng trước khi nhập serial và mã PIN.',
      'Ưu tiên chọn đúng mệnh giá để hệ thống xử lý nhanh hơn.',
      'Theo dõi phản hồi sau khi gửi để biết trạng thái giao dịch ngay.',
    ]
    : [
      'Mua mã thẻ chỉ cần chọn đúng nhà mạng và mệnh giá.',
      'Hệ thống trừ ví chính, không trừ ví game.',
      'Mã thẻ và serial sẽ hiển thị ngay khi nhà cung cấp trả thành công.',
    ];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/card/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telco: selectedTelco,
          amount: parseInt(amount),
          serial: requiresCardCredential ? serial.trim() : undefined,
          pin: requiresCardCredential ? pin.trim() : undefined,
          type: activeTab,
        }),
      });
      const data = await readCardSubmitResponse(res);
      if (typeof data.data?.balance_after === 'number') {
        setBalances({ balance: data.data.balance_after });
      }
      setResult(data);
    } catch {
      setResult({ success: false, message: 'Không kết nối được máy chủ. Vui lòng thử lại.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <PageHero
          eyebrow="Card Center"
          title={activeTab === 'exchange' ? 'Đổi thẻ cào nhanh, an toàn và minh bạch.' : 'Mua mã thẻ nhanh cho nhu cầu nạp và phân phối.'}
          description={
            activeTab === 'exchange'
              ? 'Chọn nhà mạng, mệnh giá và gửi yêu cầu đổi thẻ để hệ thống xử lý vào số dư tài khoản với bố cục rõ ràng, dễ kiểm tra trước khi xác nhận.'
              : 'Đặt mua mã thẻ trực tiếp trên TRUNGTAMMMO với quy trình ngắn gọn, thông tin dễ đối chiếu và phản hồi trạng thái rõ ràng.'
          }
          stats={[
            { label: 'Nhà mạng', value: String(telcos.length), hint: 'Đang hỗ trợ thao tác', tone: 'blue' },
            { label: 'Mệnh giá', value: String(denominations.length), hint: 'Preset chọn nhanh', tone: 'emerald' },
            { label: 'Chế độ', value: activeTab === 'exchange' ? 'Đổi thẻ' : 'Mua thẻ', hint: 'Luồng giao dịch đang thao tác', tone: 'amber' },
            { label: 'Mức chọn', value: selectedAmount ? formatCurrency(selectedAmount) : '—', hint: 'Giá trị đang thao tác', tone: 'violet' },
          ]}
          actions={
            <div className="inline-flex w-full flex-col rounded-[1.2rem] border border-slate-200/80 bg-white/70 p-1 shadow-sm dark:border-white/10 dark:bg-white/[0.04] sm:w-auto sm:flex-row">
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
                    if (tab.id === 'buy') {
                      setSerial('');
                      setPin('');
                    }
                  }}
                  className={`flex items-center justify-center gap-2 rounded-[1rem] px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] transition-all sm:px-5 sm:tracking-[0.18em] ${
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
              description="Điền đầy đủ thông tin để hệ thống tiếp nhận giao dịch và phản hồi trạng thái chính xác cho từng yêu cầu."
            />

            <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-3">
                <label className="block text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">
                  Nhà mạng
                </label>
                <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-3">
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
                            {activeTab === 'exchange' ? 'Đổi nhanh vào số dư' : 'Phát hành mã thẻ an toàn'}
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

              {requiresCardCredential ? (
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
              ) : (
                <div className="rounded-[1.35rem] border border-brand-blue/20 bg-brand-blue/10 px-4 py-4 text-sm font-bold leading-7 text-brand-blue dark:border-brand-blue/30 dark:bg-brand-blue/10 dark:text-blue-200">
                  Mua mã thẻ không cần nhập serial/PIN. Hệ thống sẽ dùng ví chính để thanh toán và trả mã thẻ sau khi API xử lý thành công.
                </div>
              )}

              {result ? (
                <div className={`space-y-3 rounded-[1.35rem] border px-4 py-4 text-sm font-bold ${
                  result.success
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400'
                }`}>
                  <p>{result.message}</p>
                  {purchasedCards.length ? (
                    <div className="space-y-2 text-slate-700 dark:text-slate-100">
                      {purchasedCards.map((card, index) => (
                        <div
                          key={`${card.serial || card.code || index}`}
                          className="rounded-[1rem] border border-white/50 bg-white/80 p-3 text-xs leading-6 shadow-sm dark:border-white/10 dark:bg-slate-950/50"
                        >
                          <div className="font-black uppercase tracking-[0.16em] text-brand-blue">
                            Thẻ #{index + 1} {card.type ? `- ${card.type}` : ''}
                          </div>
                          <div>Serial: <span className="font-mono">{card.serial || '—'}</span></div>
                          <div>Mã thẻ: <span className="font-mono">{card.code || '—'}</span></div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <Button
                type="submit"
                size="xl"
                className="w-full"
                disabled={loading || !canSubmit}
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
              hint="Hiển thị để bạn đối chiếu chính xác trước khi gửi giao dịch."
              tone="emerald"
              icon={<ShieldCheck className="h-4 w-4" />}
            />

            <SectionPanel className="space-y-4">
              <SectionHeader
                eyebrow="Guideline"
                title="Lưu ý thao tác"
                description="Những lưu ý dưới đây giúp bạn thao tác chính xác, hạn chế sai sót khi gửi yêu cầu đổi hoặc mua thẻ."
              />
              <div className="space-y-3">
                {guidelineItems.map((item) => (
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
                description="Chọn nhà mạng để mở form giao dịch và hoàn tất các trường bắt buộc trước khi gửi yêu cầu."
                icon={<CreditCard className="h-5 w-5" />}
              />
            ) : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
