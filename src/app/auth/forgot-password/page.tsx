'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Mail, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || 'Có lỗi xảy ra');
        return;
      }

      setSuccess(true);
    } catch {
      setError('Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="mmo-board min-h-screen auth-bg font-sans antialiased flex items-center justify-center p-4">
        <div className="mmo-edge-card max-w-md w-full text-center space-y-6 p-7">
          <div className="relative z-10 w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-[1.4rem] flex items-center justify-center mx-auto border border-emerald-500/20">
            <Mail className="w-10 h-10" />
          </div>
          <div className="relative z-10">
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-3">
              Email đã được gửi
            </h2>
            <p className="text-slate-300 font-medium text-sm leading-relaxed">
              Chúng tôi đã gửi hướng dẫn đặt lại mật khẩu đến <span className="font-bold text-brand-blue">{email}</span>.
              Vui lòng kiểm tra hộp thư và làm theo hướng dẫn.
            </p>
          </div>
          <Link href="/auth/login">
            <Button variant="outline" className="w-full">
              <ArrowLeft className="w-4 h-4" />
              Quay lại đăng nhập
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mmo-board min-h-screen auth-bg font-sans antialiased flex items-center justify-center p-4">
      <div className="mmo-edge-card max-w-md w-full p-7">
        <div className="text-center mb-10">
          <Link href="/auth/login" className="inline-flex items-center gap-2 text-brand-blue hover:text-blue-700 text-xs font-bold uppercase tracking-widest mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Quay lại đăng nhập
          </Link>
          <div className="w-16 h-16 bg-brand-blue/10 text-brand-blue rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="20" height="16" x="2" y="4" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </div>
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">
            Quên mật khẩu
          </h2>
          <p className="text-slate-400 font-medium uppercase text-[11px] tracking-widest">
            Nhập email để nhận hướng dẫn đặt lại mật khẩu
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-black uppercase tracking-widest border border-red-100 dark:border-red-500/20">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="relative z-10 space-y-5">
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
              Địa chỉ Email
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading} loading={loading} loadingText="Đang gửi...">
            Gửi hướng dẫn
          </Button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">
            Nhớ mật khẩu?{' '}
            <Link href="/auth/login" className="text-brand-blue hover:underline transition-colors">
              Đăng nhập ngay
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
