'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import { startPageTransition } from '@/components/layout/navigation-effects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function AdminLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ username: '', password: '', owner_code: '' });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.message || 'Đăng nhập admin thất bại');
      const redirect = String(payload.redirect || '/admin/dashboard');
      const nextHref = payload.require2fa ? `/auth/2fa?next=${encodeURIComponent(redirect)}` : redirect;
      startPageTransition();
      if (typeof window !== 'undefined') {
        window.location.replace(nextHref);
        return;
      }
      router.replace(nextHref);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập admin thất bại');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#06090f] px-4 text-white">
      <form onSubmit={submit} className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[0.04] p-7 shadow-2xl">
        <ShieldCheck className="h-9 w-9 text-emerald-400" />
        <h1 className="mt-5 text-3xl font-black uppercase tracking-[-0.05em]">Admin gate</h1>
        <p className="mt-2 text-sm font-semibold text-slate-400">Cổng đăng nhập bảo mật cho admin và owner.</p>
        {error ? <div className="mt-5 flex gap-2 rounded-xl bg-red-500/10 p-3 text-xs font-bold text-red-300"><AlertCircle className="h-4 w-4" />{error}</div> : null}
        <div className="mt-6 space-y-4">
          <Input placeholder="Username/email" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
          <Input type="password" placeholder="Mật khẩu" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <Input type="password" placeholder="Mã bảo mật owner (nếu là owner)" value={form.owner_code} onChange={(e) => setForm({ ...form, owner_code: e.target.value })} />
          <Button type="submit" disabled={loading} className="w-full" loading={loading} loadingText="Đang xác thực...">
            Vào admin
          </Button>
        </div>
      </form>
    </main>
  );
}
