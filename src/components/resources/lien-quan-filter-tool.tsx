'use client';

import { ChangeEvent, useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  Clipboard,
  Download,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Gamepad2,
  KeyRound,
  Loader2,
  LockKeyhole,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SectionHeader, SectionPanel } from '@/components/ui/page-layout';
import { useWalletBalance } from '@/components/layout/wallet-balance-context';
import { formatCurrency } from '@/lib/utils';
import { LIEN_QUAN_FILTER_FEE, LIEN_QUAN_SKIN_GROUPS } from '@/lib/lien-quan-account-filter';

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
    input?: Record<string, number | Record<string, number>>;
    filtered?: Record<string, number | Record<string, number>>;
  };
  unlocked?: boolean;
};

const statusOptions = ['ACC FULL', 'ACC BÌNH THƯỜNG', 'ACC DIE', 'KHÁC'];
const previewColumns = ['username', 'password', 'UID', 'NAME', 'VIP', 'RANK', 'LEVEL', 'TƯỚNG', 'SKIN', 'SS_COUNT', 'SSS_COUNT', 'ANIME_COUNT', 'SKIN HIẾM_COUNT', 'CCCD', 'EMAIL', 'TÌNH TRẠNG'];
const skinGroups = LIEN_QUAN_SKIN_GROUPS.filter((group) =>
  ['SSS', 'SS', 'ANIME', 'SKIN HIẾM', 'MYSTIC', 'S-DREAMER'].includes(group),
);
const skinGroupLabels: Record<string, string> = {
  SSS: 'Skin SSS',
  SS: 'Skin SS',
  ANIME: 'Skin Anime',
  'SKIN HIẾM': 'Skin hiếm',
  MYSTIC: 'Mystic',
  'S-DREAMER': 'S-Dreamer',
};

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

function getSummaryNumber(summary: Record<string, number | Record<string, number>> | undefined, key: string) {
  const value = summary?.[key];
  return typeof value === 'number' ? value : 0;
}

function getSkinGroupCount(summary: Record<string, number | Record<string, number>> | undefined, group: string) {
  const value = summary?.skinGroups;
  if (!value || typeof value !== 'object') {
    return 0;
  }
  return Number((value as Record<string, number>)[group] || 0);
}

function getCellValue(row: ResultRow, key: string) {
  const value = row[key];
  if (value === undefined || value === null || value === '') {
    return '-';
  }

  return String(value);
}

