'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { useSessionUser } from '@/hooks/use-session-user';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDatabaseDateTime } from '@/lib/date-time';
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Gamepad2,
  History,
  Info,
  QrCode,
  ReceiptText,
  Smartphone,
  Wallet,
  X,
} from 'lucide-react';

const paymentMethods = [
  { id: 'sepay', label: 'Thanh Toán QR Code', icon: QrCode, color: 'from-emerald-500 to-cyan-500' },
  { id: 'momo', label: 'Ví MoMo', icon: Smartphone, color: 'from-pink-500 to-rose-500', disabled: true },
];

const quickAmounts = [50000, 100000, 200000, 500000, 1000000, 2000000];

interface DepositFeedback {
  success: boolean;
  message: string;
}

interface SePayPayment {
  checkout_url: string;
  checkout_redirect_url?: string;
  fields: Record<string, string>;
  order_id: string;
  sepay_order_id?: string;
}

interface DepositTransaction {
  id: number;
  transaction_id: string;
  amount: number;
  balance_after: number;
  content: string;
  wallet: 'main' | 'game';
  payment_method: string;
  type: string;
  status: string;
  created_at: string;
}

type WalletType = 'main' | 'game';

const walletOptions: Record<WalletType, {
  title: string;
  button: string;
  description: string;
  noticeTitle: string;
  noticeBody: string;
}> = {
  main: {
    title: 'Ví dịch vụ khác',
    button: 'Nạp tiền cho dịch vụ khác',
    description: 'Dùng cho SMM, Auto MXH, proxy, tài nguyên MMO và các module không thuộc tài khoản game.',
    noticeTitle: 'Nạp tiền cho dịch vụ khác',
    noticeBody: 'Số tiền này được cộng vào ví chính. Ví chính không dùng trực tiếp để mua tài khoản game, random game hoặc mua bán game.',
  },
  game: {
    title: 'Ví mua bán game',
    button: 'Nạp tiền cho mua bán game',
    description: 'Dùng riêng cho mua bán game, random game và tài khoản game API. Ví này tách biệt với ví chính.',
    noticeTitle: 'Nạp tiền cho mua bán game',
    noticeBody: 'Số tiền này được cộng vào ví game. Khi mua tài khoản game, random game hoặc mua bài ở chợ game, hệ thống sẽ trừ ví game.',
  },
};

