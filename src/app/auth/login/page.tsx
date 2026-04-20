'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Shield, AlertCircle } from 'lucide-react';
import { startPageTransition } from '@/components/layout/navigation-effects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    username: '',
    password: '',
    remember: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || 'Đăng nhập thất bại');
        return;
      }

      startPageTransition();
      router.push(data.require2fa ? '/auth/2fa?next=/user/home' : '/user/home');
      router.refresh();
    } catch {
      setError('Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen auth-bg font-sans antialiased text-slate-600 relative overflow-x-hidden">
      {/* Floating Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="floating-orb orb-1 animate-float" style={{ width: 400, height: 400, background: '#dbeafe', top: -100, right: -100 }} />
        <div className="floating-orb orb-2 animate-float-reverse" style={{ width: 300, height: 300, background: '#e0e7ff', bottom: -50, left: -50 }} />
      </div>

      <div className="min-h-screen flex relative z-10 transition-all duration-500">
        {/* Left - Visual */}
        <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center p-12 overflow-hidden">
          <div className="absolute inset-0 bg-blue-50/30 dark:bg-brand-slate-900/40 backdrop-blur-[2px]" />
          <div className="relative z-10 text-center max-w-lg">
            <div className="mb-12 flex flex-col items-center">
              <div className="surface-card mb-6 rounded-[2rem] px-8 py-6">
                <img src="/logo.gif" alt="TRUNGTAMMMO" className="h-24 w-auto object-contain" />
              </div>
              <h2 className="text-4xl font-black text-slate-900 dark:text-white mb-4 leading-tight uppercase tracking-tighter">
                TRUNGTAMMMO.VN
              </h2>
              <p className="text-xl text-slate-500 dark:text-slate-400 font-bold uppercase tracking-[0.24em] text-xs">
                Hệ thống MMO hàng đầu Việt Nam
              </p>
            </div>
            <div className="space-y-6 mt-12">
              {[
                { icon: '⚡', title: 'Tự động hóa', desc: 'Xử lý đơn hàng 24/7' },
                { icon: '🛡️', title: 'Bảo mật', desc: 'Mã hóa dữ liệu tuyệt đối' },
                { icon: '💬', title: 'Hỗ trợ', desc: 'Đội ngũ chuyên nghiệp' },
              ].map((f) => (
                <div key={f.title} className="surface-card flex items-center gap-4 rounded-2xl p-4">
                  <span className="text-3xl">{f.icon}</span>
                  <div className="text-left">
                    <div className="text-sm font-black text-slate-900 dark:text-white uppercase">{f.title}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right - Form */}
        <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-12 lg:px-24 py-12">
          <div className="max-w-[400px] w-full mx-auto">
            <div className="mb-10 text-center lg:text-left">
              <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tighter">
                Đăng nhập
              </h1>
              <p className="text-slate-500 dark:text-slate-400 font-medium uppercase text-[11px] tracking-widest">
                Chào mừng bạn trở lại hệ thống
              </p>
            </div>

            {error && (
              <div className="mb-6 flex items-center gap-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-black uppercase tracking-widest border border-red-100 dark:border-red-500/20">
                <AlertCircle className="w-5 h-5 shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                  Tên đăng nhập
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <Input
                    type="text"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    placeholder="NHẬP USERNAME HOẶC EMAIL"
                    required
                    className="pl-11"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">
                    Mật khẩu
                  </label>
                  <Link
                    href="/auth/forgot-password"
                    className="text-xs font-black text-brand-blue hover:text-blue-700 uppercase tracking-widest transition-colors"
                  >
                    Quên?
                  </Link>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="••••••••"
                    required
                    className="pl-11 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="remember"
                  checked={form.remember}
                  onChange={(e) => setForm({ ...form, remember: e.target.checked })}
                  className="w-4 h-4 text-brand-blue border-slate-300 dark:border-white/10 rounded focus:ring-brand-blue bg-white dark:bg-white/5"
                />
                <label htmlFor="remember" className="ml-2 block text-xs font-black text-slate-400 uppercase tracking-widest cursor-pointer">
                  Lưu đăng nhập
                </label>
              </div>

              <Button type="submit" className="w-full" disabled={loading} loading={loading} loadingText="Đang đăng nhập...">
                <>
                  Đăng nhập hệ thống
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </>
              </Button>
            </form>

            <div className="mt-10 pt-8 border-t border-slate-100 dark:border-white/5 text-center">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-500">
                Chưa có tài khoản?{' '}
                <Link href="/auth/register" className="text-brand-blue hover:underline transition-colors">
                  Đăng ký ngay
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
