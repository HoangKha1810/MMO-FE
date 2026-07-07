'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Cloud,
  Copy,
  KeyRound,
  Loader2,
  Minus,
  Plus,
  RefreshCcw,
  Server,
  ShieldCheck,
  ShoppingCart,
  ChevronDown,
} from 'lucide-react';
import { useSessionUser, type SessionUser } from '@/hooks/use-session-user';
import { useWalletBalance } from '@/components/layout/wallet-balance-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useConfirmDialog } from '@/components/ui/confirm-dialog-provider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { EmptyState, PageHero, SectionHeader, SectionPanel } from '@/components/ui/page-layout';
import { formatDatabaseDateTime } from '@/lib/date-time';
import { formatCurrency } from '@/lib/utils';
import type { ProxyMarketplaceOverview, ProxyOwnedItem, ProxyPackageRecord } from '@/types/proxy';

interface ProxyMarketplacePageProps {
  initialUser?: SessionUser;
}

const locationLabels: Record<string, string> = {
  residential: 'Residential',
  datacenter: 'Datacenter',
};

const PROXY_VAT_PERCENT = 8;

function formatLocation(value: string) {
  return locationLabels[value] || value || 'Khác';
}

function buildProxyLine(item: ProxyOwnedItem) {
  return `${item.ipAddress}:${item.port}:${item.username}:${item.password}`;
}

function packageSearchText(item: ProxyPackageRecord) {
  return `${item.name} ${item.location} ${item.type}`.toLowerCase();
}

function getPackageDisplayName(item: ProxyPackageRecord) {
  const haystack = packageSearchText(item);
  const isPrivate = haystack.includes('private');
  const isShare = haystack.includes('share') || haystack.includes('shared');

  if (haystack.includes('residential') || haystack.includes('resident')) {
    if (isPrivate) return 'RESIDENT PRIVATE';
    if (isShare) return 'RESIDENT SHARE';
  }

  if (haystack.includes('datacenter') || haystack.includes('data center')) {
    if (isPrivate) return 'DATACENTER PRIVATE';
    if (isShare) return 'DATACENTER SHARE';
  }

  return item.name;
}

function getPackageUsageLabel(item: ProxyPackageRecord) {
  const haystack = packageSearchText(item);

  if (haystack.includes('private')) {
    return 'Dùng Riêng Cá Nhân';
  }

  if (haystack.includes('share') || haystack.includes('shared')) {
    return 'Dùng Chung Mọi Người';
  }

  return item.label || formatLocation(item.location);
}

function getSafeInteger(value: string, min: number, max?: number) {
  const parsed = Math.trunc(Number(value));
  const fallback = Number.isFinite(parsed) ? parsed : min;
  const lowerBounded = Math.max(min, fallback);
  return typeof max === 'number' ? Math.min(max, lowerBounded) : lowerBounded;
}

function calculateProxySubtotal(item: ProxyPackageRecord, dayValue: string, quantityValue: string) {
  const totalDays = getSafeInteger(dayValue, item.minDays);
  const totalQuantity = getSafeInteger(quantityValue, 1, item.maxQuantity);
  return item.sellPricePerDay * totalDays * totalQuantity;
}

function calculateProxyTotal(item: ProxyPackageRecord, dayValue: string, quantityValue: string) {
  const subtotal = calculateProxySubtotal(item, dayValue, quantityValue);
  return Math.round(subtotal + (subtotal * PROXY_VAT_PERCENT) / 100);
}

