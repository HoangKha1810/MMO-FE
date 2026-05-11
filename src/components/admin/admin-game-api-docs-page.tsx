'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Copy,
  Download,
  FileText,
  Globe,
  KeyRound,
  Link2,
  Server,
  ShieldCheck,
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

function buildPrintableHtml(baseUrl: string) {
  const docs = buildGameApiDocs(baseUrl);
  const siteOrigin = docs.baseUrl.replace(/\/api\/external\/game$/i, '');
  const logoUrl = `${siteOrigin}/assets/img/logohtbmmo.png`;
  const exportDate = new Date().toLocaleString('vi-VN');

  return `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <title>TRUNGTAMMMO - Game API Docs</title>
    <style>
      @page {
        size: A4;
        margin: 14mm;
      }
      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      body {
        margin: 0;
        font-family: "Segoe UI", Arial, sans-serif;
        color: #0f172a;
        background: #ffffff;
      }
      .cover {
        position: relative;
        overflow: hidden;
        min-height: 260px;
        padding: 34px;
        border-radius: 28px;
        background:
          radial-gradient(circle at top left, rgba(59,130,246,0.22), transparent 34%),
          radial-gradient(circle at bottom right, rgba(16,185,129,0.18), transparent 32%),
          linear-gradient(145deg, #0f172a 0%, #172554 45%, #0f766e 100%);
        color: #ffffff;
      }
      .cover::after {
        content: "";
        position: absolute;
        inset: 0;
        background:
          linear-gradient(120deg, rgba(255,255,255,0.12), transparent 32%),
          linear-gradient(300deg, rgba(255,255,255,0.08), transparent 28%);
        pointer-events: none;
      }
      .cover-logo {
        display: flex;
        align-items: center;
        gap: 14px;
      }
      .cover-logo img {
        width: 56px;
        height: 56px;
        border-radius: 16px;
        background: rgba(255,255,255,0.1);
        object-fit: contain;
        padding: 8px;
      }
      .eyebrow {
        display: inline-block;
        margin-bottom: 10px;
        padding: 6px 12px;
        border-radius: 999px;
        background: rgba(255,255,255,0.14);
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.22em;
        text-transform: uppercase;
      }
      h1 {
        margin: 18px 0 10px;
        font-size: 34px;
        line-height: 1.08;
        letter-spacing: -0.04em;
      }
      .cover p {
        margin: 0;
        max-width: 720px;
        font-size: 14px;
        line-height: 1.8;
        color: rgba(255,255,255,0.88);
      }
      .cover-grid {
        margin-top: 26px;
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
      }
      .cover-card {
        padding: 14px;
        border-radius: 20px;
        background: rgba(255,255,255,0.09);
        border: 1px solid rgba(255,255,255,0.12);
      }
      .cover-card .label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        color: rgba(255,255,255,0.7);
      }
      .cover-card .value {
        margin-top: 8px;
        font-size: 18px;
        font-weight: 800;
        line-height: 1.3;
      }
      .section {
        margin-top: 22px;
        page-break-inside: avoid;
      }
      .section-title {
        margin: 0 0 10px;
        font-size: 22px;
        font-weight: 800;
        letter-spacing: -0.03em;
      }
      .section-desc {
        margin: 0 0 14px;
        font-size: 13px;
        line-height: 1.8;
        color: #475569;
      }
      .grid-2 {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
      }
      .grid-3 {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
      }
      .card {
        border: 1px solid #dbe3ef;
        border-radius: 22px;
        background: #ffffff;
        padding: 18px;
      }
      .soft-card {
        border: 1px solid #e2e8f0;
        border-radius: 20px;
        background: linear-gradient(180deg, #f8fbff 0%, #ffffff 100%);
        padding: 16px;
      }
      .note-card {
        border: 1px solid #fde68a;
        background: #fff7d6;
        color: #713f12;
      }
      .success-card {
        border: 1px solid #a7f3d0;
        background: #ecfdf5;
        color: #065f46;
      }
      .meta-label {
        margin: 0 0 6px;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        color: #64748b;
        font-weight: 800;
      }
      .meta-value {
        font-size: 18px;
        font-weight: 800;
        line-height: 1.35;
      }
      .chip {
        display: inline-block;
        padding: 5px 10px;
        border-radius: 999px;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        font-weight: 800;
        margin-right: 8px;
        margin-bottom: 8px;
      }
      .chip.blue { background: #dbeafe; color: #1d4ed8; }
      .chip.green { background: #dcfce7; color: #166534; }
      .chip.amber { background: #fef3c7; color: #92400e; }
      .endpoint-card {
        margin-top: 16px;
        border: 1px solid #dbe3ef;
        border-radius: 24px;
        padding: 20px;
        page-break-inside: avoid;
      }
      .endpoint-path {
        margin-top: 8px;
        font-family: Consolas, "Courier New", monospace;
        font-size: 12px;
        color: #2563eb;
        word-break: break-all;
      }
      .endpoint-title {
        margin: 0;
        font-size: 20px;
        font-weight: 800;
        letter-spacing: -0.02em;
      }
      .endpoint-desc {
        margin: 10px 0 0;
        font-size: 13px;
        line-height: 1.8;
        color: #475569;
      }
      .codebox {
        margin-top: 12px;
        border-radius: 18px;
        overflow: hidden;
        border: 1px solid #1e293b;
        background: #0f172a;
      }
      .codebox-head {
        padding: 10px 14px;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        font-weight: 800;
        color: #cbd5e1;
        background: rgba(255,255,255,0.04);
      }
      pre {
        margin: 0;
        padding: 14px;
        white-space: pre-wrap;
        word-break: break-word;
        font-family: Consolas, "Courier New", monospace;
        font-size: 11px;
        line-height: 1.65;
        color: #f8fafc;
      }
      ul {
        margin: 8px 0 0 18px;
        padding: 0;
      }
      li {
        margin: 0 0 6px;
        font-size: 13px;
        line-height: 1.75;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 10px;
        font-size: 12px;
      }
      th, td {
        border: 1px solid #dbe3ef;
        padding: 10px 12px;
        text-align: left;
        vertical-align: top;
      }
      th {
        background: #eff6ff;
        color: #1e3a8a;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.18em;
      }
      .page-break {
        break-before: page;
        page-break-before: always;
      }
      .footer {
        margin-top: 20px;
        font-size: 11px;
        color: #64748b;
      }
    </style>
  </head>
  <body>
    <section class="cover">
      <div class="cover-logo">
        <img src="${escapeHtml(logoUrl)}" alt="TRUNGTAMMMO" />
        <div>
          <div class="eyebrow">Admin API Docs</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.72);font-weight:700;">TRUNGTAMMMO • Export lúc ${escapeHtml(exportDate)}</div>
        </div>
      </div>
      <h1>Tài Liệu Tích Hợp Game API</h1>
      <p>File này gom đầy đủ cách kết nối, dữ liệu mẫu request/response cho từng API game và playbook triển khai DNS, SSL, IIS reverse proxy cho Windows BE server.</p>
      <div class="cover-grid">
        <div class="cover-card">
          <div class="label">Base URL</div>
          <div class="value">/api/external/game</div>
        </div>
        <div class="cover-card">
          <div class="label">Domain API</div>
          <div class="value">api.trungtammmo.vn</div>
        </div>
        <div class="cover-card">
          <div class="label">BE Port</div>
          <div class="value">${docs.deployment.bePort}</div>
        </div>
        <div class="cover-card">
          <div class="label">Server IP</div>
          <div class="value">${escapeHtml(docs.deployment.serverIp)}</div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-title">Nguyên tắc xác thực</div>
      <div class="section-desc">Mỗi account có một API key riêng. Key chỉ hiển thị trong admin và dùng cho đúng module game API.</div>
      <div class="grid-2">
        <div class="card note-card">
          <div class="meta-label">Auth Notes</div>
          <ul>
            ${docs.authNotes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}
          </ul>
        </div>
        <div class="card">
          <div class="meta-label">Header mẫu</div>
          <div class="meta-value">x-api-key</div>
          <div style="margin-top:10px;font-size:13px;line-height:1.8;color:#475569;">
            Có thể thay bằng <strong>Authorization: Bearer</strong> nếu web đối tác đang dùng chuẩn bearer.
          </div>
          <div style="margin-top:12px;font-family:Consolas,monospace;font-size:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:12px;">
            x-api-key: ${escapeHtml(docs.apiKeyPlaceholder)}
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-title">Cách kết nối API</div>
      <div class="section-desc">Các mẫu dưới đây đủ để đội dev bên đối tác test nhanh và tích hợp vào backend của họ.</div>
      <div class="grid-2">
        ${docs.connectionMethods.map((method) => `
          <div class="card">
            <div class="meta-label">${escapeHtml(method.title)}</div>
            <div style="font-size:13px;line-height:1.8;color:#475569;">${escapeHtml(method.description)}</div>
            <div class="codebox">
              <div class="codebox-head">${escapeHtml(method.language)} example</div>
              <pre>${escapeHtml(method.code)}</pre>
            </div>
          </div>
        `).join('')}
      </div>
    </section>

    <section class="section page-break">
      <div class="section-title">DNS, SSL và IIS Reverse Proxy cho Windows BE</div>
      <div class="section-desc">Playbook này dùng cho server Windows có IP ${escapeHtml(docs.deployment.serverIp)}. BE hiện mặc định chạy ở port ${docs.deployment.bePort} và mount router ở ${escapeHtml(docs.deployment.apiPrefix)}.</div>

      <div class="grid-3">
        <div class="soft-card note-card">
          <div class="meta-label">Cảnh báo</div>
          <ul>
            ${docs.deployment.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join('')}
          </ul>
        </div>
        <div class="soft-card">
          <div class="meta-label">Server</div>
          <div class="meta-value">${escapeHtml(docs.deployment.serverIp)}</div>
        </div>
        <div class="soft-card">
          <div class="meta-label">Target Proxy</div>
          <div class="meta-value">127.0.0.1:${docs.deployment.bePort}</div>
        </div>
      </div>

      <div class="card" style="margin-top:14px;">
        <div class="meta-label">DNS Records đề xuất</div>
        <table>
          <thead>
            <tr>
              <th>Host</th>
              <th>Type</th>
              <th>Target</th>
              <th>Proxy</th>
              <th>TTL</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            ${docs.deployment.dnsRecords.map((record) => `
              <tr>
                <td>${escapeHtml(record.host)}</td>
                <td>${escapeHtml(record.type)}</td>
                <td>${escapeHtml(record.target)}</td>
                <td>${escapeHtml(record.proxy)}</td>
                <td>${escapeHtml(record.ttl)}</td>
                <td>${escapeHtml(record.note)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div style="margin-top:14px;">
        ${docs.deployment.steps.map((step) => `
          <div class="endpoint-card">
            <div class="endpoint-title">${escapeHtml(step.title)}</div>
            <div class="endpoint-desc">${escapeHtml(step.description)}</div>
            ${step.code ? `
              <div class="codebox">
                <div class="codebox-head">${escapeHtml(step.language || 'text')}</div>
                <pre>${escapeHtml(step.code)}</pre>
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>

      <div class="card success-card" style="margin-top:14px;">
        <div class="meta-label">Checklist test cuối</div>
        <ul>
          ${docs.deployment.verification.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
      </div>
    </section>

    <section class="section page-break">
      <div class="section-title">Danh sách endpoint và dữ liệu mẫu</div>
      <div class="section-desc">Mỗi endpoint bên dưới đều có dữ liệu mẫu gửi lên, response thành công và response lỗi.</div>

      ${docs.endpoints.map((endpoint) => `
        <article class="endpoint-card">
          <div>
            <span class="chip ${endpoint.method === 'POST' ? 'blue' : 'green'}">${escapeHtml(endpoint.method)}</span>
            <span class="chip amber">${escapeHtml(endpoint.title)}</span>
          </div>
          <div class="endpoint-path">${escapeHtml(endpoint.endpoint)}</div>
          <div class="endpoint-desc">${escapeHtml(endpoint.description)}</div>

          <div class="grid-2" style="margin-top:14px;">
            <div class="card">
              <div class="meta-label">${escapeHtml(endpoint.requestPayloadTitle)}</div>
              <div style="font-size:13px;line-height:1.8;color:#475569;white-space:pre-wrap;">${escapeHtml(endpoint.requestPayload)}</div>
              <div class="codebox">
                <div class="codebox-head">Request example</div>
                <pre>${escapeHtml(endpoint.requestExample)}</pre>
              </div>
            </div>
            <div>
              <div class="codebox">
                <div class="codebox-head">Response example</div>
                <pre>${escapeHtml(endpoint.responseExample)}</pre>
              </div>
              <div class="codebox" style="margin-top:12px;">
                <div class="codebox-head">Error example</div>
                <pre>${escapeHtml(endpoint.errorExample)}</pre>
              </div>
            </div>
          </div>

          <div class="card success-card" style="margin-top:14px;">
            <div class="meta-label">Lưu ý tích hợp</div>
            <ul>
              ${endpoint.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}
            </ul>
          </div>
        </article>
      `).join('')}
    </section>

    <div class="footer">
      TRUNGTAMMMO Game API Docs • ${escapeHtml(exportDate)} • Base URL: ${escapeHtml(docs.baseUrl)}
    </div>
  </body>
</html>`;
}

export function AdminGameApiDocsPage({ baseUrl }: AdminGameApiDocsPageProps) {
  const docs = useMemo(() => buildGameApiDocs(baseUrl), [baseUrl]);
  const [exporting, setExporting] = useState(false);

  async function handleExportPdf() {
    setExporting(true);
    try {
      const popup = window.open('', '_blank', 'noopener,noreferrer,width=1280,height=900');
      if (!popup) {
        throw new Error('Trình duyệt đang chặn popup. Hãy cho phép popup rồi thử lại.');
      }

      popup.document.open();
      popup.document.write(buildPrintableHtml(baseUrl));
      popup.document.close();
      popup.focus();

      window.setTimeout(() => {
        popup.print();
      }, 350);

      toast.success('Đã mở cửa sổ in. Chọn "Save as PDF" để lưu file PDF.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể mở trình xuất PDF');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
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
            label: 'Windows BE',
            value: `${docs.deployment.serverIp}:${docs.deployment.bePort}`,
            hint: 'Target reverse proxy',
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
          label="Domain API"
          value="api.trungtammmo.vn"
          hint="Khuyến nghị tách BE sang subdomain"
          tone="amber"
          icon={<Globe className="h-4 w-4" />}
        />
        <MetricCard
          label="PDF Export"
          value="Print layout"
          hint="Mở hộp in để Save as PDF"
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
          eyebrow="Windows BE"
          title="DNS, SSL, IIS Và Reverse Proxy"
          description="Playbook triển khai cho server Windows BE IP 160.191.237.249, reverse proxy qua IIS về Express port 4000."
        />

        <div className="grid gap-4 xl:grid-cols-4">
          <MetricCard
            label="Server IP"
            value={docs.deployment.serverIp}
            hint="Windows BE server"
            tone="blue"
            icon={<Server className="h-4 w-4" />}
          />
          <MetricCard
            label="BE Port"
            value={String(docs.deployment.bePort)}
            hint="Node/Express listen nội bộ"
            tone="emerald"
            icon={<Link2 className="h-4 w-4" />}
          />
          <MetricCard
            label="Public Domain"
            value="api.trungtammmo.vn"
            hint="Khuyến nghị trỏ vào IIS"
            tone="amber"
            icon={<Globe className="h-4 w-4" />}
          />
          <MetricCard
            label="Health Check"
            value="/api/health"
            hint="Test sau khi proxy xong"
            tone="slate"
            icon={<ShieldCheck className="h-4 w-4" />}
          />
        </div>

        <div className="rounded-[1.4rem] border border-amber-200 bg-amber-50/80 p-5 text-sm font-semibold leading-7 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
          {docs.deployment.warnings.map((warning) => (
            <p key={warning}>- {warning}</p>
          ))}
        </div>

        <div className="overflow-x-auto rounded-[1.4rem] border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950/40">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-slate-50/90 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:bg-white/[0.04] dark:text-slate-400">
              <tr>
                {['Host', 'Type', 'Target', 'Proxy', 'TTL', 'Ghi chú'].map((label) => (
                  <th key={label} className="border-b border-slate-100 px-4 py-3 dark:border-white/5">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {docs.deployment.dnsRecords.map((record) => (
                <tr key={`${record.host}-${record.target}`}>
                  <td className="px-4 py-3 font-mono font-semibold text-slate-900 dark:text-white">{record.host}</td>
                  <td className="px-4 py-3">{record.type}</td>
                  <td className="px-4 py-3 font-mono text-brand-blue">{record.target}</td>
                  <td className="px-4 py-3">{record.proxy}</td>
                  <td className="px-4 py-3">{record.ttl}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{record.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-4">
          {docs.deployment.steps.map((step) => (
            <article key={step.title} className="rounded-[1.4rem] border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-950/40">
              <div className="text-lg font-black text-slate-950 dark:text-white">{step.title}</div>
              <p className="mt-2 text-sm font-medium leading-7 text-slate-600 dark:text-slate-300">
                {step.description}
              </p>
              {step.code ? (
                <div className="mt-4">
                  <CodeBlock title={step.title} language={step.language || 'text'} code={step.code} />
                </div>
              ) : null}
            </article>
          ))}
        </div>

        <div className="rounded-[1.4rem] border border-emerald-200 bg-emerald-50/70 p-5 dark:border-emerald-500/20 dark:bg-emerald-500/10">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
            Checklist test cuối
          </div>
          <div className="mt-3 space-y-2 text-sm font-semibold leading-7 text-emerald-900 dark:text-emerald-100">
            {docs.deployment.verification.map((item) => (
              <p key={item}>- {item}</p>
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