function submitExternalForm(url: string, fields: Record<string, string>) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = url;
  form.style.display = 'none';

  Object.entries(fields).forEach(([key, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = key;
    input.value = value;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
  form.remove();
}

export default function DepositPage() {
  const currentUser = useSessionUser();
  const user = currentUser.data;
  const [amount, setAmount] = useState('');
  const [walletType, setWalletType] = useState<WalletType>('main');
  const [walletNotice, setWalletNotice] = useState<WalletType | null>(null);
  const [method, setMethod] = useState('sepay');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DepositFeedback | null>(null);
  const [sepayPayment, setSepayPayment] = useState<SePayPayment | null>(null);
  const [recentDeposits, setRecentDeposits] = useState<DepositTransaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const hasPendingDeposits = recentDeposits.some((item) => item.status === 'pending');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');
    const returnedWallet = params.get('wallet') === 'game' ? 'game' : 'main';
    setWalletType(returnedWallet);
    if (!paymentStatus) {
      return;
    }

    if (paymentStatus === 'success') {
      setResult({
        success: true,
        message: returnedWallet === 'game'
          ? 'Thanh Toán QR Code đã hoàn tất. Hệ thống sẽ cộng tiền vào ví game sau khi SePay xác nhận.'
          : 'Thanh Toán QR Code đã hoàn tất. Hệ thống sẽ tự đối soát SePay và cộng tiền vào tài khoản.',
      });
      void loadRecentDeposits({ sync: true });
      const timer = window.setTimeout(() => {
        void loadRecentDeposits({ sync: true, silent: true });
      }, 2500);
      return () => window.clearTimeout(timer);
    }

    if (paymentStatus === 'cancel') {
      setResult({ success: false, message: 'Bạn đã hủy giao dịch QR Code trước khi thanh toán.' });
      return;
    }

    if (paymentStatus === 'error') {
      setResult({ success: false, message: 'Cổng QR Code trả về trạng thái lỗi. Vui lòng thử lại hoặc liên hệ hỗ trợ.' });
    }
  }, []);

  useEffect(() => {
    void loadRecentDeposits();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadRecentDeposits({ silent: true, sync: hasPendingDeposits });
      }
    }, 15000);

    return () => window.clearInterval(timer);
  }, [hasPendingDeposits]);

  async function loadRecentDeposits(options?: { silent?: boolean; sync?: boolean }) {
    if (!options?.silent) {
      setHistoryLoading(true);
    }
    try {
      const params = new URLSearchParams({ per_page: '8' });
      if (options?.sync) {
        params.set('sync', '1');
      }
      const response = await fetch(`/api/user/deposit?${params.toString()}`, { cache: 'no-store' });
      const payload = await response.json();
      if (response.ok && payload.success && Array.isArray(payload.data)) {
        setRecentDeposits(payload.data);
      }
    } finally {
      if (!options?.silent) {
        setHistoryLoading(false);
      }
    }
  }

  const handleQuickAmount = (val: number) => {
    setAmount(String(val));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!amount || parseInt(amount) < 10000) {
      setResult({ success: false, message: 'Số tiền nạp tối thiểu là 10,000đ' });
      return;
    }

    setLoading(true);
    setResult(null);
    setSepayPayment(null);

    try {
      const res = await fetch('/api/user/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, payment_method: method, wallet_type: walletType }),
      });
      const data = await res.json();
      setResult({ success: Boolean(data.success), message: String(data.message || 'Đã xử lý yêu cầu nạp tiền') });

      if (data.success) {
        if (data.method === 'sepay' && data.payment?.checkout_redirect_url) {
          const payment = data.payment as SePayPayment;
          setSepayPayment(payment);
          window.setTimeout(() => {
            window.location.href = payment.checkout_redirect_url || payment.checkout_url;
          }, 250);
        } else if (data.method === 'sepay' && data.payment?.checkout_url && data.payment?.fields) {
          const payment = data.payment as SePayPayment;
          setSepayPayment(payment);
          setTimeout(() => submitExternalForm(payment.checkout_url, payment.fields), 250);
        }

        await loadRecentDeposits();
      }
    } catch {
      setResult({ success: false, message: 'Có lỗi xảy ra. Vui lòng thử lại.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell user={user}>
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="mmo-edge-page-header p-5 sm:p-7">
          <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mmo-eyebrow">Wallet Center</div>
              <h1 className="mt-2 text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">
                Nạp tiền & thanh toán
              </h1>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-slate-300">
                Chọn đúng ví, nhập số tiền và tạo QR thanh toán. Hệ thống tự đối soát SePay để cộng số dư vào tài khoản.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:min-w-[320px]">
              <div className="mmo-mini-stat">
                <div className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">Ví chính</div>
                <div className="mt-2 font-mono text-lg font-black text-white">{new Intl.NumberFormat('vi-VN').format(user?.balance || 0)}đ</div>
              </div>
              <div className="mmo-mini-stat">
                <div className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">Ví game</div>
                <div className="mt-2 font-mono text-lg font-black text-emerald-400">{new Intl.NumberFormat('vi-VN').format(user?.game_balance || 0)}đ</div>
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(['main', 'game'] as WalletType[]).map((item) => {
            const selected = walletType === item;
            const Icon = item === 'game' ? Gamepad2 : Wallet;

            return (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setWalletType(item);
                  setWalletNotice(item);
                }}
                className={`surface-card relative overflow-hidden rounded-[1rem] border p-5 text-left transition-all ${
                  selected
                    ? 'border-sky-400/45 bg-brand-blue/10 shadow-lg shadow-brand-blue/10'
                    : 'hover:border-brand-blue/25'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${selected ? 'bg-brand-blue text-white' : 'bg-slate-100 text-slate-500 dark:bg-white/8 dark:text-slate-300'}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-black uppercase tracking-[-0.02em] text-slate-950 dark:text-white">
                      {walletOptions[item].button}
                    </div>
                    <div className="mt-1 font-mono text-xs font-black text-brand-blue">
                      {new Intl.NumberFormat('vi-VN').format(item === 'game' ? user?.game_balance || 0 : user?.balance || 0)}đ
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-sm font-semibold leading-6 text-slate-400">
                  {walletOptions[item].description}
                </p>
                {selected ? (
                  <CheckCircle2 className="absolute right-4 top-4 h-4 w-4 text-brand-blue" />
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Payment Methods */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {paymentMethods.map((pm) => (
            <button
              key={pm.id}
              type="button"
              onClick={() => !pm.disabled && setMethod(pm.id)}
              className={`surface-card relative flex flex-col items-center gap-3 rounded-[1rem] border-2 p-6 transition-all ${
                method === pm.id
                  ? 'border-brand-blue bg-brand-blue/10 shadow-lg shadow-brand-blue/10'
                  : 'hover:border-slate-300 dark:hover:border-white/20'
              } ${pm.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={pm.disabled}
            >
              {pm.id === 'sepay' ? (
                <span className="absolute left-3 top-3 rounded-full bg-violet-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-violet-500">
                  Ưu tiên
                </span>
              ) : null}
              {pm.disabled ? (
                <span className="absolute right-3 top-3 rounded-full bg-amber-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-amber-500">
                  Bảo trì
                </span>
              ) : null}
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${pm.color} p-[1px]`}>
                <div className="flex h-full w-full items-center justify-center rounded-[0.85rem] bg-[#06162a]">
                  <pm.icon className={`w-6 h-6 ${
                    method === pm.id ? 'text-brand-blue' : 'text-slate-400'
                  }`} />
                </div>
              </div>
              <span className={`text-xs font-black uppercase text-center ${
	                method === pm.id ? 'text-brand-blue' : 'text-slate-400'
              }`}>
                {pm.label}
              </span>
              {method === pm.id && (
                <div className="absolute top-3 right-3">
                  <CheckCircle2 className="w-4 h-4 text-brand-blue" />
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Amount Form */}
        <Card className="border-sky-400/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {walletType === 'game' ? <Gamepad2 className="w-5 h-5" /> : <Wallet className="w-5 h-5" />}
              Số tiền nạp vào {walletOptions[walletType].title.toLowerCase()}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Quick amounts */}
            <div className="flex flex-wrap gap-2">
              {quickAmounts.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleQuickAmount(val)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                    amount === String(val)
                      ? 'bg-brand-blue text-white border-brand-blue shadow-lg'
                      : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                  }`}
                >
                  {new Intl.NumberFormat('vi-VN').format(val)}đ
                </button>
              ))}
            </div>

            {/* Custom amount */}
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                Hoặc nhập số tiền khác
              </label>
              <div className="relative">
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  min={10000}
                  className="text-2xl font-black h-14 pl-4 pr-16 text-center"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400 uppercase">
                  VNĐ
                </span>
              </div>
              <p className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Tối thiểu: 10,000đ
              </p>
            </div>

            {/* Result */}
            {result && (
              <div className={`flex items-center gap-3 rounded-[0.85rem] border p-4 text-xs font-bold uppercase tracking-widest ${
                result.success
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
                  : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20'
              }`}>
                {result.success ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                {result.message}
              </div>
            )}

            {sepayPayment ? (
              <div className="rounded-[1rem] border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-500">
                      Thanh Toán QR Code
                    </div>
                    <div className="mt-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                      Đơn {sepayPayment.order_id} đã sẵn sàng. Nếu không tự chuyển trang, bấm nút bên phải.
                    </div>
                    {sepayPayment.sepay_order_id ? (
	                      <div className="mt-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        Mã SePay: {sepayPayment.sepay_order_id}
                      </div>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    onClick={() => {
                      if (sepayPayment.checkout_redirect_url) {
                        window.location.href = sepayPayment.checkout_redirect_url;
                        return;
                      }
                      submitExternalForm(sepayPayment.checkout_url, sepayPayment.fields);
                    }}
                  >
                    <CreditCard className="w-4 h-4" />
                    Mở QR Code
                  </Button>
                </div>
              </div>
            ) : null}

            <Button onClick={handleSubmit} className="w-full" size="xl" disabled={loading || !amount} loading={loading} loadingText="Đang xử lý...">
              <>
                <Wallet className="w-5 h-5" />
                Tạo QR thanh toán cho {walletType === 'game' ? 'ví game' : 'ví chính'}
              </>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-sky-400/20">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-5 w-5" />
              Lịch sử nạp gần đây
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => void loadRecentDeposits({ sync: true })} loading={historyLoading}>
                Làm mới
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/user/history">Xem tất cả</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/user/orders">
                  <ReceiptText className="h-4 w-4" />
                  Đơn hàng
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recentDeposits.length > 0 ? (
              <div className="space-y-2">
                {recentDeposits.map((item) => (
                  <div
                    key={item.id}
                    className="surface-card flex flex-col gap-3 rounded-[1rem] p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="break-words font-black text-slate-950 [overflow-wrap:anywhere] dark:text-white">
                        {item.content || item.transaction_id}
                      </div>
                      <div className="mt-1 text-xs font-bold text-slate-400">
                        {formatDatabaseDateTime(item.created_at)} · {item.payment_method === 'sepay_qr' ? 'Thanh Toán QR Code' : item.payment_method} · {item.wallet === 'game' ? 'Ví game' : 'Ví chính'}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-mono text-base font-black text-emerald-500">
                          {new Intl.NumberFormat('vi-VN').format(item.amount)}đ
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                          {item.status}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
	              <div className="empty-state rounded-[1rem] border border-dashed border-sky-400/20 bg-white/5 p-8 text-center text-sm font-bold text-slate-400">
                Chưa có giao dịch nạp tiền nào trong tài khoản này.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="border-sky-400/20">
          <CardHeader>
            <CardTitle className="text-base">Hướng dẫn nạp tiền</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-400">
            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center text-xs font-black shrink-0">1</span>
              <p>Chọn Thanh Toán QR Code để tạo giao dịch bảo mật qua cổng QR.</p>
            </div>
            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center text-xs font-black shrink-0">2</span>
              <p>Nhập số tiền muốn nạp (tối thiểu 10,000đ)</p>
            </div>
            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center text-xs font-black shrink-0">3</span>
              <p>Chọn đúng ví trước khi tạo QR: ví chính cho dịch vụ khác, ví game cho mua bán game và random game.</p>
            </div>
            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center text-xs font-black shrink-0">4</span>
              <p>Hoàn tất thanh toán. Hệ thống nhận IPN `ORDER_PAID` hoặc tự đối soát với SePay để cộng tiền tự động.</p>
            </div>
            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center text-xs font-black shrink-0">5</span>
              <p>Ngay khi SePay xác nhận `CAPTURED`, transaction sẽ chuyển sang `success` và số dư ở đúng ví được cộng tự động.</p>
            </div>
          </CardContent>
        </Card>
      </div>
      {walletNotice ? (
        <div className="fixed inset-0 z-[260] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-md">
	          <div className="mmo-edge-card w-full max-w-lg p-5 shadow-[0_36px_120px_-44px_rgba(15,23,42,0.55)]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-blue/10 text-brand-blue">
                  {walletNotice === 'game' ? <Gamepad2 className="h-6 w-6" /> : <Info className="h-6 w-6" />}
                </div>
                <div>
	                  <div className="text-lg font-black uppercase tracking-[-0.03em] text-white">
                    {walletOptions[walletNotice].noticeTitle}
                  </div>
	                  <p className="mt-2 text-sm font-semibold leading-7 text-slate-300">
                    {walletOptions[walletNotice].noticeBody}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWalletNotice(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-brand-blue hover:text-white dark:bg-white/10 dark:text-slate-300"
                aria-label="Đóng thông báo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-6 flex justify-end">
              <Button type="button" onClick={() => setWalletNotice(null)}>
                Đã hiểu
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
