'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Copy, KeyRound, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHero, SectionHeader, SectionPanel } from '@/components/ui/page-layout';

function base32ToBytes(input: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = input.replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase();
  let bits = '';

  for (const char of clean) {
    const value = alphabet.indexOf(char);
    if (value >= 0) bits += value.toString(2).padStart(5, '0');
  }

  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }

  return new Uint8Array(bytes);
}

async function totp(secret: string, step = 30) {
  const keyBytes = base32ToBytes(secret);
  if (!keyBytes.length) throw new Error('Secret không hợp lệ');

  const counter = Math.floor(Date.now() / 1000 / step);
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setUint32(0, Math.floor(counter / 0x100000000));
  view.setUint32(4, counter % 0x100000000);

  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, buffer));
  const offset = signature[signature.length - 1] & 0xf;
  const binary =
    ((signature[offset] & 0x7f) << 24) |
    ((signature[offset + 1] & 0xff) << 16) |
    ((signature[offset + 2] & 0xff) << 8) |
    (signature[offset + 3] & 0xff);

  return String(binary % 1_000_000).padStart(6, '0');
}

export default function TwoFactorLivePage() {
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('------');
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  const secondsLeft = useMemo(() => 30 - (Math.floor(Date.now() / 1000) % 30), [tick]);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let alive = true;
    if (!secret.trim()) {
      setCode('------');
      setError('');
      return;
    }

    totp(secret)
      .then((nextCode) => {
        if (!alive) return;
        setCode(nextCode);
        setError('');
      })
      .catch((err: Error) => {
        if (!alive) return;
        setCode('------');
        setError(err.message || 'Không tạo được mã 2FA');
      });

    return () => {
      alive = false;
    };
  }, [secret, tick]);

  async function copyCode() {
    if (!/^\d{6}$/.test(code)) return;
    await navigator.clipboard.writeText(code);
  }

  return (
    <main className="mmo-board mmo-board-page">
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHero
          eyebrow="Security Tool"
          title="Tạo mã 2FA trực tiếp trên trình duyệt"
          description="Công cụ 2FA Live giúp bạn sinh mã TOTP tức thời từ secret Base32 để xác thực đăng nhập và thao tác bảo mật an toàn hơn."
          stats={[
            { label: 'Chu kỳ', value: '30s', hint: 'TOTP chuẩn', tone: 'blue' },
            { label: 'Hash', value: 'SHA-1', hint: 'Google Authenticator', tone: 'emerald' },
            { label: 'Network', value: '0', hint: 'Tính local bằng WebCrypto', tone: 'violet' },
            { label: 'Output', value: '6 số', hint: 'Mã xác thực live', tone: 'amber' },
          ]}
          actions={<Link href="/user/home" className="surface-chip rounded-full px-5 py-3 text-xs font-black uppercase tracking-[0.18em] text-slate-600 dark:text-slate-200">Về workspace</Link>}
        />

        <SectionPanel className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <SectionHeader eyebrow="Generator" title="Tạo mã xác thực" description="Dán secret 2FA của tài khoản để nhận mã mới theo chu kỳ 30 giây mà không cần rời trình duyệt." />
            <Input
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              placeholder="JBSWY3DPEHPK3PXP..."
              className="h-14 font-mono tracking-[0.16em]"
            />
            {error ? <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-500">{error}</div> : null}
          </div>

          <div className="surface-card rounded-[1.7rem] p-6">
            <div className="flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-blue/10 text-brand-blue">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="rounded-full border border-sky-400/20 bg-[#04101f]/80 px-3 py-1.5 font-mono text-xs font-black text-slate-300">
                {secondsLeft}s
              </div>
            </div>
            <div className="mt-7 font-mono text-5xl font-black tracking-[0.18em] text-white">{code}</div>
            <div className="mt-6 flex gap-2">
              <Button type="button" className="flex-1" onClick={copyCode} disabled={!/^\d{6}$/.test(code)}>
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
              <Button type="button" variant="outline" size="icon" onClick={() => setTick((value) => value + 1)}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SectionPanel>

        <SectionPanel className="grid gap-3 md:grid-cols-3">
          {[
            { title: 'Không lưu secret', body: 'Secret chỉ tồn tại trong phiên trình duyệt hiện tại và không được ghi lại sau khi bạn rời trang.' },
            { title: 'Dùng cho xác thực', body: 'Mã sinh ra có thể phục vụ đăng nhập hoặc xác minh các thao tác bảo mật khi secret khớp với tài khoản của bạn.' },
            { title: 'Tách biệt lớp bảo vệ', body: 'Công cụ này chỉ hỗ trợ sinh mã 2FA, còn các lớp xác thực bổ sung vẫn được hệ thống xử lý theo cơ chế bảo mật riêng.' },
          ].map((item) => (
            <div key={item.title} className="surface-card rounded-[1.5rem] p-5">
              <KeyRound className="h-5 w-5 text-brand-blue" />
              <h2 className="mt-4 text-sm font-black uppercase tracking-[0.12em] text-slate-950 dark:text-white">{item.title}</h2>
              <p className="mt-2 text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">{item.body}</p>
            </div>
          ))}
        </SectionPanel>
      </div>
    </main>
  );
}
