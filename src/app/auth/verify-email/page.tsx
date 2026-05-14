'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, ArrowLeft, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    email: searchParams.get('email') || '',
    code: '',
  });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/auth/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể xác thực email');
      }
      setMessage(payload.message || 'Đã xác thực email thành công');
      setTimeout(() => router.replace('/auth/login?verified=true'), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể xác thực email');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-[#06090f]">
      <div className="mx-auto max-w-xl rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-blue/10 text-brand-blue"><MailCheck className="h-5 w-5" /></div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-blue">Email Verification</div>
            <h1 className="text-2xl font-black uppercase text-slate-950 dark:text-white">Xác thực email</h1>
          </div>
        </div>

        {error ? <div className="mb-4 flex gap-2 rounded-xl bg-red-500/10 p-3 text-xs font-bold text-red-500"><AlertCircle className="h-4 w-4" />{error}</div> : null}
        {message ? <div className="mb-4 rounded-xl bg-emerald-500/10 p-3 text-xs font-bold text-emerald-500">{message}</div> : null}

        <form onSubmit={submit} className="space-y-4">
          <Input placeholder="Email đã đăng ký" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <Input placeholder="Mã xác thực 6 số" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <Button type="submit" disabled={loading} className="w-full" loading={loading} loadingText="Đang xác thực...">
            Kích hoạt tài khoản
          </Button>
        </form>

        <Link href="/auth/login" className="mt-6 block text-center text-xs font-black uppercase tracking-widest text-slate-400 hover:text-brand-blue">
          <ArrowLeft className="mr-2 inline h-4 w-4" />
          Về đăng nhập
        </Link>
      </div>
    </main>
  );
}
