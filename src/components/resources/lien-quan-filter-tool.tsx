'use client';

import { ChangeEvent, useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  Clipboard,
  Download,
  FileText,
  Filter,
  Gamepad2,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SectionHeader, SectionPanel } from '@/components/ui/page-layout';
import { formatCurrency } from '@/lib/utils';
import { LIEN_QUAN_FILTER_FEE } from '@/lib/lien-quan-account-filter';

type ResultRow = Record<string, string | number>;

type FilterResult = {
  success: boolean;
  message?: string;
  fee?: number;
  game_balance?: number;
  total?: number;
  filtered?: number;
  previewLimit?: number;
  rows?: ResultRow[];
  exportText?: string;
  summaries?: {
    input?: Record<string, number>;
    filtered?: Record<string, number>;
  };
};

const statusOptions = ['ACC FULL', 'ACC BÌNH THƯỜNG', 'ACC DIE', 'KHÁC'];
const previewColumns = ['username', 'UID', 'NAME', 'VIP', 'RANK', 'LEVEL', 'TƯỚNG', 'SKIN', 'SS_COUNT', 'SSS_COUNT', 'CCCD', 'EMAIL', 'TÌNH TRẠNG'];

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function formatNumber(value: unknown) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0));
}

function getCellValue(row: ResultRow, key: string) {
  const value = row[key];
  if (value === undefined || value === null || value === '') {
    return '-';
  }

  return String(value);
}

