'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MailCheck } from 'lucide-react';
import { startPageTransition } from '@/components/layout/navigation-effects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function SetupEmailPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    const response = await fetch('/api/auth/setup-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const payload = await response.json();
    setLoading(false);
    if (!response.ok || !payload.success) {
      setMessage(payload.message || 'Không thể cập nhật email');
      return;
    }
    startPageTransition();
    router.push('/user/home');
    router.refresh();
  }

  return (
    <main className="mmo-board flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="mmo-edge-card w-full max-w-lg p-7">
        <div className="relative z-10">
        <MailCheck className="h-8 w-8 text-brand-blue" />
        <h1 className="mt-4 text-3xl font-black uppercase tracking-[-0.05em] text-white">Thiết lập email</h1>
        <p className="mt-3 text-sm font-semibold leading-7 text-slate-300">Dùng cho reset mật khẩu, cảnh báo bảo mật và xác minh tài khoản.</p>
        {message ? <div className="mt-4 rounded-xl bg-red-500/10 p-3 text-xs font-bold text-red-500">{message}</div> : null}
        <div className="mt-5 space-y-4">
          <Input type="email" placeholder="email@domain.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <Button type="submit" disabled={loading} className="w-full" loading={loading} loadingText="Đang lưu...">
            Lưu email
          </Button>
        </div>
        </div>
      </form>
    </main>
  );
}
