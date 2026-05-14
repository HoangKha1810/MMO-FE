'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { KeyRound, RefreshCw, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MetricCard, PageHero, SectionHeader, SectionPanel } from '@/components/ui/page-layout';
import { formatCurrency, toNumber } from '@/lib/utils';

type UserRow = Record<string, unknown>;

interface UsersResponse {
  success: boolean;
  data?: UserRow[];
  pagination?: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
  message?: string;
}

const PAGE_SIZE = 25;

export function AdminUserPasswordsPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: PAGE_SIZE,
    total: 0,
    total_pages: 1,
  });
  const [passwords, setPasswords] = useState<Record<number, string>>({});
  const [savingUserId, setSavingUserId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          per_page: String(PAGE_SIZE),
        });
        if (query.trim()) {
          params.set('search', query.trim());
        }

        const response = await fetch(`/api/admin/users?${params.toString()}`, {
          cache: 'no-store',
        });
        const payload = await response.json() as UsersResponse;

        if (!response.ok || !payload.success) {
          throw new Error(payload.message || 'Không thể tải danh sách người dùng');
        }

        if (cancelled) {
          return;
        }

        setRows(payload.data || []);
        setPagination(payload.pagination || {
          page,
          per_page: PAGE_SIZE,
          total: 0,
          total_pages: 1,
        });
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : 'Không thể tải danh sách người dùng');
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
  }, [page, query]);

  const activeCount = useMemo(
    () => rows.filter((row) => String(row.status || '').trim().toLowerCase() === 'active').length,
    [rows]
  );

  async function submitPassword(userId: number) {
    const newPassword = String(passwords[userId] || '').trim();
    if (newPassword.length < 8) {
      toast.error('Mật khẩu mới phải có ít nhất 8 ký tự.');
      return;
    }

    setSavingUserId(userId);
    try {
      const response = await fetch('/api/admin/users/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          new_password: newPassword,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể đổi mật khẩu user');
      }

      toast.success(payload.message || 'Đã đổi mật khẩu');
      setPasswords((current) => ({
        ...current,
        [userId]: '',
      }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể đổi mật khẩu user');
    } finally {
      setSavingUserId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Admin Security"
        title="Đổi Mật Khẩu Người Dùng"
        description="Trang này cho phép admin xem toàn bộ user và đổi mật khẩu trực tiếp cho từng tài khoản mà không cần đi qua luồng quên mật khẩu."
        stats={[
          { label: 'Trang hiện tại', value: String(pagination.page), hint: `/${pagination.total_pages}`, tone: 'blue' },
          { label: 'User đang thấy', value: String(rows.length), hint: 'Theo bộ lọc hiện tại', tone: 'emerald' },
          { label: 'User active', value: String(activeCount), hint: 'Trong danh sách hiện tại', tone: 'amber' },
          { label: 'Tổng user', value: String(pagination.total), hint: 'Toàn hệ thống', tone: 'violet' },
        ]}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Reset trực tiếp"
          value="Admin only"
          hint="Đổi thẳng mật khẩu vào account user"
          tone="blue"
          icon={<KeyRound className="h-4 w-4" />}
        />
        <MetricCard
          label="Yêu cầu tối thiểu"
          value="8 ký tự"
          hint="Giống rule mật khẩu hệ thống"
          tone="emerald"
          icon={<KeyRound className="h-4 w-4" />}
        />
      </div>

      <SectionPanel className="space-y-5">
        <SectionHeader
          eyebrow="Lookup"
          title="Tìm người dùng cần đổi mật khẩu"
          description="Có thể tìm theo username, email, họ tên hoặc user ID."
          actions={
            <Button variant="outline" onClick={() => setPage((current) => current)}>
              <RefreshCw className="h-4 w-4" />
              Reload
            </Button>
          }
        />

        <div className="flex flex-col gap-3 xl:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Tìm theo username, email, họ tên hoặc ID"
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setPage(1);
                setQuery(searchInput.trim());
              }}
            >
              Tìm
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              <tr>
                {['User', 'Trạng thái', 'Số dư', 'Mật khẩu mới', 'Thao tác'].map((label) => (
                  <th key={label} className="border-b border-slate-100 px-3 py-3 dark:border-white/5">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {loading ? (
                <tr>
                  <td className="px-3 py-6 text-slate-400" colSpan={5}>Đang tải danh sách người dùng...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-slate-400" colSpan={5}>Không tìm thấy người dùng phù hợp.</td>
                </tr>
              ) : rows.map((row) => {
                const userId = Number(row.id || 0);
                return (
                  <tr key={String(row.id)} className="align-top">
                    <td className="px-3 py-4">
                      <div className="font-black text-slate-950 dark:text-white">{String(row.username || '')}</div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{String(row.email || '')}</div>
                      <div className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                        ID #{userId} · {String(row.fullname || 'Chưa có họ tên')}
                      </div>
                    </td>
                    <td className="px-3 py-4">
                      <Badge
                        variant={String(row.status || '').trim().toLowerCase() === 'active' ? 'success' : 'warning'}
                        className="rounded-full px-3 py-1.5"
                      >
                        {String(row.status || 'unknown')}
                      </Badge>
                    </td>
                    <td className="px-3 py-4 font-semibold text-slate-700 dark:text-slate-200">
                      <div>Ví chính: {formatCurrency(toNumber(row.balance, 0))}</div>
                      <div className="mt-1">Ví game: {formatCurrency(toNumber(row.game_balance, 0))}</div>
                    </td>
                    <td className="px-3 py-4">
                      <Input
                        type="password"
                        value={passwords[userId] || ''}
                        onChange={(event) => setPasswords((current) => ({
                          ...current,
                          [userId]: event.target.value,
                        }))}
                        placeholder="Nhập mật khẩu mới"
                      />
                    </td>
                    <td className="px-3 py-4">
                      <Button
                        onClick={() => void submitPassword(userId)}
                        loading={savingUserId === userId}
                        loadingText="Đang đổi..."
                      >
                        <KeyRound className="h-4 w-4" />
                        Đổi mật khẩu
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            Tổng {pagination.total} người dùng
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={pagination.page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Trang trước
            </Button>
            <div className="flex items-center rounded-xl border border-slate-200 px-3 text-sm font-black dark:border-white/10">
              {pagination.page} / {pagination.total_pages}
            </div>
            <Button
              variant="outline"
              disabled={pagination.page >= pagination.total_pages}
              onClick={() => setPage((current) => Math.min(pagination.total_pages, current + 1))}
            >
              Trang sau
            </Button>
          </div>
        </div>
      </SectionPanel>
    </div>
  );
}
