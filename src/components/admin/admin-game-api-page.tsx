'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Copy,
  FileText,
  KeyRound,
  Loader2,
  RefreshCw,
  RotateCw,
  Search,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, MetricCard, PageHero, SectionHeader, SectionPanel } from '@/components/ui/page-layout';
import { formatCurrency, toNumber } from '@/lib/utils';

type AccountRow = Record<string, unknown>;

interface AdminGameApiPageProps {
  baseUrl: string;
}

interface AccountsResponse {
  success: boolean;
  message?: string;
  data?: AccountRow[];
  stats?: Record<string, unknown>;
  pagination?: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function formatDateTime(value: unknown) {
  const text = String(value || '').trim();
  if (!text) {
    return 'Chưa có';
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return text;
  }

  return parsed.toLocaleString('vi-VN');
}

function getApiStatusLabel(value: unknown) {
  return String(value || '').trim().toLowerCase() === 'inactive' ? 'Tắt' : 'Bật';
}

export function AdminGameApiPage({ baseUrl }: AdminGameApiPageProps) {
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [stats, setStats] = useState<Record<string, unknown>>({});
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 25,
    total: 0,
    total_pages: 1,
  });
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState({
    search: '',
    page: 1,
    perPage: 25,
  });
  const [loading, setLoading] = useState(true);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [actionKey, setActionKey] = useState('');
  const syncedMissingRef = useRef(false);
  const basePathPreview = useMemo(() => baseUrl.replace(/^https?:\/\//, ''), [baseUrl]);

  useEffect(() => {
    let cancelled = false;
    const syncMissing = !syncedMissingRef.current;
    if (!syncedMissingRef.current) {
      syncedMissingRef.current = true;
    }

    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(query.page),
          per_page: String(query.perPage),
        });
        if (query.search.trim()) {
          params.set('search', query.search.trim());
        }
        if (syncMissing) {
          params.set('sync_missing', '1');
        }

        const response = await fetch(`/api/admin/game-api/accounts?${params.toString()}`, {
          cache: 'no-store',
        });
        const payload = await response.json() as AccountsResponse;
        if (!response.ok || !payload.success) {
          throw new Error(payload.message || 'Không thể tải Game API accounts');
        }

        if (cancelled) {
          return;
        }

        setRows(payload.data || []);
        setStats(payload.stats || {});
        setPagination(payload.pagination || {
          page: query.page,
          per_page: query.perPage,
          total: 0,
          total_pages: 1,
        });
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : 'Không thể tải Game API accounts');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [query.page, query.perPage, query.search, refreshNonce]);

  async function runAction(body: Record<string, unknown>, successMessage: string) {
    const actionName = String(body.action || '');
    const userId = String(body.user_id || body.userId || '');
    setActionKey(`${actionName}:${userId}`);
    try {
      const response = await fetch('/api/admin/game-api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể xử lý thao tác');
      }
      toast.success(successMessage);
      setRefreshNonce((value) => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể xử lý thao tác');
    } finally {
      setActionKey('');
    }
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Đã copy');
    } catch {
      toast.error('Không thể copy vào clipboard');
    }
  }

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Admin Only"
        title="Game API, Random Và Chợ Game"
        description="Module này cấp API cho web đối tác đấu trực tiếp vào kho tài khoản game, random game và chợ game của hệ thống. Mỗi account có một apikey riêng; user tự xem key của mình, admin quản lý và rotate khi cần."
        stats={[
          {
            label: 'Users',
            value: String(toNumber(stats.total_users, 0)),
            hint: 'Tổng account trong hệ thống',
            tone: 'blue',
          },
          {
            label: 'apikey ON',
            value: String(toNumber(stats.active_keys, 0)),
            hint: 'Key đang hoạt động',
            tone: 'emerald',
          },
          {
            label: 'Random/Game',
            value: `${toNumber(stats.game_accounts, 0)} / ${toNumber(stats.random_accounts, 0)}`,
            hint: 'Kho tài khoản API',
            tone: 'amber',
          },
          {
            label: 'Trao đổi Game',
            value: String(toNumber(stats.market_items, 0)),
            hint: 'Bài đang hiển thị',
            tone: 'violet',
          },
        ]}
        actions={
          <>
            <Badge variant="muted" className="rounded-full px-3 py-1.5">
              <ShieldCheck className="h-3 w-3" />
              `apikey` chỉ hiển thị ở admin
            </Badge>
            <Badge variant="info" className="rounded-full px-3 py-1.5">
              <Wallet className="h-3 w-3" />
              Dùng ví game
            </Badge>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/game-api/docs">
                <FileText className="h-4 w-4" />
                Mở API docs
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="apikey OFF"
          value={String(toNumber(stats.inactive_keys, 0))}
          hint="Có thể bật lại từng account"
          tone="slate"
          icon={<KeyRound className="h-4 w-4" />}
        />
        <MetricCard
          label="Thiếu Key"
          value={String(toNumber(stats.missing_keys, 0))}
          hint="Nên provision về 0"
          tone="amber"
          icon={<RefreshCw className="h-4 w-4" />}
        />
        <MetricCard
          label="Base URL"
          value="/api/external/game"
          hint="Namespace external cho game API"
          tone="blue"
        />
        <MetricCard
          label="Auth Header"
          value="x-api-key"
          hint="Authorization: Bearer cũng hỗ trợ"
          tone="emerald"
        />
      </div>

      <SectionPanel className="space-y-5">
        <SectionHeader
          eyebrow="Accounts"
          title="Quản lý apikey theo tài khoản"
          description="Toàn bộ key được neo theo account của web bạn. Web đối tác dùng chính key này để đọc giá, tạo đơn và poll trạng thái."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => runAction({ action: 'provision-missing' }, 'Đã provision apikey còn thiếu')}
                loading={actionKey === 'provision-missing:'}
              >
                <RefreshCw className="h-4 w-4" />
                Tạo key còn thiếu
              </Button>
              <Button
                variant="outline"
                onClick={() => setRefreshNonce((value) => value + 1)}
                loading={loading}
              >
                <RefreshCw className="h-4 w-4" />
                Reload
              </Button>
            </div>
          }
        />

        <div className="flex flex-col gap-3 xl:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Tìm theo user, email hoặc ID"
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setQuery((current) => ({ ...current, page: 1, search: searchInput.trim() }))}
            >
              Tìm
            </Button>
            <select
              value={String(query.perPage)}
              onChange={(event) => setQuery((current) => ({
                ...current,
                page: 1,
                perPage: Number(event.target.value || 25),
              }))}
              className="field-elevated h-10 rounded-xl px-3 text-sm font-semibold outline-none dark:text-white"
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option} / trang</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center rounded-[1.4rem] border border-dashed border-slate-200 px-4 py-12 text-sm font-semibold text-slate-500 dark:border-white/10 dark:text-slate-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Đang tải Game API accounts...
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="Chưa có account phù hợp"
            description="Không tìm thấy account nào theo bộ lọc hiện tại."
            icon={<KeyRound className="h-5 w-5" />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                <tr>
                  {['User', 'Ví game', 'apikey', 'Trạng thái', 'Last used', 'Thao tác'].map((label) => (
                    <th key={label} className="border-b border-slate-100 px-3 py-3 dark:border-white/5">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {rows.map((row) => {
                  const userId = Number(row.id || 0);
                  const status = String(row.api_status || 'active').trim().toLowerCase();
                  return (
                    <tr key={String(row.id)} className="align-top">
                      <td className="px-3 py-4">
                        <div className="font-black text-slate-950 dark:text-white">{String(row.username || '')}</div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{String(row.email || '')}</div>
                        <div className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                          ID #{userId} · {String(row.role || 'member')} · {String(row.status || 'active')}
                        </div>
                      </td>
                      <td className="px-3 py-4 font-black text-emerald-500">
                        {formatCurrency(toNumber(row.game_balance, 0))}
                      </td>
                      <td className="px-3 py-4">
                        <div className="max-w-[340px] break-all rounded-2xl bg-slate-50 px-4 py-3 font-mono text-[12px] font-semibold text-slate-700 dark:bg-white/5 dark:text-slate-200">
                          {String(row.api_key || 'Chưa có key')}
                        </div>
                        <div className="mt-2 flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyText(String(row.api_key || ''))}
                            disabled={!row.api_key}
                          >
                            <Copy className="h-4 w-4" />
                            Copy
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => runAction({ action: 'rotate', user_id: userId }, `Đã rotate apikey cho user #${userId}`)}
                            loading={actionKey === `rotate:${userId}`}
                          >
                            <RotateCw className="h-4 w-4" />
                            Rotate
                          </Button>
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <Badge variant={status === 'active' ? 'success' : 'warning'} className="rounded-full px-3 py-1.5">
                          {getApiStatusLabel(status)}
                        </Badge>
                        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          Cập nhật: {formatDateTime(row.api_updated_at)}
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <div className="font-semibold text-slate-700 dark:text-slate-200">
                          {formatDateTime(row.last_used_at)}
                        </div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          IP: {String(row.last_used_ip || 'Chưa có')}
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => runAction(
                            { action: 'set-status', user_id: userId, status: status === 'active' ? 'inactive' : 'active' },
                            `${status === 'active' ? 'Đã tắt' : 'Đã bật'} apikey cho user #${userId}`
                          )}
                          loading={actionKey === `set-status:${userId}`}
                        >
                          {status === 'active' ? 'Tắt key' : 'Bật key'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            Tổng {pagination.total} account
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={pagination.page <= 1}
              onClick={() => setQuery((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}
            >
              Trang trước
            </Button>
            <div className="flex items-center rounded-xl border border-slate-200 px-3 text-sm font-black dark:border-white/10">
              {pagination.page} / {pagination.total_pages}
            </div>
            <Button
              variant="outline"
              disabled={pagination.page >= pagination.total_pages}
              onClick={() => setQuery((current) => ({ ...current, page: Math.min(pagination.total_pages, current.page + 1) }))}
            >
              Trang sau
            </Button>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel className="space-y-5">
        <SectionHeader
          eyebrow="Docs"
          title="Trang Tài Liệu API Riêng"
          description="Phần tài liệu chi tiết đã được tách ra thành một trang admin riêng để dễ copy, đối soát và xuất PDF cho đội kỹ thuật."
          actions={
            <Button asChild>
              <Link href="/admin/game-api/docs">
                <FileText className="h-4 w-4" />
                Vào trang API docs
              </Link>
            </Button>
          }
        />

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-[1.4rem] border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-950/40">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Base URL</div>
            <div className="mt-3 break-all font-mono text-sm font-semibold text-slate-800 dark:text-slate-200">
              {baseUrl}
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-500 dark:text-slate-400">
              Đây là namespace external để web đối tác đấu trực tiếp vào API game của hệ thống.
            </p>
          </div>

          <div className="rounded-[1.4rem] border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-950/40">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Auth</div>
            <div className="mt-3 font-mono text-sm font-semibold text-slate-800 dark:text-slate-200">
              x-api-key / Authorization Bearer
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-500 dark:text-slate-400">
              Trang docs mới có đủ cách kết nối, mẫu request/response và lưu ý tích hợp cho từng endpoint.
            </p>
          </div>

          <div className="rounded-[1.4rem] border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-950/40">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Export</div>
            <div className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-200">
              Có nút xuất PDF ngay trong trang docs
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-500 dark:text-slate-400">
              Dùng để chốt tài liệu kỹ thuật và gửi cho dev bên đối tác mà không cần mở lại admin data page.
            </p>
          </div>
        </div>
        <div className="rounded-[1.4rem] border border-amber-200 bg-amber-50/80 px-4 py-4 text-sm font-semibold leading-7 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
          Endpoint docs mới nằm ở <code className="rounded bg-black/5 px-1.5 py-0.5 dark:bg-white/10">/admin/game-api/docs</code>.
          <br />
          Base URL hiện tại: <code className="rounded bg-black/5 px-1.5 py-0.5 dark:bg-white/10">{basePathPreview}</code>
        </div>
      </SectionPanel>
    </div>
  );
}