function NumberStepper({
  label,
  value,
  min,
  max,
  onChange,
  onInteract,
}: {
  label: string;
  value: string;
  min: number;
  max?: number;
  onChange: (value: string) => void;
  onInteract?: () => void;
}) {
  function commit(nextValue: number) {
    const clamped = typeof max === 'number' ? Math.min(max, Math.max(min, nextValue)) : Math.max(min, nextValue);
    onChange(String(clamped));
  }

  return (
    <div className="flex h-11 w-full max-w-[11rem] overflow-hidden rounded-[0.75rem] border border-slate-200 bg-white shadow-[0_12px_28px_-24px_rgba(15,23,42,0.42)] dark:border-white/10 dark:bg-white/[0.04]">
      <button
        type="button"
        aria-label={`Giảm ${label}`}
        className="flex w-11 shrink-0 items-center justify-center border-r border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-brand-blue dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.06]"
        onClick={() => {
          onInteract?.();
          commit(getSafeInteger(value, min, max) - 1);
        }}
      >
        <Minus className="h-4 w-4" />
      </button>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        aria-label={label}
        onFocus={onInteract}
        onChange={(event) => {
          onInteract?.();
          onChange(event.target.value);
        }}
        onBlur={() => onChange(String(getSafeInteger(value, min, max)))}
        className="min-w-0 flex-1 border-0 bg-transparent px-2 text-center text-sm font-black text-slate-950 outline-none dark:text-white"
      />
      <button
        type="button"
        aria-label={`Tăng ${label}`}
        className="flex w-11 shrink-0 items-center justify-center border-l border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-brand-blue dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.06]"
        onClick={() => {
          onInteract?.();
          commit(getSafeInteger(value, min, max) + 1);
        }}
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ProxyMarketplacePage({ initialUser }: ProxyMarketplacePageProps) {
  const { confirm } = useConfirmDialog();
  const { setBalances } = useWalletBalance();
  const session = useSessionUser(initialUser);
  const user = session.data;
  const [overview, setOverview] = useState<ProxyMarketplaceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [locationFilter, setLocationFilter] = useState('all');
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [days, setDays] = useState('3');
  const [quantity, setQuantity] = useState('1');
  const [protocol, setProtocol] = useState<'HTTP' | 'SOCKS5'>('HTTP');
  const [username, setUsername] = useState('random');
  const [password, setPassword] = useState('random');
  const [selectedProxyIds, setSelectedProxyIds] = useState<number[]>([]);
  const [renewDays, setRenewDays] = useState('3');
  const [securityUsername, setSecurityUsername] = useState('random');
  const [securityPassword, setSecurityPassword] = useState('random');

  async function loadOverview() {
    setLoading(true);
    try {
      const response = await fetch('/api/proxy', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-store' },
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể tải dữ liệu proxy');
      }
      setOverview(payload.data as ProxyMarketplaceOverview);
      setLoadError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải dữ liệu proxy';
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOverview();
  }, []);

  const packages = overview?.packages || [];
  const proxies = overview?.proxies || [];
  const orders = overview?.orders || [];
  const visiblePackages = useMemo(() => {
    if (locationFilter === 'all') {
      return packages.filter((item) => item.enabled);
    }
    return packages.filter((item) => item.enabled && item.location === locationFilter);
  }, [locationFilter, packages]);

  const selectedPackage = useMemo(
    () => packages.find((item) => item.id === selectedPackageId) || visiblePackages[0] || null,
    [packages, selectedPackageId, visiblePackages]
  );

  useEffect(() => {
    if (!overview) {
      return;
    }

    const fallbackPackage = visiblePackages[0] || packages.find((item) => item.enabled) || null;
    if (!selectedPackageId && fallbackPackage) {
      setSelectedPackageId(fallbackPackage.id);
    }
  }, [overview, packages, selectedPackageId, visiblePackages]);

  useEffect(() => {
    if (!selectedPackage) {
      return;
    }

    setProtocol(overview?.settings.defaultProtocol || 'HTTP');
    setDays((current) => {
      const numeric = Number(current || 0);
      return String(Math.max(selectedPackage.minDays, Number.isFinite(numeric) ? numeric : selectedPackage.minDays));
    });
  }, [overview?.settings.defaultProtocol, selectedPackage?.id]);

  const selectedProxies = useMemo(
    () => proxies.filter((item) => selectedProxyIds.includes(item.id)),
    [proxies, selectedProxyIds]
  );

  function toggleProxy(id: number) {
    setSelectedProxyIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  function selectAllVisibleProxies() {
    setSelectedProxyIds((current) => {
      if (current.length === proxies.length) {
        return [];
      }
      return proxies.map((item) => item.id);
    });
  }

  async function submitAction(body: Record<string, unknown>, successMessage: string) {
    setSubmitting(true);
    try {
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Thao tác proxy thất bại');
      }
      if (payload.data && typeof payload.data.balanceAfter === 'number') {
        setBalances({ balance: payload.data.balanceAfter });
      }
      toast.success(successMessage);
      await loadOverview();
      return payload.data;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Thao tác proxy thất bại');
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  function focusPackage(item: ProxyPackageRecord) {
    if (selectedPackageId === item.id) {
      return;
    }

    setSelectedPackageId(item.id);
    setQuantity('1');
    setDays(String(item.minDays));
  }

  async function handleBuy(packageToBuy?: ProxyPackageRecord | null, draft?: { days: string; quantity: string }) {
    if (!packageToBuy) {
      toast.error('Bạn chưa chọn gói proxy');
      return;
    }

    const totalDays = getSafeInteger(draft?.days ?? days, packageToBuy.minDays);
    const totalQuantity = getSafeInteger(draft?.quantity ?? quantity, 1, packageToBuy.maxQuantity);
    const totalPrice = calculateProxyTotal(packageToBuy, String(totalDays), String(totalQuantity));
    setSelectedPackageId(packageToBuy.id);
    setDays(String(totalDays));
    setQuantity(String(totalQuantity));

    const confirmed = await confirm({
      title: 'Xác nhận mua proxy',
      description: `Bạn sắp thanh toán ${formatCurrency(totalPrice)} cho gói ${getPackageDisplayName(packageToBuy)} (${totalDays} ngày · ${totalQuantity} proxy). Hệ thống sẽ trừ tiền ngay khi bạn xác nhận.`,
      confirmText: 'Thanh toán ngay',
      cancelText: 'Kiểm tra lại',
      tone: 'brand',
    });

    if (!confirmed) {
      return;
    }

    const result = await submitAction(
      {
        action: 'buy',
        packageId: packageToBuy.id,
        days: totalDays,
        quantity: totalQuantity,
        protocol,
        username,
        password,
      },
      'Đã tạo đơn mua proxy'
    );

    if (result) {
      setSelectedProxyIds([]);
    }
  }

  async function handleRenew() {
    const result = await submitAction(
      {
        action: 'renew',
        ids: selectedProxyIds,
        days: Number(renewDays || 1),
      },
      'Đã gửi yêu cầu gia hạn proxy'
    );

    if (result) {
      setSelectedProxyIds([]);
    }
  }

  async function handleSyncIp() {
    const result = await submitAction(
      {
        action: 'sync-ip',
        ids: selectedProxyIds,
      },
      'Đã đồng bộ IP mới nhất'
    );

    if (result) {
      setSelectedProxyIds([]);
    }
  }

  async function handleSecurityUpdate() {
    const result = await submitAction(
      {
        action: 'update-security',
        ids: selectedProxyIds,
        username: securityUsername,
        password: securityPassword,
      },
      'Đã cập nhật bảo mật proxy'
    );

    if (result) {
      setSelectedProxyIds([]);
    }
  }

  async function copyProxyLine(item: ProxyOwnedItem) {
    try {
      await navigator.clipboard.writeText(buildProxyLine(item));
      toast.success(`Đã copy proxy #${item.providerProxyId}`);
    } catch {
      toast.error('Không thể copy proxy');
    }
  }

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Proxy Cloud"
        title={overview?.settings.serviceName || 'Proxy Cloud'}
        description={overview?.settings.serviceDescription || 'Mua proxy trực tiếp bằng số dư tài khoản và quản lý vòng đời proxy ngay trong hệ thống.'}
        stats={[
          { label: 'Gói bán', value: String(overview?.stats.enabledPackages || 0), hint: 'Package đang mở bán', tone: 'blue' },
          { label: 'Proxy sở hữu', value: String(overview?.stats.totalOwned || 0), hint: 'Số proxy đang lưu trong tài khoản', tone: 'emerald' },
          { label: 'Sắp hết hạn', value: String(overview?.stats.expiringSoon || 0), hint: 'Cần gia hạn sớm', tone: 'amber' },
          { label: 'Số dư', value: user ? formatCurrency(user.balance || 0) : '—', hint: 'Wallet hiện tại', tone: 'violet' },
        ]}
        actions={
          <>
            <Badge variant={overview?.settings.serviceStatus === 'maintenance' ? 'warning' : 'success'} className="rounded-full px-3 py-1.5">
              {overview?.settings.serviceStatus === 'maintenance' ? 'Đang bảo trì' : 'Đang mở bán'}
            </Badge>
            {loading ? (
              <Badge variant="info" className="rounded-full px-3 py-1.5">
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Loading...
              </Badge>
            ) : null}
          </>
        }
      >
        {loadError && !overview ? (
          <div className="rounded-[1.25rem] border border-amber-500/25 bg-amber-500/10 px-4 py-4 text-sm font-semibold leading-7 text-amber-700 dark:text-amber-300">
            Không tải được trạng thái proxy từ server: {loadError}
          </div>
        ) : null}
        {overview?.vendorError ? (
          <div className="rounded-[1.25rem] border border-amber-500/25 bg-amber-500/10 px-4 py-4 text-sm font-semibold leading-7 text-amber-700 dark:text-amber-300">
            Vendor proxy đang phản hồi lỗi: {overview.vendorError}
          </div>
        ) : null}
        {overview?.settings.serviceNote ? (
          <div className="rounded-[1.25rem] border border-slate-200/80 bg-white/75 px-4 py-4 text-sm font-semibold leading-7 text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
            {overview.settings.serviceNote}
          </div>
        ) : null}
      </PageHero>

      <SectionPanel className="space-y-5">
        <SectionHeader
          eyebrow="Packages"
          title="Chọn gói proxy phù hợp"
          description="Mỗi gói có form mua nhanh riêng: chọn số lượng, số ngày, giao thức mạng và thông tin username/password trước khi đăng ký."
          actions={
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'all', label: 'Tất cả' },
                { key: 'residential', label: 'Residential' },
                { key: 'datacenter', label: 'Datacenter' },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setLocationFilter(item.key)}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] transition-all ${
                    locationFilter === item.key
                      ? 'border-brand-blue bg-brand-blue text-white'
                      : 'border-slate-200/80 bg-white/80 text-slate-500 hover:border-brand-blue/25 hover:text-brand-blue dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          }
        />

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="mr-3 h-5 w-5 animate-spin" />
            Đang tải gói proxy
          </div>
        ) : loadError && !overview ? (
          <EmptyState
            title="Không tải được dữ liệu proxy"
            description={loadError}
            icon={<ShieldCheck className="h-5 w-5" />}
          />
        ) : !overview?.settings.envConfigured ? (
          <EmptyState
            title="Chưa cấu hình token proxy"
            description="Admin cần thêm PROXY_VNCLOUD_TOKEN vào env trước khi module proxy có thể hiển thị package và xử lý đơn mua."
            icon={<ShieldCheck className="h-5 w-5" />}
          />
        ) : overview?.vendorError ? (
          <EmptyState
            title="Không đọc được package từ vendor"
            description={overview.vendorError}
            icon={<Cloud className="h-5 w-5" />}
          />
        ) : visiblePackages.length === 0 ? (
          <EmptyState
            title="Chưa có package đang mở bán"
            description="Hiện chưa có gói proxy phù hợp với bộ lọc hoặc admin đang tắt toàn bộ package."
            icon={<Cloud className="h-5 w-5" />}
          />
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {visiblePackages.map((item) => {
              const active = selectedPackage?.id === item.id;
              const cardDays = active ? days : String(item.minDays);
              const cardQuantity = active ? quantity : '1';
              const basePrice = calculateProxySubtotal(item, String(item.minDays), '1');
              const cardTotal = calculateProxyTotal(item, cardDays, cardQuantity);
              const displayName = getPackageDisplayName(item);
              const usageLabel = getPackageUsageLabel(item);

              return (
                <article
                  key={item.id}
                  onFocusCapture={() => focusPackage(item)}
                  className={`rounded-[1rem] border p-5 shadow-sm transition-all ${
                    active
                      ? 'border-brand-blue/35 bg-white shadow-[0_28px_70px_-50px_rgba(37,99,235,0.55)] dark:bg-white/[0.07]'
                      : 'border-slate-200/80 bg-white/90 hover:border-brand-blue/25 hover:shadow-[0_24px_60px_-52px_rgba(15,23,42,0.42)] dark:border-white/10 dark:bg-white/[0.035]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="break-words text-xl font-black uppercase leading-[1.15] tracking-normal text-slate-950 dark:text-white">
                        {displayName}
                      </h3>
                      <p className="mt-2 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-300">
                        {usageLabel}
                      </p>
                    </div>
                    <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[0.85rem] border border-brand-blue/15 bg-brand-blue/10 text-brand-blue">
                      {item.location === 'datacenter' ? <Server className="h-5 w-5" /> : <Cloud className="h-5 w-5" />}
                    </div>
                  </div>

                  <div className="mt-6 rounded-[0.9rem] border border-slate-100 bg-slate-50/90 px-4 py-4 dark:border-white/10 dark:bg-white/[0.04]">
                    <div className="text-sm font-bold text-slate-500 dark:text-slate-300">Chi phí cơ bản</div>
                    <div className="mt-1 flex flex-wrap items-end gap-2">
                      <span className="font-mono text-3xl font-black leading-none tracking-normal text-rose-600 dark:text-rose-400">
                        {formatCurrency(basePrice)}
                      </span>
                      <span className="pb-1 text-sm font-bold text-slate-500 dark:text-slate-300">/ {item.minDays} ngày</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-[0.08em]">
                      <span className="rounded-md bg-emerald-500 px-2 py-1 text-white">
                        {item.label || 'Giá cấu hình'}
                      </span>
                      <span className="rounded-md bg-white px-2 py-1 text-slate-500 dark:bg-white/[0.06] dark:text-slate-300">
                        {formatCurrency(item.sellPricePerDay)} / ngày
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Số lượng Proxy</span>
                      <NumberStepper
                        label="số lượng proxy"
                        value={cardQuantity}
                        min={1}
                        max={item.maxQuantity}
                        onInteract={() => focusPackage(item)}
                        onChange={setQuantity}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Số ngày duy trì</span>
                      <NumberStepper
                        label="số ngày duy trì"
                        value={cardDays}
                        min={item.minDays}
                        onInteract={() => focusPackage(item)}
                        onChange={setDays}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Giao thức Mạng</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            onClick={() => focusPackage(item)}
                            className="field-elevated flex h-11 w-full max-w-[11rem] items-center justify-between rounded-[0.75rem] px-4 text-left text-sm font-black text-slate-900 outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10 dark:text-white"
                          >
                            <span>{protocol}</span>
                            <ChevronDown className="ml-3 h-4 w-4 shrink-0 text-slate-400" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[var(--radix-dropdown-menu-trigger-width)] rounded-[1rem]">
                          {(['HTTP', 'SOCKS5'] as const).map((protocolItem) => (
                            <DropdownMenuItem
                              key={protocolItem}
                              className={protocol === protocolItem ? 'bg-brand-blue/10 text-brand-blue' : ''}
                              onClick={() => {
                                focusPackage(item);
                                setProtocol(protocolItem);
                              }}
                            >
                              {protocolItem}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 rounded-[0.9rem] border border-sky-100 bg-sky-50/80 p-4 dark:border-cyan-300/10 dark:bg-cyan-400/[0.06] sm:grid-cols-2">
                    <label className="space-y-2">
                      <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">Username</span>
                      <Input
                        value={username}
                        onFocus={() => focusPackage(item)}
                        onChange={(event) => {
                          focusPackage(item);
                          setUsername(event.target.value);
                        }}
                        placeholder="random"
                        className="bg-white/90 dark:bg-white/[0.04]"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">Password</span>
                      <Input
                        value={password}
                        onFocus={() => focusPackage(item)}
                        onChange={(event) => {
                          focusPackage(item);
                          setPassword(event.target.value);
                        }}
                        placeholder="random"
                        className="bg-white/90 dark:bg-white/[0.04]"
                      />
                    </label>
                  </div>

                  <div className="mt-5 border-t border-slate-100 pt-5 dark:border-white/10">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm font-bold text-slate-500 dark:text-slate-300">Cần thanh toán:</span>
                      <span className="font-mono text-xl font-black tracking-normal text-rose-600 dark:text-rose-400">
                        {formatCurrency(cardTotal)}
                      </span>
                    </div>

                    <Button
                      type="button"
                      className="mt-4 w-full"
                      onClick={() => void handleBuy(item, { days: cardDays, quantity: cardQuantity })}
                      disabled={
                        submitting ||
                        !overview?.settings.envConfigured ||
                        overview?.settings.serviceStatus === 'maintenance'
                      }
                      loading={submitting && active}
                      loadingText="Đang gửi đơn..."
                    >
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      Đăng ký ngay
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </SectionPanel>

      <SectionPanel className="space-y-5">
        <SectionHeader
          eyebrow="Owned Proxies"
          title="Proxy bạn đang sở hữu"
          description="Chọn nhiều proxy để gia hạn, đồng bộ IP mới nhất hoặc đổi lại username/password trực tiếp trong hệ thống."
          actions={
            <Button type="button" variant="outline" onClick={selectAllVisibleProxies}>
              {selectedProxyIds.length === proxies.length && proxies.length > 0 ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </Button>
          }
        />

        {selectedProxies.length > 0 ? (
          <div className="rounded-[1.5rem] border border-brand-blue/20 bg-brand-blue/10 p-4">
            <div className="text-sm font-black uppercase tracking-[0.16em] text-brand-blue">
              Đã chọn {selectedProxies.length} proxy
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,240px)_auto_auto]">
              <label className="space-y-2">
                <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Gia hạn thêm</span>
                <Input type="number" min={1} value={renewDays} onChange={(event) => setRenewDays(event.target.value)} />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={handleRenew} disabled={submitting} loading={submitting} loadingText="Đang gia hạn...">
                  Gia hạn
                </Button>
                <Button type="button" variant="outline" onClick={handleSyncIp} disabled={submitting}>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Sync IP
                </Button>
              </div>
              <div className="grid gap-3 min-[560px]:grid-cols-[1fr_1fr_auto]">
                <Input value={securityUsername} onChange={(event) => setSecurityUsername(event.target.value)} placeholder="Username mới hoặc random" />
                <Input value={securityPassword} onChange={(event) => setSecurityPassword(event.target.value)} placeholder="Password mới hoặc random" />
                <Button type="button" variant="secondary" onClick={handleSecurityUpdate} disabled={submitting}>
                  <KeyRound className="mr-2 h-4 w-4" />
                  Đổi bảo mật
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="mr-3 h-5 w-5 animate-spin" />
            Đang tải danh sách proxy
          </div>
        ) : proxies.length === 0 ? (
          <EmptyState
            title="Bạn chưa có proxy nào"
            description="Sau khi mua thành công, proxy sẽ xuất hiện tại đây để bạn copy, gia hạn hoặc đồng bộ IP bất cứ lúc nào."
            icon={<Cloud className="h-5 w-5" />}
          />
        ) : (
          <div className="grid gap-4">
            {proxies.map((item) => {
              const checked = selectedProxyIds.includes(item.id);
              return (
                <article
                  key={item.id}
                  className={`grid gap-4 rounded-[1.45rem] border p-4 transition-all md:grid-cols-[auto_minmax(0,1fr)_auto] ${
                    checked
                      ? 'border-brand-blue/30 bg-brand-blue/10'
                      : 'border-slate-200/80 bg-white/75 dark:border-white/10 dark:bg-white/[0.035]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleProxy(item.id)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue/30"
                    />
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-brand-blue/15 bg-brand-blue/10 text-brand-blue">
                      {item.location === 'datacenter' ? <Server className="h-5 w-5" /> : <Cloud className="h-5 w-5" />}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-black uppercase tracking-[0.04em] text-slate-950 dark:text-white">
                        #{item.providerProxyId}
                      </div>
                      <Badge variant="info" className="rounded-full px-3 py-1.5">{formatLocation(item.location)}</Badge>
                      <Badge variant={item.status.toLowerCase() === 'active' ? 'success' : 'warning'} className="rounded-full px-3 py-1.5">
                        {item.status}
                      </Badge>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-[1.1rem] bg-slate-50 px-4 py-3 dark:bg-white/[0.04]">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Host</div>
                        <div className="mt-2 text-sm font-black text-slate-950 dark:text-white">{item.ipAddress}:{item.port}</div>
                      </div>
                      <div className="rounded-[1.1rem] bg-slate-50 px-4 py-3 dark:bg-white/[0.04]">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">User / Pass</div>
                        <div className="mt-2 text-sm font-black text-slate-950 dark:text-white">{item.username} / {item.password}</div>
                      </div>
                      <div className="rounded-[1.1rem] bg-slate-50 px-4 py-3 dark:bg-white/[0.04]">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Hết hạn</div>
                        <div className="mt-2 text-sm font-black text-slate-950 dark:text-white">{formatDatabaseDateTime(item.expiredAt)}</div>
                      </div>
                      <div className="rounded-[1.1rem] bg-slate-50 px-4 py-3 dark:bg-white/[0.04]">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Package</div>
                        <div className="mt-2 text-sm font-black text-slate-950 dark:text-white">{item.packageName || item.packageId}</div>
                      </div>
                    </div>

                    <div className="mt-3 text-xs font-semibold leading-6 text-slate-500 dark:text-slate-400">
                      Tạo lúc {formatDatabaseDateTime(item.createdAt)}
                      {item.lastSyncedAt ? ` • Sync gần nhất ${formatDatabaseDateTime(item.lastSyncedAt)}` : ''}
                    </div>
                  </div>

                  <div className="flex items-start justify-end">
                    <Button type="button" variant="outline" onClick={() => void copyProxyLine(item)}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </SectionPanel>

      <SectionPanel className="space-y-5">
        <SectionHeader
          eyebrow="Order Log"
          title="Lịch sử đơn proxy"
          description="Theo dõi những lần mua mới và gia hạn proxy gần nhất của bạn."
        />

        {orders.length === 0 ? (
          <EmptyState
            title="Chưa có đơn proxy"
            description="Những đơn mua và gia hạn proxy sẽ xuất hiện tại đây ngay sau khi phát sinh."
            icon={<ShoppingCart className="h-5 w-5" />}
          />
        ) : (
          <div className="grid gap-3">
            {orders.map((order) => (
              <div
                key={order.id}
                className="grid gap-4 rounded-[1.35rem] border border-slate-200/80 bg-white/75 p-4 dark:border-white/10 dark:bg-white/[0.035] md:grid-cols-[150px_minmax(0,1fr)_150px]"
              >
                <div className="flex items-center gap-2">
                  <Badge variant={order.kind === 'renew' ? 'warning' : 'info'} className="rounded-full px-3 py-1.5">
                    {order.kind === 'renew' ? 'Gia hạn' : 'Mua mới'}
                  </Badge>
                  <Badge variant={order.status === 'completed' ? 'success' : order.status === 'partial' ? 'warning' : 'muted'} className="rounded-full px-3 py-1.5">
                    {order.status}
                  </Badge>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-black uppercase tracking-[0.04em] text-slate-950 dark:text-white">
                    {order.packageName || `Proxy order #${order.id}`}
                  </div>
                  <div className="mt-2 text-xs font-semibold leading-6 text-slate-500 dark:text-slate-400">
                    {order.quantity} proxy • {order.days} ngày • {formatLocation(order.location)} • {formatDatabaseDateTime(order.createdAt)}
                  </div>
                  {order.note ? (
                    <div className="mt-2 text-xs font-semibold leading-6 text-slate-500 dark:text-slate-400">
                      {order.note}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center justify-end text-right">
                  <div>
                    <div className="text-sm font-black text-brand-blue">{formatCurrency(order.totalPrice)}</div>
                    <div className="mt-1 text-xs font-semibold text-slate-400">{formatCurrency(order.unitPrice)} / ngày</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionPanel>
    </div>
  );
}
