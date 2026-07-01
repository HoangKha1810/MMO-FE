'use client';

import { useEffect, useMemo, useState } from 'react';
import { Ban, CheckCircle2, Loader2, RefreshCw, ShieldAlert, UnlockKeyhole } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, SectionHeader, SectionPanel } from '@/components/ui/page-layout';
import { readJsonResponse } from '@/lib/client-api';
import { cn } from '@/lib/utils';

type OwnerDeviceRow = {
  id: number | string;
  user_id?: number | string | null;
  username?: string | null;
  email?: string | null;
  label?: string | null;
  device_hash?: string | null;
  user_agent?: string | null;
  first_ip?: string | null;
  last_ip?: string | null;
  trust_level?: string | null;
  first_seen_at?: string | Date | null;
  last_seen_at?: string | Date | null;
  revoked_at?: string | Date | null;
  revoked_reason?: string | null;
  device_status?: string | null;
  ip_banned?: number | boolean | null;
};

type ApiResponse = {
  success: boolean;
  message?: string;
  devices?: OwnerDeviceRow[];
};

function formatDate(value: unknown) {
  if (!value) return 'Chưa có';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('vi-VN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function shortHash(value: unknown) {
  const text = String(value || '');
  if (text.length <= 18) return text || 'unknown';
  return `${text.slice(0, 10)}...${text.slice(-8)}`;
}

export function OwnerDeviceControlPage() {
  const [devices, setDevices] = useState<OwnerDeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [reason, setReason] = useState('Owner logout device and lock IP');
  const [search, setSearch] = useState('');

  async function loadDevices(silent = false) {
    if (!silent) setLoading(true);
    try {
      const response = await fetch('/api/admin/security/owner-devices', { cache: 'no-store' });
      const payload = await readJsonResponse<ApiResponse>(response, 'Không thể tải thiết bị owner');
      if (!payload.success) throw new Error(payload.message || 'Không thể tải thiết bị owner');
      setDevices(payload.devices || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể tải thiết bị owner');
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void loadDevices();
  }, []);

  const filteredDevices = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return devices;
    return devices.filter((device) => [
      device.username,
      device.email,
      device.label,
      device.device_hash,
      device.first_ip,
      device.last_ip,
      device.user_agent,
      device.revoked_reason,
    ].some((value) => String(value || '').toLowerCase().includes(keyword)));
  }, [devices, search]);

  async function runDeviceAction(device: OwnerDeviceRow, action: 'revoke' | 'restore') {
    const id = String(device.id || '');
    if (!id) return;
    const message = action === 'revoke'
      ? 'Đăng xuất thiết bị owner này và khóa IP đăng nhập gần nhất? Thiết bị/IP đó sẽ không vào lại được cho tới khi owner mở thủ công.'
      : 'Mở lại thiết bị owner này? IP bị khóa do revoke cũng sẽ được gỡ nếu đúng reason hệ thống.';
    if (!window.confirm(message)) return;

    setSavingId(id);
    try {
      const response = await fetch('/api/admin/security/owner-devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          id,
          reason: action === 'revoke' ? reason : undefined,
          unblock_ip: true,
        }),
      });
      const payload = await readJsonResponse<ApiResponse>(response, 'Không thể xử lý thiết bị');
      if (!payload.success) throw new Error(payload.message || 'Không thể xử lý thiết bị');
      toast.success(action === 'revoke' ? 'Đã đăng xuất và khóa thiết bị/IP' : 'Đã mở lại thiết bị owner');
      await loadDevices(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể xử lý thiết bị');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <SectionPanel className="space-y-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#07111f]">
      <SectionHeader
        eyebrow="Owner Security"
        title="Thiết bị owner"
        description="Đăng xuất thiết bị owner từ xa, revoke thiết bị và khóa IP đăng nhập gần nhất. Muốn dùng lại phải mở thủ công tại đây."
        actions={
          <Button type="button" variant="outline" onClick={() => void loadDevices()} disabled={loading}>
            <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
            Làm mới
          </Button>
        }
      />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)]">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm theo username, IP, thiết bị, user-agent..."
        />
        <Input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Lý do khóa thiết bị/IP"
        />
      </div>

      {loading ? (
        <div className="flex min-h-[260px] items-center justify-center rounded-[1.5rem] border border-dashed border-slate-200 text-slate-500 dark:border-white/10 dark:text-white/50">
          <Loader2 className="mr-3 h-5 w-5 animate-spin" />
          Đang tải danh sách thiết bị...
        </div>
      ) : filteredDevices.length === 0 ? (
        <EmptyState
          title="Không có thiết bị owner"
          description="Thiết bị owner sẽ xuất hiện sau khi owner đăng nhập và xác thực mã bảo mật."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredDevices.map((device) => {
            const revoked = Boolean(device.revoked_at) || String(device.device_status || '').toLowerCase() === 'revoked';
            const ipBanned = device.ip_banned === true || Number(device.ip_banned || 0) > 0;
            const id = String(device.id || '');
            return (
              <article
                key={id}
                className={cn(
                  'rounded-[1.5rem] border p-5 shadow-[0_28px_80px_-56px_rgba(15,23,42,0.3)]',
                  revoked
                    ? 'border-red-400/25 bg-red-500/[0.06]'
                    : 'border-emerald-400/20 bg-emerald-500/[0.05]'
                )}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn(
                        'inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]',
                        revoked ? 'bg-red-500/15 text-red-300' : 'bg-emerald-500/15 text-emerald-300'
                      )}>
                        {revoked ? <Ban className="mr-1.5 h-3.5 w-3.5" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
                        {revoked ? 'Revoked' : 'Trusted'}
                      </span>
                      {ipBanned ? (
                        <span className="inline-flex items-center rounded-full bg-amber-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">
                          <ShieldAlert className="mr-1.5 h-3.5 w-3.5" />
                          IP banned
                        </span>
                      ) : null}
                    </div>
                    <h2 className="mt-4 truncate text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white">
                      {device.label || device.username || `Owner device #${id}`}
                    </h2>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-500 dark:text-white/50">
                      {device.username || 'owner'} • {device.email || 'no-email'}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {revoked ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={savingId === id}
                        onClick={() => void runDeviceAction(device, 'restore')}
                      >
                        <UnlockKeyhole className="mr-2 h-4 w-4" />
                        Mở lại
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={savingId === id}
                        onClick={() => void runDeviceAction(device, 'revoke')}
                      >
                        <Ban className="mr-2 h-4 w-4" />
                        Đăng xuất & khóa
                      </Button>
                    )}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
                  <Info label="IP đầu tiên" value={device.first_ip || 'unknown'} />
                  <Info label="IP gần nhất" value={device.last_ip || 'unknown'} />
                  <Info label="Thấy lần đầu" value={formatDate(device.first_seen_at)} />
                  <Info label="Thấy gần nhất" value={formatDate(device.last_seen_at)} />
                  <Info label="Hash thiết bị" value={shortHash(device.device_hash)} />
                  <Info label="Trust level" value={device.trust_level || 'owner_manual'} />
                </div>

                <div className="mt-4 rounded-[1rem] border border-slate-200/70 bg-white/70 p-3 text-xs font-semibold leading-6 text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/55">
                  <div className="font-black uppercase tracking-[0.14em] text-slate-400 dark:text-white/35">User agent</div>
                  <div className="mt-1 break-all">{device.user_agent || 'unknown'}</div>
                  {revoked ? (
                    <div className="mt-3 break-words text-red-300">
                      Revoked: {formatDate(device.revoked_at)} • {device.revoked_reason || 'Không có lý do'}
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </SectionPanel>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-slate-200/70 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-white/35">
        {label}
      </div>
      <div className="mt-1 break-all text-sm font-bold text-slate-700 dark:text-white/80">
        {value}
      </div>
    </div>
  );
}
