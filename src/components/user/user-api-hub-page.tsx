'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Copy,
  Gamepad2,
  Layers,
  PlusCircle,
  RefreshCcw,
  Search,
  Server,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SectionHeader, SectionPanel } from '@/components/ui/page-layout';
import {
  buildAutoMxhApiDocs,
  type AutoMxhApiDocsRuntimeMeta,
  type AutoMxhApiDocsService,
  type AutoMxhDocsCatalogSection,
} from '@/lib/automxh-api-docs';
import { buildGameApiDocs } from '@/lib/game-api-docs';
import {
  buildSmmApiDocs,
  type SmmApiDocsRuntimeMeta,
  type SmmApiDocsService,
} from '@/lib/smm-api-docs';
import type { SmmServiceRecord } from '@/lib/smm-provider';

type ApiModuleKey = 'automxh' | 'smm' | 'game';

type EndpointDoc = {
  id: string;
  title: string;
  method: 'GET' | 'POST';
  endpoint: string;
  description: string;
  parameters?: Array<{
    name: string;
    description: string;
    required?: boolean;
  }>;
  requestPayloadTitle: string;
  requestPayload: string;
  requestExample: string;
  responseExample: string;
  errorExample: string;
  notes: string[];
};

type ConnectionMethod = {
  id: string;
  title: string;
  description: string;
  language: string;
  code: string;
};

type ApiModule = {
  key: ApiModuleKey;
  eyebrow: string;
  title: string;
  description: string;
  rootEndpoint: string;
  wallet: string;
  summary: string;
  tone: 'blue' | 'emerald' | 'amber' | 'violet' | 'slate';
  icon: ReactNode;
  authNotes: string[];
  priceNotes: string[];
  connectionMethods: ConnectionMethod[];
  endpoints: EndpointDoc[];
  autoServices?: AutoMxhApiDocsService[];
  smmServices?: SmmApiDocsService[];
  loadError?: string;
};

interface UserApiHubPageProps {
  baseUrls: {
    automxh: string;
    smm: string;
    game: string;
  };
  automxhSections: AutoMxhDocsCatalogSection[];
  smmServices: SmmServiceRecord[];
  automxhRuntimeMeta: AutoMxhApiDocsRuntimeMeta;
  smmRuntimeMeta: SmmApiDocsRuntimeMeta;
  loadedAt: string;
  loadErrors?: {
    automxh?: string;
    smm?: string;
    game?: string;
  };
}

interface UserApikeyPayload {
  success: boolean;
  apikey?: string;
  status?: string;
  last_used_at?: string | null;
  message?: string;
}

async function copyText(value: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(successMessage);
  } catch {
    toast.error('Không thể copy vào clipboard');
  }
}

function formatMoney(value: number, maxDigits = 2) {
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: maxDigits,
  }).format(Number(value || 0));
}

