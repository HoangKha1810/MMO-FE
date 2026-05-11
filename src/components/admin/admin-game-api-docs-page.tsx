'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Copy,
  Download,
  FileText,
  KeyRound,
  Server,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MetricCard, PageHero, SectionHeader, SectionPanel } from '@/components/ui/page-layout';
import { buildGameApiDocs } from '@/lib/game-api-docs';

interface AdminGameApiDocsPageProps {
  baseUrl: string;
}

function escapeHtml(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function copyText(value: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(successMessage);
  } catch {
    toast.error('Không thể copy vào clipboard');
  }
}

function normalizePdfFilenamePart(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
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
        <div className="flex items-center gap-2">
          <Badge variant="muted" className="rounded-full px-3 py-1.5">
            {language}
          </Badge>
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-300">
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

export function AdminGameApiDocsPage({ baseUrl }: AdminGameApiDocsPageProps) {
  const docs = useMemo(() => buildGameApiDocs(baseUrl), [baseUrl]);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement | null>(null);

  async function handleExportPdf() {
    setExporting(true);
    try {
      const target = exportRef.current;
      if (!target) {
        throw new Error('Không tìm thấy nội dung để xuất PDF.');
      }

      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const canvas = await html2canvas(target, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#020617',
        logging: false,
        windowWidth: Math.max(target.scrollWidth, 1440),
        onclone: (document) => {
          const exportNode = document.querySelector('[data-game-api-export-root="true"]');
          if (!exportNode) {
            return;
          }

          const style = document.createElement('style');
          style.textContent = `
            [data-game-api-export-root="true"] {
              background: #020617 !important;
              color: #e2e8f0 !important;
            }

            [data-game-api-export-root="true"] *,
            [data-game-api-export-root="true"] *::before,
            [data-game-api-export-root="true"] *::after {
              box-shadow: none !important;
              text-shadow: none !important;
              backdrop-filter: none !important;
              filter: none !important;
            }

            [data-game-api-export-root="true"] section,
            [data-game-api-export-root="true"] article,
            [data-game-api-export-root="true"] div,
            [data-game-api-export-root="true"] pre,
            [data-game-api-export-root="true"] table,
            [data-game-api-export-root="true"] thead,
            [data-game-api-export-root="true"] tbody,
            [data-game-api-export-root="true"] tr,
            [data-game-api-export-root="true"] td,
            [data-game-api-export-root="true"] th {
              border-color: rgba(148, 163, 184, 0.28) !important;
            }

            [data-game-api-export-root="true"] .surface-panel,
            [data-game-api-export-root="true"] .surface-panel-strong,
            [data-game-api-export-root="true"] article,
            [data-game-api-export-root="true"] .rounded-\\[1\\.4rem\\],
            [data-game-api-export-root="true"] .rounded-\\[1\\.5rem\\],
            [data-game-api-export-root="true"] .rounded-\\[1\\.2rem\\] {
              background: #0f172a !important;
            }

            [data-game-api-export-root="true"] pre,
            [data-game-api-export-root="true"] code {
              background: #020617 !important;
              color: #f8fafc !important;
            }

            [data-game-api-export-root="true"] .bg-amber-50\\/80,
            [data-game-api-export-root="true"] .bg-amber-50\\/70 {
              background: #2a1f0f !important;
              color: #fde68a !important;
            }

            [data-game-api-export-root="true"] .bg-emerald-50\\/70,
            [data-game-api-export-root="true"] .bg-emerald-50\\/80 {
              background: #0f2a22 !important;
              color: #bbf7d0 !important;
            }

            [data-game-api-export-root="true"] .bg-slate-50\\/70,
            [data-game-api-export-root="true"] .bg-slate-50\\/90,
            [data-game-api-export-root="true"] .bg-white,
            [data-game-api-export-root="true"] .bg-white\\/5,
            [data-game-api-export-root="true"] .bg-white\\/10 {
              background: #111827 !important;
            }

            [data-game-api-export-root="true"] img {
              object-fit: contain !important;
            }
          `;
          document.head.appendChild(style);
        },
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = 210;
      const pageHeight = 297;
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }

      const filename = `trungtammmo-game-api-docs-${normalizePdfFilenamePart(new Date().toISOString().slice(0, 10))}.pdf`;
      pdf.save(filename);
      toast.success('Đã tải xuống file PDF tài liệu Game API.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể xuất file PDF');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div ref={exportRef} data-game-api-export-root="true" className="space-y-6">
      <PageHero
        eyebrow="Admin API Docs"
        title="Tài Liệu Tích Hợp Game API"
        description="Trang này gom toàn bộ cách kết nối, mẫu request, mẫu response cho từng API game, đồng thời có luôn playbook DNS, SSL, IIS reverse proxy cho Windows BE."
        stats={[
          {
            label: 'Base URL',
            value: '/api/external/game',
            hint: 'Namespace tích hợp game',
            tone: 'blue',
          },
          {
            label: 'Endpoints',
            value: String(docs.endpoints.length),
            hint: 'Đã có mẫu request/response',
            tone: 'emerald',
          },
          {
            label: 'Kết nối',
            value: String(docs.connectionMethods.length),
            hint: 'cURL, fetch, PHP, Bearer',
            tone: 'amber',
          },
          {
            label: 'Auth',
            value: 'x-api-key',
            hint: 'Authorization Bearer cũng hỗ trợ',
            tone: 'violet',
          },
        ]}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/admin/game-api">
                <KeyRound className="h-4 w-4" />
                Quay về quản lý key
              </Link>
            </Button>
            <Button onClick={() => void handleExportPdf()} loading={exporting}>
              <Download className="h-4 w-4" />
              Xuất PDF đẹp
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Full Base URL"
          value={docs.baseUrl.replace(/^https?:\/\//, '')}
          hint="Dùng cho tất cả endpoint game"
          tone="blue"
          icon={<Server className="h-4 w-4" />}
        />
        <MetricCard
          label="API Key Header"
          value="x-api-key"
          hint="Có thể thay bằng Bearer"
          tone="emerald"
          icon={<KeyRound className="h-4 w-4" />}
        />
        <MetricCard
          label="Cách kết nối"
          value={String(docs.connectionMethods.length)}
          hint="Có sẵn mẫu code tích hợp"
          tone="amber"
          icon={<Server className="h-4 w-4" />}
        />
        <MetricCard
          label="PDF Export"
          value="Tải xuống"
          hint="Bấm là tải file PDF"
          tone="slate"
          icon={<FileText className="h-4 w-4" />}
        />
      </div>

      <SectionPanel className="space-y-5">
        <SectionHeader
          eyebrow="Auth"
          title="Cách Xác Thực Và Nguyên Tắc Kết Nối"
          description="Mỗi account trên web có một API key riêng. Key này chỉ admin nhìn thấy và chỉ dùng trong luồng game API."
        />

        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="rounded-[1.4rem] border border-amber-200 bg-amber-50/80 p-5 text-sm font-semibold leading-7 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
            <div className="text-[11px] font-black uppercase tracking-[0.18em]">Auth Notes</div>
            <div className="mt-3 space-y-2">
              {docs.authNotes.map((note) => (
                <p key={note}>- {note}</p>
              ))}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {docs.connectionMethods.map((method) => (
              <article key={method.id} className="rounded-[1.4rem] border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-950/40">
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
        </div>
      </SectionPanel>

      <SectionPanel className="space-y-5">
        <SectionHeader
          eyebrow="Endpoints"
          title="Mẫu Gửi Và Nhận Dữ Liệu Theo Từng API"
          description="Mỗi endpoint bên dưới đều có cách gọi nhanh, dữ liệu mẫu gửi vào và dữ liệu mẫu trả về để web đối tác triển khai trực tiếp."
        />

        <div className="space-y-5">
          {docs.endpoints.map((endpoint) => (
            <article
              key={endpoint.id}
              className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-950/40"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={endpoint.method === 'POST' ? 'info' : 'muted'} className="rounded-full px-3 py-1.5">
                      {endpoint.method}
                    </Badge>
                    <div className="text-lg font-black text-slate-950 dark:text-white">{endpoint.title}</div>
                  </div>
                  <div className="break-all font-mono text-[12px] font-semibold text-brand-blue">
                    {endpoint.endpoint}
                  </div>
                  <p className="max-w-4xl text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
                    {endpoint.description}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="space-y-4">
                  <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                      {endpoint.requestPayloadTitle}
                    </div>
                    <pre className="mt-3 whitespace-pre-wrap break-words text-[12px] font-semibold leading-6 text-slate-700 dark:text-slate-200">
                      {endpoint.requestPayload}
                    </pre>
                  </div>
                  <CodeBlock title="Request Example" language={endpoint.method === 'POST' ? 'bash/json' : 'bash'} code={endpoint.requestExample} />
                </div>

                <div className="space-y-4">
                  <CodeBlock title="Response Example" language="json" code={endpoint.responseExample} />
                  <CodeBlock title="Error Example" language="json" code={endpoint.errorExample} />
                </div>
              </div>

              <div className="mt-4 rounded-[1.2rem] border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
                  Lưu ý tích hợp
                </div>
                <div className="mt-3 space-y-2 text-sm font-semibold leading-7 text-emerald-900 dark:text-emerald-100">
                  {endpoint.notes.map((note) => (
                    <p key={note}>- {note}</p>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </SectionPanel>
    </div>
  );
}
