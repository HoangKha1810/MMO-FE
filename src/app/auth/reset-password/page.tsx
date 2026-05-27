'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    email: searchParams.get('email') || '',
    token: searchParams.get('token') || '',
    password: '',
  });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message || 'Không thể reset mật khẩu');
      setMessage(payload.message || 'Đã xử lý');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể reset mật khẩu');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mmo-board mmo-board-page">
      <div className="mmo-edge-shell mx-auto max-w-xl">
      <div className="mmo-edge-card p-7">
        <div className="relative z-10 mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-blue/10 text-brand-blue"><KeyRound className="h-5 w-5" /></div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-blue">Account recovery</div>
            <h1 className="text-2xl font-black uppercase text-white">Reset mật khẩu</h1>
          </div>
        </div>

        {error ? <div className="mb-4 flex gap-2 rounded-xl bg-red-500/10 p-3 text-xs font-bold text-red-500"><AlertCircle className="h-4 w-4" />{error}</div> : null}
        {message ? <div className="mb-4 rounded-xl bg-emerald-500/10 p-3 text-xs font-bold text-emerald-500">{message}</div> : null}

        <form onSubmit={submit} className="relative z-10 space-y-4">
          <Input placeholder="Email tài khoản" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <Input placeholder="Token reset nếu email đã cấp" value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} />
          <Input type="password" placeholder="Mật khẩu mới" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <Button type="submit" disabled={loading} className="w-full" loading={loading} loadingText="Đang xử lý...">
            Xử lý reset
          </Button>
        </form>

        <Link href="/auth/login" className="mt-6 block text-center text-xs font-black uppercase tracking-widest text-slate-400 hover:text-brand-blue">Về đăng nhập</Link>
      </div>
      </div>
    </main>
  );
}
