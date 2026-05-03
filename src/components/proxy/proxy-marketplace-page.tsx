'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Cloud,
  Copy,
  KeyRound,
  Loader2,
  RefreshCcw,
  Server,
  ShieldCheck,
  ShoppingCart,
  Wallet,
} from 'lucide-react';
import { useSessionUser, type SessionUser } from '@/hooks/use-session-user';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, MetricCard, PageHero, SectionHeader, SectionPanel } from '@/components/ui/page-layout';
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

function formatLocation(value: string) {
  return locationLabels[value] || value || 'Khác';
}

function buildProxyLine(item: ProxyOwnedItem) {
  return `${item.ipAddress}:${item.port}:${item.username}:${item.password}`;
}

export function ProxyMarketplacePage({ initialUser }: ProxyMarketplacePageProps) {
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

  const estimatedTotal = useMemo(() => {
    if (!selectedPackage) {
      return 0;
    }

    const totalDays = Math.max(selectedPackage.minDays, Number(days || 0));
    const totalQuantity = Math.max(1, Number(quantity || 0));
    return selectedPackage.sellPricePerDay * totalDays * totalQuantity;
  }, [days, quantity, selectedPackage]);

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

  async function handleBuy() {
    if (!selectedPackage) {
      toast.error('Bạn chưa chọn gói proxy');
      return;
    }

    const result = await submitAction(
      {
        action: 'buy',
        packageId: selectedPackage.id,
        days: Number(days || selectedPackage.minDays),
        quantity: Number(quantity || 1),
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <SectionPanel className="space-y-5">
          <SectionHeader
            eyebrow="Packages"
            title="Chọn gói proxy phù hợp"
            description="Danh sách package được lấy trực tiếp từ vendor và áp dụng giá bán / ngày theo cấu hình admin hiện tại."
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
            <div className="grid gap-4 md:grid-cols-2">
              {visiblePackages.map((item) => {
                const active = selectedPackage?.id === item.id;
                return (
                  <article
                    key={item.id}
                    className={`rounded-[1.5rem] border p-5 transition-all ${
                      active
                        ? 'border-brand-blue/30 bg-brand-blue/10 shadow-[0_24px_52px_-34px_rgba(37,99,235,0.55)]'
                        : 'border-slate-200/80 bg-white/78 hover:border-brand-blue/20 hover:bg-white dark:border-white/10 dark:bg-white/[0.035]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-blue/15 bg-brand-blue/10 text-brand-blue">
                        {item.location === 'datacenter' ? <Server className="h-5 w-5" /> : <Cloud className="h-5 w-5" />}
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Badge variant="info" className="rounded-full px-3 py-1.5">{formatLocation(item.location)}</Badge>
                        <Badge variant="muted" className="rounded-full px-3 py-1.5">{item.type}</Badge>
                      </div>
                    </div>

                    <div className="mt-4">
                      <h3 className="text-lg font-black uppercase leading-[1.15] tracking-[-0.03em] text-slate-950 dark:text-white">
                        {item.name}
                      </h3>
                      {item.label ? (
                        <div className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-500">
                          {item.label}
                        </div>
                      ) : null}
                      <p className="mt-3 text-sm font-semibold leading-7 text-slate-500 dark:text-slate-400">
                        {item.note || `Tối thiểu ${item.minDays} ngày, tối đa ${item.maxQuantity} proxy cho mỗi lần mua.`}
                      </p>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div className="rounded-[1.15rem] bg-slate-50 px-4 py-3 dark:bg-white/[0.04]">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Giá / ngày</div>
                        <div className="mt-2 text-base font-black text-brand-blue">{formatCurrency(item.sellPricePerDay)}</div>
                      </div>
                      <div className="rounded-[1.15rem] bg-slate-50 px-4 py-3 dark:bg-white/[0.04]">
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Gia hạn / ngày</div>
                        <div className="mt-2 text-base font-black text-slate-950 dark:text-white">{formatCurrency(item.renewPricePerDay)}</div>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                      <span>{item.durationDays} ngày chuẩn</span>
                      <span>•</span>
                      <span>Vendor: {formatCurrency(item.providerPrice)}</span>
                    </div>

                    <Button
                      type="button"
                      className="mt-5 w-full"
                      variant={active ? 'secondary' : 'default'}
                      onClick={() => {
                        setSelectedPackageId(item.id);
                        setDays(String(item.minDays));
                      }}
                    >
                      {active ? 'Đang chọn' : 'Chọn gói này'}
                    </Button>
                  </article>
                );
              })}
            </div>
          )}
        </SectionPanel>

        <div className="space-y-4">
          <MetricCard
            label="Ước tính đơn"
            value={selectedPackage ? formatCurrency(estimatedTotal) : '—'}
            hint="Tổng tiền dựa trên giá / ngày và số lượng đang nhập."
            tone="blue"
            icon={<Wallet className="h-4 w-4" />}
          />
          <MetricCard
            label="Protocol"
            value={protocol}
            hint="HTTP hoặc SOCKS5 theo chuẩn hỗ trợ từ vendor."
            tone="emerald"
            icon={<ShieldCheck className="h-4 w-4" />}
          />

          <Card>
            <CardHeader>
              <CardTitle>Mua Proxy</CardTitle>
              <CardDescription>Chọn package, số ngày, số lượng và thông tin bảo mật để tạo đơn mua mới.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="space-y-2">
                <span className="block text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Package</span>
                <select
                  value={selectedPackage?.id || ''}
                  onChange={(event) => setSelectedPackageId(event.target.value)}
                  className="field-elevated h-11 w-full rounded-[1rem] px-4 text-sm font-semibold text-slate-900 outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10 dark:text-white"
                >
                  {packages.filter((item) => item.enabled).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} - {formatLocation(item.location)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="block text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Số ngày</span>
                  <Input
                    type="number"
                    min={selectedPackage?.minDays || 1}
                    value={days}
                    onChange={(event) => setDays(event.target.value)}
                  />
                </label>
                <label className="space-y-2">
                  <span className="block text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Số lượng</span>
                  <Input
                    type="number"
                    min={1}
                    max={selectedPackage?.maxQuantity || 1}
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="block text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Protocol</span>
                  <select
                    value={protocol}
                    onChange={(event) => setProtocol(event.target.value === 'SOCKS5' ? 'SOCKS5' : 'HTTP')}
                    className="field-elevated h-11 w-full rounded-[1rem] px-4 text-sm font-semibold text-slate-900 outline-none focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10 dark:text-white"
                  >
                    <option value="HTTP">HTTP</option>
                    <option value="SOCKS5">SOCKS5</option>
                  </select>
                </label>
                <div className="rounded-[1.2rem] border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Tổng thanh toán</div>
                  <div className="mt-2 text-lg font-black text-brand-blue">{selectedPackage ? formatCurrency(estimatedTotal) : '—'}</div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="block text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Username</span>
                  <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="random" />
                </label>
                <label className="space-y-2">
                  <span className="block text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Password</span>
                  <Input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="random" />
                </label>
              </div>

              <Button
                type="button"
                className="w-full"
                onClick={handleBuy}
                disabled={
                  submitting ||
                  !overview?.settings.envConfigured ||
                  overview?.settings.serviceStatus === 'maintenance' ||
                  !selectedPackage
                }
                loading={submitting}
                loadingText="Đang gửi đơn..."
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                Mua proxy ngay
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

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
