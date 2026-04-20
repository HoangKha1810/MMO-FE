'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, AlertCircle, MessageCircle, ShieldAlert, X } from 'lucide-react';
import { startPageTransition } from '@/components/layout/navigation-effects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface BlockedIpState {
  ip: string;
  message: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [blockedIp, setBlockedIp] = useState<BlockedIpState | null>(null);
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    fullname: '',
    agreeTerms: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBlockedIp(null);

    if (form.password !== form.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    if (!form.agreeTerms) {
      setError('Bạn cần đồng ý với điều khoản sử dụng');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        if (res.status === 403 && data.code === 'IP_BLOCKED') {
          setBlockedIp({
            ip: data.ip || 'unknown',
            message: data.message || 'Địa chỉ IP của bạn đã bị chặn. Vui lòng liên hệ admin để mở khóa.',
          });
        }
        setError(data.message || 'Đăng ký thất bại');
        return;
      }

      startPageTransition();
      router.push('/auth/login?registered=true');
    } catch {
      setError('Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = (pwd: string) => {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  };

  const strength = passwordStrength(form.password);
  const strengthColor = ['', 'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-emerald-500'][strength];
  const strengthLabel = ['', 'Yếu', 'Trung bình', 'Khá mạnh', 'Mạnh'][strength];

  return (
    <div className="min-h-screen auth-bg font-sans antialiased text-slate-600 relative overflow-x-hidden">
      {blockedIp ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-red-500/20 bg-white p-7 text-center shadow-2xl shadow-red-500/20 dark:bg-slate-950">
            <button
              type="button"
              onClick={() => setBlockedIp(null)}
              className="absolute right-4 top-4 rounded-full bg-slate-100 p-2 text-slate-500 transition-colors hover:text-slate-900 dark:bg-white/10 dark:text-slate-300"
              aria-label="Đóng cảnh báo"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-red-500/10 text-red-500">
              <ShieldAlert className="h-10 w-10" />
            </div>
            <div className="mt-5 inline-flex rounded-full bg-red-500 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-white">
              IP bị khóa
            </div>
            <h2 className="mt-4 text-2xl font-black uppercase tracking-[-0.04em] text-slate-950 dark:text-white">
              Không thể tạo thêm tài khoản
            </h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-300">
              {blockedIp.message}
            </p>
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/[0.04]">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Địa chỉ IP</div>
              <div className="mt-1 font-mono text-sm font-black text-red-500">{blockedIp.ip}</div>
            </div>
            <a
              href="https://t.me/admin"
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-xs font-black uppercase tracking-widest text-white transition-all hover:-translate-y-0.5 hover:shadow-xl dark:bg-white dark:text-slate-950"
            >
              <MessageCircle className="h-4 w-4" />
              Liên hệ admin để mở khóa
            </a>
          </div>
        </div>
      ) : null}

      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="floating-orb orb-1 animate-float" style={{ width: 400, height: 400, background: '#dbeafe', top: -100, right: -100 }} />
        <div className="floating-orb orb-2 animate-float-reverse" style={{ width: 300, height: 300, background: '#e0e7ff', bottom: -50, left: -50 }} />
      </div>

      <div className="min-h-screen flex relative z-10">
        <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-12 lg:px-24 py-12">
          <div className="max-w-[440px] w-full mx-auto">
            <div className="mb-10 text-center lg:text-left">
              <div className="flex items-center gap-3 justify-center lg:justify-start mb-4">
                <div className="surface-card rounded-2xl px-3 py-2">
                  <img src="/logo.gif" alt="TRUNGTAMMMO" className="h-10 w-auto object-contain" />
                </div>
                <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                  Đăng ký
                </h1>
              </div>
              <p className="text-slate-500 dark:text-slate-400 font-medium uppercase text-[11px] tracking-widest">
                Tạo tài khoản mới tại TRUNGTAMMMO
              </p>
            </div>

            {error && (
              <div className="mb-6 flex items-center gap-3 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-xs font-black uppercase tracking-widest border border-red-100 dark:border-red-500/20">
                <AlertCircle className="w-5 h-5 shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                    Username
                  </label>
                  <Input
                    type="text"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    placeholder="username"
                    required
                    minLength={3}
                    maxLength={50}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                    Họ tên
                  </label>
                  <Input
                    type="text"
                    value={form.fullname}
                    onChange={(e) => setForm({ ...form, fullname: e.target.value })}
                    placeholder="Họ và tên"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                  Email
                </label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                  Mật khẩu
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    className="pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {form.password && (
                  <div className="mt-2 space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-all ${i <= strength ? strengthColor : 'bg-slate-200 dark:bg-white/10'}`}
                        />
                      ))}
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: strength >= 3 ? '#22c55e' : strength >= 2 ? '#f59e0b' : '#ef4444' }}>
                      {strengthLabel}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                  Xác nhận mật khẩu
                </label>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  placeholder="••••••••"
                  required
                  className={form.confirmPassword && form.password !== form.confirmPassword ? 'border-red-500 focus:ring-red-500/20' : ''}
                />
                {form.confirmPassword && form.password !== form.confirmPassword && (
                  <p className="mt-1 text-[10px] text-red-500 font-bold uppercase tracking-widest">
                    Mật khẩu không khớp
                  </p>
                )}
              </div>

              <div className="flex items-start gap-3 pt-1">
                <input
                  type="checkbox"
                  id="agreeTerms"
                  checked={form.agreeTerms}
                  onChange={(e) => setForm({ ...form, agreeTerms: e.target.checked })}
                  className="w-4 h-4 mt-0.5 text-brand-blue border-slate-300 dark:border-white/10 rounded focus:ring-brand-blue bg-white dark:bg-white/5"
                />
                <label htmlFor="agreeTerms" className="block text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                  Tôi đồng ý với{' '}
                  <Link href="/terms" className="text-brand-blue hover:underline">Điều khoản dịch vụ</Link>
                  {' '}và{' '}
                  <Link href="/privacy" className="text-brand-blue hover:underline">Chính sách bảo mật</Link>
                </label>
              </div>

              <Button type="submit" className="w-full" disabled={loading} loading={loading} loadingText="Đang tạo tài khoản...">
                Tạo tài khoản
              </Button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-white/5 text-center">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-500">
                Đã có tài khoản?{' '}
                <Link href="/auth/login" className="text-brand-blue hover:underline transition-colors">
                  Đăng nhập ngay
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* Right - Info */}
        <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center p-12">
          <div className="relative z-10 max-w-md space-y-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-brand-blue/10 text-brand-blue rounded-3xl mb-6">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" x2="19" y1="8" y2="14" />
                  <line x1="22" x2="16" y1="11" y2="11" />
                </svg>
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-3">
                Tham gia cộng đồng MMO hàng đầu
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-relaxed">
                Hàng trăm dịch vụ SMM, Auto MXH, Tài nguyên MMO, Forum và nhiều hơn nữa
              </p>
            </div>

            <div className="space-y-4">
              {[
                { icon: '✓', text: 'Đăng ký miễn phí, không phí ẩn' },
                { icon: '✓', text: 'Hỗ trợ 24/7 từ đội ngũ chuyên nghiệp' },
                { icon: '✓', text: 'Thanh toán an toàn, bảo mật' },
                { icon: '✓', text: 'Cộng đồng người dùng đông đảo' },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-3 p-3 bg-white/50 dark:bg-white/5 rounded-xl">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-xs font-black shrink-0">
                    {item.icon}
                  </div>
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
