'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Copy,
  FileText,
  Layers,
  Percent,
  PlusCircle,
  RefreshCcw,
  Server,
  ShoppingBag,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MetricCard, PageHero, SectionHeader, SectionPanel } from '@/components/ui/page-layout';
import {
  buildSmmApiDocs,
  type SmmApiDocsRuntimeMeta,
  type SmmApiDocsService,
} from '@/lib/smm-api-docs';
import type { SmmServiceRecord } from '@/lib/smm-provider';

interface AdminSmmApiDocsPageProps {
  baseUrl: string;
  services: SmmServiceRecord[];
  runtimeMeta: SmmApiDocsRuntimeMeta;
  loadedAt: string;
  loadError?: string;
}

async function copyText(value: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(successMessage);
  } catch {
    toast.error('Không thể copy vào clipboard');
  }
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 4,
  }).format(Number(value || 0));
}

function compactMoney(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
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
    <div className="space-y-2 rounded-[1.2rem] border border-slate-200 bg-slate-950/95 p-4 dark:border-white/10">
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

function ParametersTable({
  parameters = [],
}: {
  parameters?: Array<{
    name: string;
    description: string;
    required?: boolean;
  }>;
}) {
  if (parameters.length === 0) {
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

function PriceRow({ service }: { service: SmmApiDocsService }) {
  return (
    <tr className="align-top">
      <td className="px-4 py-4">
        <div className="font-mono text-[12px] font-black text-slate-900 dark:text-white">
          #{service.service}
        </div>
        <div className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          Provider {service.provider_id}
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="max-w-[420px] text-sm font-black leading-6 text-slate-900 dark:text-white">
          {service.name}
        </div>
        <div className="mt-1 flex flex-wrap gap-2">
          <Badge variant="muted" className="rounded-full px-2.5 py-1">
            {service.platform}
          </Badge>
          <Badge variant={service.is_comment_service ? 'warning' : 'info'} className="rounded-full px-2.5 py-1">
            {service.type}
          </Badge>
          {service.refill ? (
            <Badge variant="success" className="rounded-full px-2.5 py-1">
              Refill
            </Badge>
          ) : null}
        </div>
        <div className="mt-2 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">
          {service.category}
        </div>
      </td>
      <td className="px-4 py-4 text-sm font-bold tabular-nums text-slate-700 dark:text-slate-200">
        {compactMoney(service.min)} - {compactMoney(service.max)}
      </td>
      <td className="px-4 py-4 text-right">
        <div className="font-mono text-sm font-black tabular-nums text-emerald-600 dark:text-emerald-300">
          {formatMoney(service.price_per_1k_vnd)} đ
        </div>
        <div className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          {formatMoney(service.price_per_unit_vnd)} đ / 1
        </div>
      </td>
      <td className="px-4 py-4 text-right font-mono text-sm font-bold tabular-nums text-slate-700 dark:text-slate-200">
        {compactMoney(service.total_orders)}
      </td>
    </tr>
  );
}

export function AdminSmmApiDocsPage({
  baseUrl,
  services,
  runtimeMeta,
  loadedAt,
  loadError,
}: AdminSmmApiDocsPageProps) {
  const [query, setQuery] = useState('');
  const [activeEndpointId, setActiveEndpointId] = useState('services');
  const docs = useMemo(() => buildSmmApiDocs(baseUrl, services, runtimeMeta), [baseUrl, services, runtimeMeta]);
  const activeEndpoint = useMemo(
    () => docs.endpoints.find((endpoint) => endpoint.id === activeEndpointId) || docs.endpoints[0],
    [activeEndpointId, docs.endpoints]
  );
  const endpointNav = useMemo(
    () => [
      { id: 'services', label: 'Services', icon: <Server className="h-4 w-4" /> },
      { id: 'add-order', label: 'Add order', icon: <PlusCircle className="h-4 w-4" /> },
      { id: 'status', label: 'Order status', icon: <RefreshCcw className="h-4 w-4" /> },
      { id: 'multi-status', label: 'Multiple orders status', icon: <Layers className="h-4 w-4" /> },
      { id: 'balance', label: 'Balance', icon: <Wallet className="h-4 w-4" /> },
    ],
    []
  );

  const filteredServices = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const sorted = [...docs.services].sort((a, b) => b.total_orders - a.total_orders || a.name.localeCompare(b.name));

    if (!needle) {
      return sorted.slice(0, 30);
    }

    return sorted
      .filter((service) =>
        [
          service.service,
          service.name,
          service.category,
          service.platform,
          service.type,
        ]
          .join(' ')
          .toLowerCase()
          .includes(needle)
      )
      .slice(0, 50);
  }, [docs.services, query]);

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Admin SMM API Docs"
        title="Tài Liệu API SMM Và Bảng Giá Web"
        description="Trang docs dành cho vận hành: endpoint lấy danh sách dịch vụ, category, tính giá, kiểm tra trạng thái và xem lịch sử SMM bằng API key admin cấp. Bảng giá bên dưới lấy trực tiếp từ dịch vụ SMM đang active trên web."
        stats={[
          {
            label: 'Base URL',
            value: docs.baseUrl.replace(/^https?:\/\//, ''),
            hint: 'Domain web đang phục vụ API SMM',
            tone: 'blue',
          },
          {
            label: 'Services',
            value: String(docs.summary.totalServices),
            hint: `${docs.summary.totalCategories} category · ${docs.summary.totalPlatforms} platform`,
            tone: 'emerald',
          },
          {
            label: 'VAT',
            value: `${docs.summary.vatPercent}%`,
            hint: 'Cộng khi tạo đơn',
            tone: 'amber',
          },
          {
            label: 'Provider',
            value: docs.summary.providerName,
            hint: `Cập nhật ${loadedAt}`,
            tone: 'violet',
          },
        ]}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/admin/smm/services">
                <Layers className="h-4 w-4" />
                Cấu hình dịch vụ
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/smm/orders">
                <ShoppingBag className="h-4 w-4" />
                Đơn SMM
              </Link>
            </Button>
            <Button onClick={() => void copyText(`${docs.baseUrl}/api/external/smm/services`, 'Đã copy endpoint bảng giá')}>
              <Copy className="h-4 w-4" />
              Copy bảng giá
            </Button>
          </>
        }
      />

      {loadError ? (
        <SectionPanel className="border-amber-200 bg-amber-50/80 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
          <div className="text-sm font-black uppercase tracking-[0.18em]">Cảnh báo tải dữ liệu</div>
          <p className="mt-2 text-sm font-semibold leading-7">{loadError}</p>
        </SectionPanel>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Endpoint bảng giá"
          value="/api/external/smm/services"
          hint="Cần x-api-key"
          tone="blue"
          icon={<Server className="h-4 w-4" />}
          valueClassName="text-[min(1.1rem,4vw)]"
        />
        <MetricCard
          label="Endpoint tính giá"
          value="/api/external/smm/quote"
          hint="Đối soát trước khi tạo đơn"
          tone="emerald"
          icon={<ShoppingBag className="h-4 w-4" />}
          valueClassName="text-[min(1.1rem,4vw)]"
        />
        <MetricCard
          label="Margin"
          value={`${runtimeMeta.marginPercent ?? 0}%`}
          hint={`Tỷ giá ${compactMoney(runtimeMeta.exchangeRate || 0)} đ`}
          tone="amber"
          icon={<Percent className="h-4 w-4" />}
        />
        <MetricCard
          label="Docs"
          value={String(docs.endpoints.length)}
          hint="Endpoint có request/response mẫu"
          tone="slate"
          icon={<FileText className="h-4 w-4" />}
        />
      </div>

      <SectionPanel className="space-y-5">
        <SectionHeader
          eyebrow="Auth & Pricing"
          title="Nguyên Tắc Kết Nối Và Tính Giá"
          description="Các ghi chú này bám theo code đang chạy: dịch vụ lấy từ cache SMM active, external API dùng API key do admin cấp và trả đúng giá web."
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-[1.2rem] border border-blue-200 bg-blue-50/70 p-5 dark:border-blue-500/20 dark:bg-blue-500/10">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700 dark:text-blue-200">
              Auth Notes
            </div>
            <div className="mt-3 space-y-2 text-sm font-semibold leading-7 text-blue-950 dark:text-blue-100">
              {docs.authNotes.map((note) => (
                <p key={note}>- {note}</p>
              ))}
            </div>
          </div>

          <div className="rounded-[1.2rem] border border-emerald-200 bg-emerald-50/70 p-5 dark:border-emerald-500/20 dark:bg-emerald-500/10">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-200">
              Price Notes
            </div>
            <div className="mt-3 space-y-2 text-sm font-semibold leading-7 text-emerald-950 dark:text-emerald-100">
              {docs.priceNotes.map((note) => (
                <p key={note}>- {note}</p>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          {docs.connectionMethods.map((method) => (
            <article key={method.id} className="rounded-[1.2rem] border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-950/40">
              <div className="flex items-center gap-2">
                <Badge variant="muted" className="rounded-full px-3 py-1.5">
                  {method.language}
                </Badge>
                <div className="text-sm font-black text-slate-950 dark:text-white">{method.title}</div>
              </div>
              <p className="mt-2 text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
                {method.description}
              </p>
              <div className="mt-4">
                <CodeBlock title="Connection Sample" language={method.language} code={method.code} />
              </div>
            </article>
          ))}
        </div>
      </SectionPanel>

      <SectionPanel className="space-y-5">
        <SectionHeader
          eyebrow="Live Prices"
          title="Giá Web Hiện Tại Từ SMM"
          description="Bảng này dùng đúng data từ listSmmServices, cùng nguồn với endpoint /api/external/smm/services. Mặc định hiện 30 dịch vụ có nhiều đơn nhất; tìm kiếm sẽ lọc tối đa 50 dòng."
          actions={
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Tìm service, category, platform..."
                  className="h-11 w-[min(360px,75vw)] rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10 dark:border-white/10 dark:bg-white/[0.04] dark:text-white"
                />
              </div>
              <Button asChild variant="outline">
                <Link href="/admin/smm/services">
                  <RefreshCcw className="h-4 w-4" />
                  Sync / chỉnh giá
                </Link>
              </Button>
            </div>
          }
        />

        <div className="overflow-hidden rounded-[1.2rem] border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950/40">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left">
              <thead className="border-b border-slate-100 bg-slate-50/90 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 dark:border-white/5 dark:bg-white/[0.04] dark:text-slate-400">
                <tr>
                  <th className="px-4 py-4">Service</th>
                  <th className="px-4 py-4">Dịch vụ</th>
                  <th className="px-4 py-4">Min / Max</th>
                  <th className="px-4 py-4 text-right">Giá web</th>
                  <th className="px-4 py-4 text-right">Orders</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {filteredServices.length > 0 ? (
                  filteredServices.map((service) => <PriceRow key={`${service.provider_id}-${service.service}`} service={service} />)
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
                      Không tìm thấy dịch vụ phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </SectionPanel>

      <SectionPanel className="space-y-5">
        <SectionHeader
          eyebrow="Endpoints"
          title="Tài Liệu Kiểu SMM Panel"
          description="Chọn từng mục bên trái để xem tham số, request mẫu và response. Endpoint tạo đơn sẽ trừ ví chính của user gắn với API key."
        />

        <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="rounded-[1.3rem] border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-950/40">
            <div className="space-y-1">
              {endpointNav.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveEndpointId(item.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-black transition ${
                    activeEndpoint?.id === item.id
                      ? 'bg-brand-blue text-white shadow-lg shadow-brand-blue/20'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </aside>

          {activeEndpoint ? (
            <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-950/40">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={activeEndpoint.method === 'POST' ? 'info' : 'muted'} className="rounded-full px-3 py-1.5">
                      {activeEndpoint.method}
                    </Badge>
                    <div className="text-lg font-black text-slate-950 dark:text-white">{activeEndpoint.title}</div>
                  </div>
                  <div className="break-all font-mono text-[12px] font-semibold text-brand-blue">
                    {activeEndpoint.endpoint}
                  </div>
                  <p className="max-w-4xl text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
                    {activeEndpoint.description}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => void copyText(activeEndpoint.endpoint, `Đã copy ${activeEndpoint.title}`)}>
                  <Copy className="h-4 w-4" />
                  Copy URL
                </Button>
              </div>

              <div className="mt-5">
                <ParametersTable parameters={activeEndpoint.parameters} />
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="space-y-4">
                  <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                      {activeEndpoint.requestPayloadTitle}
                    </div>
                    <pre className="mt-3 whitespace-pre-wrap break-words text-[12px] font-semibold leading-6 text-slate-700 dark:text-slate-200">
                      {activeEndpoint.requestPayload}
                    </pre>
                  </div>
                  <CodeBlock title="Request Example" language={activeEndpoint.method === 'POST' ? 'bash/json' : 'bash'} code={activeEndpoint.requestExample} />
                </div>

                <div className="space-y-4">
                  <CodeBlock title="Response Example" language="json" code={activeEndpoint.responseExample} />
                  <CodeBlock title="Error Example" language="json" code={activeEndpoint.errorExample} />
                </div>
              </div>

              <div className="mt-4 rounded-[1.2rem] border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
                  Lưu ý tích hợp
                </div>
                <div className="mt-3 space-y-2 text-sm font-semibold leading-7 text-emerald-900 dark:text-emerald-100">
                  {activeEndpoint.notes.map((note) => (
                    <p key={note}>- {note}</p>
                  ))}
                </div>
              </div>
            </article>
          ) : null}
        </div>
      </SectionPanel>
    </div>
  );
}