function getSkinNames(row: ResultRow, group: string) {
  return String(row[group] || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function clearSessionUserCache() {
  try {
    window.sessionStorage.removeItem('session_user_v1');
  } catch {}
}

export function LienQuanFilterTool() {
  const { setBalances } = useWalletBalance();
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
  const [unlockPassword, setUnlockPassword] = useState('');
  const [showUnlockPassword, setShowUnlockPassword] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isUnlocking, startUnlockTransition] = useTransition();

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
    setUnlockPassword('');
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
            action: 'filter',
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
        setUnlockPassword('');
        if (typeof payload.game_balance === 'number') {
          setBalances({ gameBalance: payload.game_balance });
          clearSessionUserCache();
        }
        toast.success(payload.message || 'Đã lọc acc Liên Quân');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Không thể lọc acc Liên Quân.');
      }
    });
  }

  function buildFiltersPayload() {
    return {
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
    };
  }

  function unlockFullAccounts() {
    if (!result) {
      toast.error('Hãy lọc acc trước khi mở full acc.');
      return;
    }

    if (!unlockPassword.trim()) {
      toast.error('Nhập mật khẩu tài khoản web để mở full acc.');
      return;
    }

    startUnlockTransition(async () => {
      try {
        const response = await fetch('/api/game/lien-quan-filter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'unlock',
            text,
            password: unlockPassword,
            filters: buildFiltersPayload(),
          }),
        });
        const payload = await response.json().catch(() => null) as FilterResult | null;

        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || 'Không thể mở khóa full acc.');
        }

        setResult((current) => ({ ...(current || {}), ...payload, unlocked: true }));
        setUnlockPassword('');
        toast.success(payload.message || 'Đã mở khóa full acc');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Không thể mở khóa full acc.');
      }
    });
  }

  async function copyExportText() {
    if (!result?.exportText) {
      toast.error(result ? 'Nhập mật khẩu web để mở full acc trước khi copy TXT.' : 'Chưa có dữ liệu để copy');
      return;
    }

    try {
      await navigator.clipboard.writeText(result.exportText);
      toast.success('Đã copy danh sách acc đã lọc');
    } catch {
      toast.error('Không copy được, hãy tải file TXT');
    }
  }

  const [isCheckingSkins, setIsCheckingSkins] = useState(false);

  async function handleAutoCheckSkins() {
    if (!result || !result.rows || !result.rows.length) {
      toast.error('Không có tài khoản nào để check.');
      return;
    }

    const accountsToCheck = result.rows
      .slice(0, 3)
      .map(row => ({
        username: String(row.username || ''),
        password: String(row.password || ''),
      }))
      .filter(acc => acc.username && acc.password);

    if (!accountsToCheck.length) {
      toast.error('Không tìm thấy thông tin username/password để check.');
      return;
    }

    setIsCheckingSkins(true);
    toast.info('Bắt đầu check skins... Vui lòng kiểm tra màn hình máy chủ để giải captcha nếu có.');

    try {
      const response = await fetch('/api/game/lien-quan-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accounts: accountsToCheck }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'Không thể check skins.');
      }

      // Merge results back
      const updatedRows = result.rows.map(row => {
        const checked = data.results.find((r: any) => r.username === row.username);
        if (checked) {
          return {
            ...row,
            ...checked,
          };
        }
        return row;
      });

      setResult(prev => {
        if (!prev) return null;
        return {
          ...prev,
          rows: updatedRows,
        };
      });

      toast.success(data.message || 'Đã check skins xong!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Lỗi trong quá trình check.');
    } finally {
      setIsCheckingSkins(false);
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
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant={result.unlocked ? 'success' : 'warning'} className="rounded-full">
                      {result.unlocked ? <Eye className="h-3 w-3" /> : <LockKeyhole className="h-3 w-3" />}
                      {result.unlocked ? 'Đã mở full acc' : 'Full acc đang khóa'}
                    </Badge>
                    {!result.unlocked ? (
                      <Badge variant="muted" className="rounded-full">
                        Nhập mật khẩu web để xem user/pass
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={copyExportText}
                    disabled={!result.unlocked}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-[0.9rem] bg-slate-900 px-4 text-xs font-black uppercase tracking-[0.12em] text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950"
                  >
                    <Clipboard className="h-4 w-4" />
                    Copy TXT
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!result.unlocked || !result.exportText) {
                        toast.error('Nhập mật khẩu web để mở full acc trước khi tải TXT.');
                        return;
                      }
                      downloadTextFile('lien-quan-accounts-filtered.txt', result.exportText);
                    }}
                    disabled={!result.unlocked}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-[0.9rem] bg-brand-blue px-4 text-xs font-black uppercase tracking-[0.12em] text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" />
                    Tải TXT
                  </button>
                  <button
                    type="button"
                    onClick={handleAutoCheckSkins}
                    disabled={isCheckingSkins || !result.unlocked}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-[0.9rem] bg-emerald-600 px-4 text-xs font-black uppercase tracking-[0.12em] text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isCheckingSkins ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Auto Check Skins
                  </button>
                </div>
              </div>

              {!result.unlocked ? (
                <div className="border-b border-slate-200/70 p-4 dark:border-white/10">
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                    <label className="block">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        Mở khóa xem full acc
                      </span>
                      <div className="relative mt-2">
                        <KeyRound className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type={showUnlockPassword ? 'text' : 'password'}
                          value={unlockPassword}
                          onChange={(event) => setUnlockPassword(event.target.value)}
                          placeholder="Nhập mật khẩu tài khoản web"
                          className="field-elevated h-11 w-full rounded-[1rem] pl-10 pr-12 text-sm font-semibold text-slate-900 outline-none dark:text-white"
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              unlockFullAccounts();
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowUnlockPassword((value) => !value)}
                          className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
                          aria-label={showUnlockPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        >
                          {showUnlockPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </label>
                    <button
                      type="button"
                      onClick={unlockFullAccounts}
                      disabled={isUnlocking}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-[1rem] bg-emerald-500 px-5 text-xs font-black uppercase tracking-[0.14em] text-white disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isUnlocking ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
                      Mở full acc
                    </button>
                  </div>
                  <div className="mt-2 text-[11px] font-semibold leading-5 text-slate-500 dark:text-slate-400">
                    Dùng mật khẩu đăng nhập web hiện tại để xem/copy/tải username và password đầy đủ. Thao tác này không trừ thêm tiền.
                  </div>
                </div>
              ) : null}

              <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
                <ResultMetric label="Acc full" value={getSummaryNumber(result.summaries?.filtered, 'full')} />
                <ResultMetric label="Có CCCD" value={getSummaryNumber(result.summaries?.filtered, 'withCccd')} />
                <ResultMetric label="Email xác thực" value={getSummaryNumber(result.summaries?.filtered, 'verifiedEmail')} />
                <ResultMetric label="Skin hiếm" value={getSummaryNumber(result.summaries?.filtered, 'rareSkin')} />
              </div>

              <SkinGroupPreview rows={result.rows || []} summary={result.summaries?.filtered} />

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

function SkinGroupPreview({
  rows,
  summary,
}: {
  rows: ResultRow[];
  summary?: Record<string, number | Record<string, number>>;
}) {
  const groups = skinGroups.map((group) => {
    const names = Array.from(
      new Set(rows.flatMap((row) => getSkinNames(row, group))),
    ).slice(0, 18);

    return {
      group,
      label: skinGroupLabels[group] || group,
      count: getSkinGroupCount(summary, group),
      names,
    };
  });

  if (!groups.some((group) => group.count > 0 || group.names.length > 0)) {
    return null;
  }

  return (
    <div className="border-t border-slate-200/70 p-4 dark:border-white/10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Skin nổi bật</div>
          <div className="mt-1 text-sm font-black text-slate-950 dark:text-white">
            Tên skin SSS, SS, Anime và skin hiếm parse từ file
          </div>
        </div>
        <Badge variant="info" className="hidden rounded-full sm:inline-flex">
          Preview tối đa 18 tên / nhóm
        </Badge>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => (
          <div key={group.group} className="rounded-[1rem] border border-slate-200/70 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-700 dark:text-slate-200">
                {group.label}
              </div>
              <span className="rounded-full bg-brand-blue/10 px-2.5 py-1 font-mono text-[11px] font-black text-brand-blue">
                {formatNumber(group.count)}
              </span>
            </div>
            {group.names.length ? (
              <div className="mt-3 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto pr-1">
                {group.names.map((name) => (
                  <span
                    key={`${group.group}-${name}`}
                    className="max-w-full truncate rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600 dark:border-white/10 dark:bg-slate-950/40 dark:text-slate-300"
                    title={name}
                  >
                    {name}
                  </span>
                ))}
              </div>
            ) : (
              <div className="mt-3 text-[11px] font-semibold text-slate-400">Không có tên skin trong nhóm này.</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