function compactNumber(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function maskApikey(value?: string) {
  const raw = String(value || '').trim();
  if (!raw) return 'Đang tải...';
  if (raw.length <= 14) return raw.replace(/.(?=.{4})/g, '*');
  return `${raw.slice(0, 8)}*******${raw.slice(-6)}`;
}

function getRelativeEndpoint(module: ApiModule, endpoint: EndpointDoc) {
  const rawEndpoint = String(endpoint.endpoint || '');
  let path = rawEndpoint;

  try {
    const parsed = new URL(rawEndpoint);
    path = `${parsed.pathname}${parsed.search}`;
  } catch {
    path = rawEndpoint.replace(module.rootEndpoint, '') || '/';
  }

  if (module.key !== 'game') {
    path = rawEndpoint.replace(module.rootEndpoint, '') || '/';
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (endpoint.method === 'GET' && !/[?&](apikey|api_key|key)=/i.test(normalizedPath)) {
    return `${normalizedPath}${normalizedPath.includes('?') ? '&' : '?'}apikey=API_KEY`;
  }

  return normalizedPath;
}

function getEndpointParameters(endpoint: EndpointDoc) {
  if (endpoint.parameters && endpoint.parameters.length > 0) {
    return endpoint.parameters;
  }

  return [
    {
      name: 'apikey',
      description: 'apikey riêng của user',
      required: true,
    },
  ];
}

function normalizeSmmText(value: string) {
  return String(value || '')
    .replaceAll('ttmmo_game_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'ttmmo_apikey_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
    .replaceAll('API key do admin cấp', 'apikey riêng của user')
    .replaceAll('API key', 'apikey');
}

function normalizeSmmEndpoint(endpoint: EndpointDoc): EndpointDoc {
  return {
    ...endpoint,
    description: normalizeSmmText(endpoint.description),
    requestPayloadTitle: normalizeSmmText(endpoint.requestPayloadTitle),
    requestPayload: normalizeSmmText(endpoint.requestPayload),
    requestExample: normalizeSmmText(endpoint.requestExample),
    responseExample: normalizeSmmText(endpoint.responseExample),
    errorExample: normalizeSmmText(endpoint.errorExample),
    parameters: endpoint.parameters?.map((parameter) => ({
      ...parameter,
      name: normalizeSmmText(parameter.name),
      description: normalizeSmmText(parameter.description),
    })),
    notes: endpoint.notes.map(normalizeSmmText),
  };
}

function CodeBlock({
  title,
  code,
  language,
}: {
  title: string;
  code: string;
  language: string;
}) {
  return (
    <div className="space-y-2 rounded-[1rem] border border-slate-200 bg-slate-950/95 p-4 dark:border-white/10">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Badge variant="muted" className="shrink-0 rounded-full px-3 py-1.5">
            {language}
          </Badge>
          <div className="truncate text-[11px] font-black uppercase tracking-[0.18em] text-slate-300">
            {title}
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => void copyText(code, `Đã copy ${title}`)}>
          <Copy className="h-4 w-4" />
          Copy
        </Button>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap break-words text-[12px] font-semibold leading-6 text-slate-100">
        {code}
      </pre>
    </div>
  );
}

function ParametersTable({ parameters = [] }: { parameters?: EndpointDoc['parameters'] }) {
  if (!parameters || parameters.length === 0) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-[1rem] border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950/40">
      <table className="w-full min-w-[560px] text-left">
        <thead className="border-b border-slate-100 bg-slate-50/90 text-xs font-black text-slate-700 dark:border-white/5 dark:bg-white/[0.04] dark:text-slate-200">
          <tr>
            <th className="px-4 py-3">Parameters</th>
            <th className="px-4 py-3">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm font-semibold text-slate-700 dark:divide-white/5 dark:text-slate-200">
          {parameters.map((parameter) => (
            <tr key={parameter.name}>
              <td className="px-4 py-3 font-mono text-xs font-black text-slate-950 dark:text-white">
                {parameter.name}
                {parameter.required ? (
                  <Badge variant="warning" className="ml-2 rounded-full px-2 py-0.5 text-[10px]">
                    bắt buộc
                  </Badge>
                ) : null}
              </td>
              <td className="px-4 py-3 leading-6 text-slate-600 dark:text-slate-300">{parameter.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ApiInfoTable({
  module,
  apikey,
  loading,
  onCopyApikey,
  onRefreshApikey,
}: {
  module: ApiModule;
  apikey: string;
  loading: boolean;
  onCopyApikey: () => void;
  onRefreshApikey: () => void;
}) {
  const methods = Array.from(new Set(module.endpoints.map((endpoint) => endpoint.method))).join(', ');

  return (
    <section className="rounded-[1rem] border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/40">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <tbody className="divide-y divide-slate-200 border border-slate-200 dark:divide-white/10 dark:border-white/10">
            <tr className="divide-x divide-slate-200 dark:divide-white/10">
              <td className="w-[30%] bg-slate-50 px-4 py-4 text-base font-bold text-slate-600 dark:bg-white/[0.03] dark:text-slate-300">
                Base API URL
              </td>
              <td className="px-4 py-4 font-mono text-base font-black text-slate-700 dark:text-white">
                {module.rootEndpoint}
              </td>
            </tr>
            <tr className="divide-x divide-slate-200 dark:divide-white/10">
              <td className="w-[30%] bg-slate-50 px-4 py-4 text-base font-bold text-slate-600 dark:bg-white/[0.03] dark:text-slate-300">
                API Key
              </td>
              <td className="px-4 py-4">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="font-mono text-base font-black text-rose-500">
                    {loading ? 'Đang tải...' : maskApikey(apikey)}
                  </span>
                  <button
                    type="button"
                    onClick={onCopyApikey}
                    disabled={!apikey}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-white dark:hover:bg-white/10"
                    aria-label="Copy apikey"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={onRefreshApikey}
                    disabled={loading}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-white dark:hover:bg-white/10"
                    aria-label="Refresh apikey"
                  >
                    <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </td>
            </tr>
            {[
              ['HTTP Method', methods || 'GET, POST'],
              ['Content-Type', 'application/json, text/plain'],
              ['Response', 'JSON'],
            ].map(([label, value]) => (
              <tr key={label} className="divide-x divide-slate-200 dark:divide-white/10">
                <td className="w-[30%] bg-slate-50 px-4 py-4 text-base font-bold text-slate-600 dark:bg-white/[0.03] dark:text-slate-300">
                  {label}
                </td>
                <td className="px-4 py-4 font-mono text-base font-black text-slate-700 dark:text-white">
                  {value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PlainCodeBlock({ code }: { code: string }) {
  return (
    <pre className="max-h-[420px] overflow-auto rounded-none bg-slate-50 p-5 font-mono text-sm font-semibold leading-8 text-slate-700 dark:bg-slate-950/70 dark:text-slate-200">
      {code}
    </pre>
  );
}

function AutoMxhPriceTable({ services }: { services: AutoMxhApiDocsService[] }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const sorted = [...services].sort((a, b) => a.category_name.localeCompare(b.category_name) || a.product_id - b.product_id || a.id - b.id);
    if (!needle) return sorted.slice(0, 40);
    return sorted
      .filter((service) =>
        [
          service.variant_id,
          service.product_id,
          service.name,
          service.product_name,
          service.category_name,
          service.category_slug,
          service.type,
          service.badge,
          service.api_provider_id,
          service.api_service_id,
        ].join(' ').toLowerCase().includes(needle)
      )
      .slice(0, 60);
  }, [query, services]);

  return (
    <LivePriceShell
      title="Bảng Giá AutoMXH"
      description="Dữ liệu lấy từ gói AutoMXH active trên web. Giá là giá bán cho đại lý khi gọi API."
      query={query}
      onQueryChange={setQuery}
      placeholder="Tìm variant, product, category..."
    >
      <table className="w-full min-w-[900px] text-left">
        <thead className="border-b border-slate-100 bg-slate-50/90 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 dark:border-white/5 dark:bg-white/[0.04] dark:text-slate-400">
          <tr>
            <th className="px-4 py-4">Variant</th>
            <th className="px-4 py-4">Dịch vụ</th>
            <th className="px-4 py-4">Số lượng</th>
            <th className="px-4 py-4 text-right">Giá web</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
          {filtered.length > 0 ? filtered.map((service) => (
            <tr key={`${service.product_id}-${service.variant_id}`} className="align-top">
              <td className="px-4 py-4">
                <div className="font-mono text-[12px] font-black text-slate-900 dark:text-white">#{service.variant_id}</div>
                <div className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">Product {service.product_id}</div>
              </td>
              <td className="px-4 py-4">
                <div className="max-w-[420px] text-sm font-black leading-6 text-slate-900 dark:text-white">{service.product_name}</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Badge variant="muted" className="rounded-full px-2.5 py-1">{service.category_name}</Badge>
                  {service.badge ? <Badge variant="warning" className="rounded-full px-2.5 py-1">{service.badge}</Badge> : null}
                  {service.type ? <Badge variant="info" className="rounded-full px-2.5 py-1">{service.type}</Badge> : null}
                </div>
                <div className="mt-2 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">{service.name}</div>
              </td>
              <td className="px-4 py-4 text-sm font-bold tabular-nums text-slate-700 dark:text-slate-200">{compactNumber(service.quantity)}</td>
              <td className="px-4 py-4 text-right">
                <div className="font-mono text-sm font-black tabular-nums text-emerald-600 dark:text-emerald-300">{formatMoney(service.price)} đ</div>
                <div className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">Tổng {formatMoney(service.total_to_pay)} đ</div>
              </td>
            </tr>
          )) : (
            <tr>
              <td colSpan={4} className="px-4 py-10 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
                Không tìm thấy gói AutoMXH phù hợp.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </LivePriceShell>
  );
}

function SmmPriceTable({ services }: { services: SmmApiDocsService[] }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const sorted = [...services].sort((a, b) => b.total_orders - a.total_orders || a.name.localeCompare(b.name));
    if (!needle) return sorted.slice(0, 40);
    return sorted
      .filter((service) =>
        [
          service.service,
          service.name,
          service.category,
          service.platform,
          service.type,
        ].join(' ').toLowerCase().includes(needle)
      )
      .slice(0, 60);
  }, [query, services]);

  return (
    <LivePriceShell
      title="Bảng Giá SMM"
      description="Dữ liệu lấy từ cache dịch vụ SMM đang active. Giá là giá web hiện tại dùng cho API."
      query={query}
      onQueryChange={setQuery}
      placeholder="Tìm service, platform, category..."
    >
      <table className="w-full min-w-[980px] text-left">
        <thead className="border-b border-slate-100 bg-slate-50/90 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 dark:border-white/5 dark:bg-white/[0.04] dark:text-slate-400">
          <tr>
            <th className="px-4 py-4">Service</th>
            <th className="px-4 py-4">Dịch vụ</th>
            <th className="px-4 py-4">Min / Max</th>
            <th className="px-4 py-4 text-right">Giá / 1K</th>
            <th className="px-4 py-4 text-right">Đơn</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
          {filtered.length > 0 ? filtered.map((service) => (
            <tr key={`${service.provider_id}-${service.service}`} className="align-top">
              <td className="px-4 py-4">
                <div className="font-mono text-[12px] font-black text-slate-900 dark:text-white">#{service.service}</div>
                <div className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">Service ID tạo đơn</div>
              </td>
              <td className="px-4 py-4">
                <div className="max-w-[420px] text-sm font-black leading-6 text-slate-900 dark:text-white">{service.name}</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Badge variant="muted" className="rounded-full px-2.5 py-1">{service.platform}</Badge>
                  <Badge variant={service.is_comment_service ? 'warning' : 'info'} className="rounded-full px-2.5 py-1">{service.type}</Badge>
                  {service.refill ? <Badge variant="success" className="rounded-full px-2.5 py-1">Refill</Badge> : null}
                </div>
                <div className="mt-2 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">{service.category}</div>
              </td>
              <td className="px-4 py-4 text-sm font-bold tabular-nums text-slate-700 dark:text-slate-200">
                {compactNumber(service.min)} - {compactNumber(service.max)}
              </td>
              <td className="px-4 py-4 text-right">
                <div className="font-mono text-sm font-black tabular-nums text-emerald-600 dark:text-emerald-300">{formatMoney(service.price_per_1k_vnd, 4)} đ</div>
                <div className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">{formatMoney(service.price_per_unit_vnd, 4)} đ / 1</div>
              </td>
              <td className="px-4 py-4 text-right font-mono text-sm font-bold tabular-nums text-slate-700 dark:text-slate-200">
                {compactNumber(service.total_orders)}
              </td>
            </tr>
          )) : (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
                Không tìm thấy dịch vụ SMM phù hợp.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </LivePriceShell>
  );
}

function LivePriceShell({
  title,
  description,
  query,
  onQueryChange,
  placeholder,
  children,
}: {
  title: string;
  description: string;
  query: string;
  onQueryChange: (value: string) => void;
  placeholder: string;
  children: ReactNode;
}) {
  return (
    <SectionPanel className="space-y-5">
      <SectionHeader
        eyebrow="Live Prices"
        title={title}
        description={description}
        actions={
          <div className="relative w-[min(420px,80vw)]">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={placeholder}
              className="h-11 w-full rounded-full border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
            />
          </div>
        }
      />
      <div className="overflow-hidden rounded-[1rem] border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950/40">
        <div className="overflow-x-auto">{children}</div>
      </div>
    </SectionPanel>
  );
}

function GameEndpointOverview({ endpoints }: { endpoints: EndpointDoc[] }) {
  return (
    <SectionPanel className="space-y-5">
      <SectionHeader
        eyebrow="Game API"
        title="Endpoint Game Public"
        description="Game API dùng cùng apikey nhưng trừ ví game. Các endpoint tương thích dạng profile.php, products.php, product.php, buy_product và order.php."
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {endpoints.map((endpoint) => (
          <article key={endpoint.id} className="rounded-[1rem] border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-slate-950/40">
            <div className="flex items-center gap-2">
              <Badge variant={endpoint.method === 'POST' ? 'info' : 'muted'} className="rounded-full px-3 py-1.5">
                {endpoint.method}
              </Badge>
              <div className="min-w-0 truncate text-sm font-black text-slate-950 dark:text-white">{endpoint.title}</div>
            </div>
            <div className="mt-3 break-all font-mono text-[12px] font-semibold text-brand-blue">{endpoint.endpoint}</div>
            <p className="mt-3 line-clamp-3 text-xs font-semibold leading-6 text-slate-500 dark:text-slate-400">{endpoint.description}</p>
          </article>
        ))}
      </div>
    </SectionPanel>
  );
}

export function UserApiHubPage({
  baseUrls,
  automxhSections,
  smmServices,
  automxhRuntimeMeta,
  smmRuntimeMeta,
  loadedAt,
  loadErrors = {},
}: UserApiHubPageProps) {
  const [apiPayload, setApiPayload] = useState<UserApikeyPayload | null>(null);
  const [apiLoading, setApiLoading] = useState(true);
  const [activeModuleKey, setActiveModuleKey] = useState<ApiModuleKey>('automxh');
  const [activeEndpointId, setActiveEndpointId] = useState('services');

  async function loadApikey() {
    setApiLoading(true);

    try {
      const response = await fetch('/api/user/apikey', {
        cache: 'no-store',
        credentials: 'include',
        headers: { 'Cache-Control': 'no-store' },
      });
      const payload = await response.json() as UserApikeyPayload;

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Không thể tải apikey');
      }

      setApiPayload(payload);
    } catch (error) {
      setApiPayload({
        success: false,
        message: error instanceof Error ? error.message : 'Không thể tải apikey',
      });
    } finally {
      setApiLoading(false);
    }
  }

  useEffect(() => {
    void loadApikey();
  }, []);

  const modules = useMemo<Record<ApiModuleKey, ApiModule>>(() => {
    const autoDocs = buildAutoMxhApiDocs(baseUrls.automxh, automxhSections, automxhRuntimeMeta);
    const smmDocs = buildSmmApiDocs(baseUrls.smm, smmServices, smmRuntimeMeta);
    const gameDocs = buildGameApiDocs(baseUrls.game);
    const normalizedSmmEndpoints = smmDocs.endpoints.map((endpoint) => normalizeSmmEndpoint(endpoint as EndpointDoc));

    return {
      automxh: {
        key: 'automxh',
        eyebrow: 'AutoMXH API',
        title: 'AutoMXH',
        description: 'Lấy catalog, bảng giá, quote, tạo đơn, kiểm tra đơn và lịch sử AutoMXH bằng apikey riêng.',
        rootEndpoint: `${autoDocs.baseUrl}/api/external/automxh`,
        wallet: 'Ví chính',
        summary: `${autoDocs.summary.totalServices} gói`,
        tone: 'blue',
        icon: <Sparkles className="h-5 w-5" />,
        authNotes: autoDocs.authNotes,
        priceNotes: autoDocs.priceNotes,
        connectionMethods: autoDocs.connectionMethods,
        endpoints: autoDocs.endpoints,
        autoServices: autoDocs.services,
        loadError: loadErrors.automxh,
      },
      smm: {
        key: 'smm',
        eyebrow: 'SMM API',
        title: 'SMM',
        description: 'Đấu API SMM kiểu panel: lấy services, quote, add order, status, balance, deposit và lịch sử.',
        rootEndpoint: `${smmDocs.baseUrl}/api/external/smm`,
        wallet: 'Ví chính',
        summary: `${smmDocs.summary.totalServices} dịch vụ`,
        tone: 'emerald',
        icon: <Server className="h-5 w-5" />,
        authNotes: smmDocs.authNotes.map(normalizeSmmText),
        priceNotes: smmDocs.priceNotes.map(normalizeSmmText),
        connectionMethods: smmDocs.connectionMethods.map((method) => ({
          ...method,
          description: normalizeSmmText(method.description),
          code: normalizeSmmText(method.code),
        })),
        endpoints: normalizedSmmEndpoints,
        smmServices: smmDocs.services,
        loadError: loadErrors.smm,
      },
      game: {
        key: 'game',
        eyebrow: 'Game API',
        title: 'Game',
        description: 'Đấu API kho game/random/game-market bằng apikey riêng; lệnh mua sẽ trừ ví game của tài khoản.',
        rootEndpoint: gameDocs.baseUrl,
        wallet: 'Ví game',
        summary: `${gameDocs.endpoints.length} endpoint`,
        tone: 'violet',
        icon: <Gamepad2 className="h-5 w-5" />,
        authNotes: gameDocs.authNotes,
        priceNotes: [
          'Game API dùng ví game, tách với ví chính đang dùng cho AutoMXH và SMM.',
          'products.php trả catalog đang bán trên web; buy_product mới tạo đơn thật và trừ ví game.',
          'profile.php dùng để kiểm tra username và số dư ví game của apikey hiện tại.',
        ],
        connectionMethods: gameDocs.connectionMethods,
        endpoints: gameDocs.endpoints,
        loadError: loadErrors.game,
      },
    };
  }, [automxhRuntimeMeta, automxhSections, baseUrls, loadErrors, smmRuntimeMeta, smmServices]);

  const activeModule = modules[activeModuleKey];
  const activeEndpoint = activeModule.endpoints.find((endpoint) => endpoint.id === activeEndpointId) || activeModule.endpoints[0];
  const apikey = String(apiPayload?.apikey || '').trim();

  const selectModule = (key: ApiModuleKey) => {
    const nextModule = modules[key];
    setActiveModuleKey(key);
    setActiveEndpointId(nextModule.endpoints[0]?.id || '');
  };

  async function copyApikey() {
    if (!apikey) {
      toast.error(apiPayload?.message || 'Chưa có apikey để copy');
      return;
    }

    await copyText(apikey, 'Đã copy apikey');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 dark:border-white/10 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.32em] text-brand-blue">Đấu API</div>
          <h1 className="mt-2 text-2xl font-black uppercase tracking-[-0.02em] text-slate-950 dark:text-white sm:text-3xl">
            Tài liệu tích hợp API
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-slate-500 dark:text-slate-400">
            Một apikey riêng cho từng tài khoản. AutoMXH/SMM trừ ví chính, Game trừ ví game.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/user/home">
              <Wallet className="h-4 w-4" />
              Về màn chính
            </Link>
          </Button>
          <Button onClick={() => void copyText(activeModule.rootEndpoint, `Đã copy Base API URL ${activeModule.title}`)}>
            <Copy className="h-4 w-4" />
            Copy Base URL
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {(Object.values(modules) as ApiModule[]).map((module) => (
          <button
            key={module.key}
            type="button"
            onClick={() => selectModule(module.key)}
            className={`group flex min-w-0 items-start gap-4 rounded-[1rem] border p-4 text-left transition ${
              activeModuleKey === module.key
                ? 'border-brand-blue bg-brand-blue/10 shadow-lg shadow-brand-blue/10'
                : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-brand-blue/30 dark:border-white/10 dark:bg-white/[0.04]'
            }`}
          >
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] border border-brand-blue/20 bg-brand-blue/10 text-brand-blue">
              {module.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-black uppercase tracking-[0.24em] text-slate-400 dark:text-white/40">
                {module.eyebrow}
              </span>
              <span className="mt-1 block text-lg font-black uppercase tracking-[-0.02em] text-slate-950 dark:text-white">
                {module.title}
              </span>
              <span className="mt-2 block text-xs font-semibold leading-6 text-slate-500 dark:text-slate-400">
                {module.description}
              </span>
              <span className="mt-3 flex flex-wrap gap-2">
                <Badge variant="muted" className="rounded-full px-2.5 py-1">{module.wallet}</Badge>
                <Badge variant="info" className="rounded-full px-2.5 py-1">{module.summary}</Badge>
              </span>
            </span>
          </button>
        ))}
      </div>

      <ApiInfoTable
        module={activeModule}
        apikey={apikey}
        loading={apiLoading}
        onCopyApikey={() => void copyApikey()}
        onRefreshApikey={() => void loadApikey()}
      />

      {activeModule.loadError ? (
        <SectionPanel className="border-amber-200 bg-amber-50/80 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
          <div className="text-sm font-black uppercase tracking-[0.18em]">Cảnh báo tải dữ liệu {activeModule.title}</div>
          <p className="mt-2 text-sm font-semibold leading-7">{activeModule.loadError}</p>
        </SectionPanel>
      ) : null}

      <section className="rounded-[1rem] border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-slate-950/40 sm:p-4">
        <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="space-y-3">
            <div className="rounded-[0.75rem] bg-brand-blue px-5 py-4 text-base font-black text-white">
              {activeModule.title} API
            </div>
            <div className="space-y-2">
              {activeModule.endpoints.map((endpoint) => (
                <button
                  key={endpoint.id}
                  type="button"
                  onClick={() => setActiveEndpointId(endpoint.id)}
                  className={`flex w-full items-center gap-3 rounded-[0.7rem] border px-5 py-4 text-left text-sm font-bold transition ${
                    activeEndpoint?.id === endpoint.id
                      ? 'border-brand-blue bg-brand-blue/10 text-brand-blue dark:border-brand-blue/70 dark:bg-brand-blue/15 dark:text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-brand-blue/30 hover:text-slate-950 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white'
                  }`}
                >
                  {endpoint.method === 'POST' ? <PlusCircle className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
                  <span>{endpoint.title}</span>
                </button>
              ))}
            </div>
          </aside>

          {activeEndpoint ? (
            <article className="min-w-0">
              <div className="rounded-[0.7rem] border border-slate-200 bg-slate-50 px-4 py-4 dark:border-white/10 dark:bg-white/[0.04] sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 text-base font-semibold text-slate-600 dark:text-slate-300">
                    <span className="font-black text-slate-700 dark:text-white">Endpoint:</span>{' '}
                    <span className="break-all font-mono">{getRelativeEndpoint(activeModule, activeEndpoint)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyText(activeEndpoint.endpoint, `Đã copy ${activeEndpoint.title}`)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 transition hover:bg-slate-200 dark:text-white dark:hover:bg-white/10"
                    aria-label="Copy endpoint"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-5">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge variant={activeEndpoint.method === 'POST' ? 'info' : 'muted'} className="rounded-full px-3 py-1.5">
                    {activeEndpoint.method}
                  </Badge>
                  <h2 className="text-xl font-black text-slate-950 dark:text-white">{activeEndpoint.title}</h2>
                </div>
                <p className="max-w-4xl text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
                  {activeEndpoint.description}
                </p>
              </div>

              <div className="mt-5">
                <ParametersTable parameters={getEndpointParameters(activeEndpoint)} />
              </div>

              <div className="mt-7 space-y-4">
                <div>
                  <div className="mb-3 text-base font-black text-slate-700 dark:text-white">Example request</div>
                  <PlainCodeBlock code={activeEndpoint.requestExample} />
                </div>
                <div>
                  <div className="mb-3 text-base font-black text-slate-700 dark:text-white">Example response</div>
                  <PlainCodeBlock code={activeEndpoint.responseExample} />
                </div>
              </div>

              <div className="mt-5 rounded-[0.7rem] border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">Lưu ý tích hợp</div>
                <div className="mt-3 space-y-2 text-sm font-semibold leading-7 text-emerald-900 dark:text-emerald-100">
                  {activeEndpoint.notes.map((note) => <p key={note}>- {note}</p>)}
                </div>
              </div>
            </article>
          ) : null}
        </div>
      </section>
    </div>
  );
}