export function LienQuanFilterTool() {
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [search, setSearch] = useState('');
  const [vipMin, setVipMin] = useState('0');
  const [vipMax, setVipMax] = useState('');
  const [skinMin, setSkinMin] = useState('0');
  const [skinMax, setSkinMax] = useState('');
  const [ssMin, setSsMin] = useState('0');
  const [statuses, setStatuses] = useState<string[]>([]);
  const [requireCccd, setRequireCccd] = useState(false);
  const [requireVerifiedEmail, setRequireVerifiedEmail] = useState(false);
  const [requireRareSkin, setRequireRareSkin] = useState(false);
  const [result, setResult] = useState<FilterResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const inputLineCount = useMemo(
    () => text.split(/\r?\n/).filter((line) => line.trim()).length,
    [text],
  );

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith('.txt')) {
      toast.error('Chỉ nhận file .txt');
      return;
    }

    if (file.size > 2_000_000) {
      toast.error('File quá lớn, vui lòng chia nhỏ dưới 2MB.');
      return;
    }

    const content = await file.text();
    setText(content);
    setFileName(file.name);
    setResult(null);
    toast.success(`Đã đọc file ${file.name}`);
  }

  function toggleStatus(status: string) {
    setStatuses((current) =>
      current.includes(status)
        ? current.filter((item) => item !== status)
        : [...current, status],
    );
  }

  function resetFilters() {
    setSearch('');
    setVipMin('0');
    setVipMax('');
    setSkinMin('0');
    setSkinMax('');
    setSsMin('0');
    setStatuses([]);
    setRequireCccd(false);
    setRequireVerifiedEmail(false);
    setRequireRareSkin(false);
    setResult(null);
  }

  function submitFilter() {
    if (!text.trim()) {
      toast.error('Upload file .txt hoặc dán nội dung acc trước khi lọc.');
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/game/lien-quan-filter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            filters: {
              search,
              vipMin: Number(vipMin || 0),
              vipMax: Number(vipMax || 0),
              skinMin: Number(skinMin || 0),
              skinMax: Number(skinMax || 0),
              ssMin: Number(ssMin || 0),
              statuses,
              requireCccd,
              requireVerifiedEmail,
              requireRareSkin,
            },
          }),
        });
        const payload = await response.json().catch(() => null) as FilterResult | null;

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || 'Không thể lọc acc Liên Quân.');
        }

        setResult(payload);
        toast.success(payload.message || 'Đã lọc acc Liên Quân');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Không thể lọc acc Liên Quân.');
      }
    });
  }

  async function copyExportText() {
    if (!result?.exportText) {
      toast.error('Chưa có dữ liệu để copy');
      return;
    }

    try {
      await navigator.clipboard.writeText(result.exportText);
      toast.success('Đã copy danh sách acc đã lọc');
    } catch {
      toast.error('Không copy được, hãy tải file TXT');
    }
  }

  return (
    <SectionPanel className="space-y-5 border-emerald-500/20 bg-emerald-500/[0.04]">
      <SectionHeader
        eyebrow="Tool Liên Quân"
        title="Lọc acc Liên Quân tự động"
        description="Upload file .txt hoặc dán danh sách acc, chọn điều kiện rồi bấm lọc. Mỗi lần bấm lọc trừ trực tiếp 3.000đ vào ví game."
        actions={
          <>
            <Badge variant="warning" className="rounded-full px-3 py-1.5">
              <Sparkles className="h-3 w-3" />
              Phí {formatCurrency(LIEN_QUAN_FILTER_FEE)} / lần lọc
            </Badge>
            <Badge variant="success" className="rounded-full px-3 py-1.5">
              <ShieldCheck className="h-3 w-3" />
              Trừ ví game
            </Badge>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)]">
        <div className="space-y-4">
          <div className="surface-card rounded-[1rem] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Nguồn dữ liệu</div>
                <div className="mt-1 text-sm font-black text-slate-900 dark:text-white">
                  {fileName || 'Dán TXT hoặc upload file acc'}
                </div>
              </div>
              <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-[1rem] bg-slate-900 px-4 text-xs font-black uppercase tracking-[0.14em] text-white transition hover:-translate-y-0.5 dark:bg-white dark:text-slate-950">
                <Upload className="h-4 w-4" />
                Upload TXT
                <input type="file" accept=".txt,text/plain" className="hidden" onChange={handleFileChange} />
              </label>
            </div>
            <textarea
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setFileName('');
                setResult(null);
              }}
              placeholder="Dán nội dung file acc Liên Quân vào đây..."
              className="field-elevated mt-4 min-h-[220px] w-full resize-y rounded-[1rem] px-4 py-3 font-mono text-xs font-semibold leading-6 text-slate-900 outline-none placeholder:text-slate-400 focus:ring-4 focus:ring-brand-blue/10 dark:text-white"
            />
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 dark:bg-white/5">
                <FileText className="h-3.5 w-3.5" />
                {formatNumber(inputLineCount)} dòng nhập
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 dark:bg-white/5">
                Format: username|password| UID : ...
              </span>
            </div>
          </div>

          {result ? (
            <div className="surface-card overflow-hidden rounded-[1rem]">
              <div className="flex flex-col gap-3 border-b border-slate-200/70 p-4 dark:border-white/10 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Kết quả</div>
                  <div className="mt-1 text-lg font-black text-slate-950 dark:text-white">
                    {formatNumber(result.filtered)} / {formatNumber(result.total)} acc
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Đã trừ {formatCurrency(Number(result.fee || LIEN_QUAN_FILTER_FEE))}. Ví game còn {formatCurrency(Number(result.game_balance || 0))}.
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={copyExportText}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-[0.9rem] bg-slate-900 px-4 text-xs font-black uppercase tracking-[0.12em] text-white dark:bg-white dark:text-slate-950"
                  >
                    <Clipboard className="h-4 w-4" />
                    Copy TXT
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadTextFile('lien-quan-accounts-filtered.txt', result.exportText || '')}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-[0.9rem] bg-brand-blue px-4 text-xs font-black uppercase tracking-[0.12em] text-white"
                  >
                    <Download className="h-4 w-4" />
                    Tải TXT
                  </button>
                </div>
              </div>

              <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
                <ResultMetric label="Acc full" value={result.summaries?.filtered?.full} />
                <ResultMetric label="Có CCCD" value={result.summaries?.filtered?.withCccd} />
                <ResultMetric label="Email xác thực" value={result.summaries?.filtered?.verifiedEmail} />
                <ResultMetric label="Skin hiếm" value={result.summaries?.filtered?.rareSkin} />
              </div>

              <div className="overflow-x-auto border-t border-slate-200/70 dark:border-white/10">
                <table className="min-w-[980px] w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:bg-white/5 dark:text-slate-400">
                    <tr>
                      {previewColumns.map((column) => (
                        <th key={column} className="px-3 py-3">{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                    {(result.rows || []).slice(0, result.previewLimit || 500).map((row, index) => (
                      <tr key={`${row.username || 'row'}-${index}`} className="text-slate-700 dark:text-slate-200">
                        {previewColumns.map((column) => (
                          <td key={column} className="max-w-[180px] truncate px-3 py-3 font-semibold">
                            {getCellValue(row, column)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>

        <div className="surface-card h-fit rounded-[1rem] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Bộ lọc</div>
              <div className="mt-1 text-base font-black text-slate-950 dark:text-white">Điều kiện lọc acc</div>
            </div>
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-blue/10 text-brand-blue">
              <Gamepad2 className="h-5 w-5" />
            </span>
          </div>

          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Tìm kiếm</span>
              <div className="relative mt-2">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tên / UID / username"
                  className="field-elevated h-11 w-full rounded-[1rem] pl-10 pr-4 text-sm font-semibold text-slate-900 outline-none dark:text-white"
                />
              </div>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <NumberField label="VIP từ" value={vipMin} onChange={setVipMin} />
              <NumberField label="VIP đến" value={vipMax} onChange={setVipMax} placeholder="15" />
              <NumberField label="Skin từ" value={skinMin} onChange={setSkinMin} />
              <NumberField label="Skin đến" value={skinMax} onChange={setSkinMax} placeholder="1000" />
              <NumberField label="SS tối thiểu" value={ssMin} onChange={setSsMin} />
            </div>

            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Tình trạng</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {statusOptions.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => toggleStatus(status)}
                    className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] transition ${
                      statuses.includes(status)
                        ? 'border-brand-blue bg-brand-blue text-white'
                        : 'border-slate-200 bg-white/70 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <CheckOption label="Chỉ acc có CCCD" checked={requireCccd} onChange={setRequireCccd} />
              <CheckOption label="Email đã xác thực" checked={requireVerifiedEmail} onChange={setRequireVerifiedEmail} />
              <CheckOption label="Có skin hiếm / Mystic / S-Dreamer" checked={requireRareSkin} onChange={setRequireRareSkin} />
            </div>

            <div className="rounded-[1rem] border border-amber-500/20 bg-amber-500/10 p-4 text-xs font-semibold leading-6 text-amber-700 dark:text-amber-200">
              Lưu ý: mỗi lần bấm lọc sẽ trừ {formatCurrency(LIEN_QUAN_FILTER_FEE)} vào ví game, kể cả khi kết quả lọc còn 0 acc.
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex h-11 items-center justify-center rounded-[1rem] bg-slate-100 px-4 text-xs font-black uppercase tracking-[0.14em] text-slate-600 dark:bg-white/5 dark:text-slate-300"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={submitFilter}
                disabled={isPending}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-[1rem] bg-brand-blue px-4 text-xs font-black uppercase tracking-[0.14em] text-white shadow-[0_18px_40px_-24px_rgba(37,99,235,0.8)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Filter className="h-4 w-4" />}
                Lọc acc
              </button>
            </div>
          </div>
        </div>
      </div>
    </SectionPanel>
  );
}

function NumberField({
  label,
  value,
  onChange,
  placeholder = '0',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</span>
      <input
        type="number"
        min="0"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="field-elevated mt-2 h-11 w-full rounded-[1rem] px-4 text-sm font-semibold text-slate-900 outline-none dark:text-white"
      />
    </label>
  );
}

function CheckOption({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-[0.95rem] border border-slate-200/70 bg-white/70 px-3 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
      />
      {label}
    </label>
  );
}

function ResultMetric({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-[1rem] bg-slate-50 p-3 dark:bg-white/5">
      <div className="font-mono text-xl font-black text-slate-950 dark:text-white">{formatNumber(value)}</div>
      <div className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</div>
    </div>
  );
}
