'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  History,
  QrCode,
  ReceiptText,
  Smartphone,
  Wallet,
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
  fields: Record<string, string>;
  order_id: string;
}

interface DepositTransaction {
  id: number;
  transaction_id: string;
  amount: number;
  balance_after: number;
  content: string;
  payment_method: string;
  type: string;
  status: string;
  created_at: string;
}

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
  const [method, setMethod] = useState('sepay');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DepositFeedback | null>(null);
  const [sepayPayment, setSepayPayment] = useState<SePayPayment | null>(null);
  const [recentDeposits, setRecentDeposits] = useState<DepositTransaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const paymentStatus = new URLSearchParams(window.location.search).get('payment');
    if (!paymentStatus) {
      return;
    }

    if (paymentStatus === 'success') {
      setResult({ success: true, message: 'Thanh Toán QR Code đã hoàn tất. Hệ thống sẽ tự đối soát SePay và cộng tiền vào tài khoản.' });
      return;
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
        void loadRecentDeposits();
        router.refresh();
      }
    }, 10000);

    return () => window.clearInterval(timer);
  }, [router]);

  async function loadRecentDeposits() {
    setHistoryLoading(true);
    try {
      const response = await fetch('/api/user/deposit?per_page=8', { cache: 'no-store' });
      const payload = await response.json();
      if (response.ok && payload.success && Array.isArray(payload.data)) {
        setRecentDeposits(payload.data);
      }
    } finally {
      setHistoryLoading(false);
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
        body: JSON.stringify({ amount, payment_method: method }),
      });
      const data = await res.json();
      setResult({ success: Boolean(data.success), message: String(data.message || 'Đã xử lý yêu cầu nạp tiền') });

      if (data.success) {
        if (data.method === 'sepay' && data.payment?.checkout_url && data.payment?.fields) {
          const payment = data.payment as SePayPayment;
          setSepayPayment(payment);
          setTimeout(() => submitExternalForm(payment.checkout_url, payment.fields), 250);
        }

        await loadRecentDeposits();
        setTimeout(() => router.refresh(), 1500);
      }
    } catch {
      setResult({ success: false, message: 'Có lỗi xảy ra. Vui lòng thử lại.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell user={user}>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
            Nạp tiền
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mt-1">
            Chọn phương thức thanh toán và nhập số tiền nạp
          </p>
        </div>

        {/* Payment Methods */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {paymentMethods.map((pm) => (
            <button
              key={pm.id}
              type="button"
              onClick={() => !pm.disabled && setMethod(pm.id)}
              className={`relative flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all ${
                method === pm.id
                  ? 'border-brand-blue bg-brand-blue/5 shadow-lg shadow-brand-blue/10'
                  : 'border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-white/20'
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
                <div className="w-full h-full rounded-[13px] bg-white dark:bg-slate-900 flex items-center justify-center">
                  <pm.icon className={`w-6 h-6 ${
                    method === pm.id ? 'text-brand-blue' : 'text-slate-400'
                  }`} />
                </div>
              </div>
              <span className={`text-xs font-black uppercase text-center ${
                method === pm.id ? 'text-brand-blue' : 'text-slate-600 dark:text-slate-400'
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Số tiền nạp
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
                      : 'bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10'
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
              <div className={`flex items-center gap-3 p-4 rounded-xl text-xs font-bold uppercase tracking-widest border ${
                result.success
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
                  : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20'
              }`}>
                {result.success ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                {result.message}
              </div>
            )}

            {sepayPayment ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-500">
                      Thanh Toán QR Code
                    </div>
                    <div className="mt-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                      Đơn {sepayPayment.order_id} đã sẵn sàng. Nếu không tự chuyển trang, bấm nút bên phải.
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={() => submitExternalForm(sepayPayment.checkout_url, sepayPayment.fields)}
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
                Tạo QR thanh toán
              </>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-5 w-5" />
              Lịch sử nạp gần đây
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => void loadRecentDeposits()} loading={historyLoading}>
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
                    className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm shadow-sm dark:border-white/10 dark:bg-white/[0.04] sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="font-black text-slate-900 dark:text-white">
                        {item.content || item.transaction_id}
                      </div>
                      <div className="mt-1 text-xs font-bold text-slate-400">
                        {formatDatabaseDateTime(item.created_at)} · {item.payment_method === 'sepay_qr' ? 'Thanh Toán QR Code' : item.payment_method}
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
              <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm font-bold text-slate-400 dark:border-white/10">
                Chưa có giao dịch nạp tiền nào trong tài khoản này.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hướng dẫn nạp tiền</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-500 dark:text-slate-400">
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
              <p>Nhấn "Nạp tiền ngay" để tạo transaction `pending` trong bảng `transactions` trước khi chuyển sang cổng thanh toán</p>
            </div>
            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center text-xs font-black shrink-0">4</span>
              <p>Hoàn tất thanh toán. Hệ thống nhận IPN `ORDER_PAID` hoặc tự đối soát với SePay để cộng tiền tự động.</p>
            </div>
            <div className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center text-xs font-black shrink-0">5</span>
              <p>Ngay khi SePay xác nhận `CAPTURED`, transaction sẽ chuyển sang `success` và số dư user được cộng tự động.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
