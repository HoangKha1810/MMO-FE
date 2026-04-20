'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Shield } from 'lucide-react';
import { startPageTransition } from '@/components/layout/navigation-effects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function TwoFactorForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/user/home';
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    const response = await fetch('/api/auth/2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const payload = await response.json();
    setLoading(false);
    if (!response.ok || !payload.success) {
      setError(payload.message || 'Mã 2FA không đúng');
      return;
    }
    startPageTransition();
    router.push(next);
    router.refresh();
  }

  async function resendCode() {
    setResending(true);
    setError('');
    setMessage('');
    const response = await fetch('/api/auth/2fa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resend' }),
    });
    const payload = await response.json().catch(() => ({}));
    setResending(false);
    if (!response.ok || !payload.success) {
      setError(payload.message || 'Không gửi lại được mã 2FA');
      return;
    }
    setMessage(payload.message || 'Đã gửi lại mã 2FA');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-[#06090f]">
      <form onSubmit={submit} className="w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-7 dark:border-white/10 dark:bg-slate-900">
        <Shield className="h-9 w-9 text-brand-blue" />
        <h1 className="mt-5 text-3xl font-black uppercase tracking-[-0.05em] text-slate-950 dark:text-white">Xác thực 2FA</h1>
        <p className="mt-2 text-sm font-semibold text-slate-500">Nhập mã 2FA hoặc mã PIN bảo mật đã cấu hình trong tài khoản.</p>
        {error ? <div className="mt-4 rounded-xl bg-red-500/10 p-3 text-xs font-bold text-red-500">{error}</div> : null}
        {message ? <div className="mt-4 rounded-xl bg-emerald-500/10 p-3 text-xs font-bold text-emerald-500">{message}</div> : null}
        <div className="mt-6 space-y-4">
          <Input inputMode="numeric" placeholder="000000" value={code} onChange={(event) => setCode(event.target.value)} required />
          <Button type="submit" disabled={loading} className="w-full" loading={loading} loadingText="Đang xác nhận...">
            Xác nhận
          </Button>
          <Button type="button" variant="outline" disabled={resending} className="w-full" loading={resending} loadingText="Đang gửi... " onClick={resendCode}>
            Gửi lại mã 2FA
          </Button>
        </div>
      </form>
    </main>
  );
}

export default function TwoFactorPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-50 dark:bg-[#06090f]" />}>
      <TwoFactorForm />
    </Suspense>
  );
}
