export const LIEN_QUAN_FILTER_FEE = 3000;
export const LIEN_QUAN_FILTER_PREVIEW_LIMIT = 500;

export type LienQuanAccountRow = Record<string, string | number> & {
  username: string;
  password: string;
  raw_line: string;
};

export type LienQuanAccountFilters = {
  search?: string;
  vipMin?: number;
  vipMax?: number;
  skinMin?: number;
  skinMax?: number;
  ssMin?: number;
  statuses?: string[];
  requireCccd?: boolean;
  requireVerifiedEmail?: boolean;
  requireRareSkin?: boolean;
};

const listFieldKeys = new Set([
  'SS',
  'SSS',
  'ANIME',
  'AOV',
  'OTHER',
  'SKIN HIẾM',
  'MYSTIC',
  'S-DREAMER',
  'VALENTINE',
  'SSM',
]);

const exportFieldOrder = [
  'UID',
  'NAME',
  'VIP',
  'RANK',
  'LEVEL',
  'TƯỚNG',
  'SỐ TƯỚNG THÔNG THẠO S',
  'SKIN',
  'QH',
  'VÀNG',
  'LỊCH SỬ NẠP',
  'SÒ',
  'CCCD',
  'EMAIL',
  'AUTHEN',
  'SĐT',
  'FB',
  'BAND',
  'NGÀY ĐĂNG KÝ',
  'REGION',
  'ĐĂNG NHẬP GẦN NHẤT',
  'TẦN SUẤT ONLINE',
  'GAMES',
  'ĐỔI EMAIL GẦN NHẤT',
  'ĐỔI SĐT GẦN NHẤT',
  'ĐỔI PASSWORD GẦN NHẤT',
  'GỐC TÀI KHOẢN',
  'SS',
  'SSS',
  'ANIME',
  'AOV',
  'OTHER',
  'SKIN HIẾM',
  'MYSTIC',
  'S-DREAMER',
  'VALENTINE',
  'SSM',
  'TÌNH TRẠNG',
];

function normalizeSearchText(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase();
}

function normalizeKey(value: string) {
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
}

function parseNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }

  const match = String(value || '').match(/-?\d[\d.,]*/);
  if (!match) {
    return fallback;
  }

  const normalized = match[0].replace(/[.,]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseListField(value: string) {
  const match = value.match(/^(\d+)\s*\[([\s\S]*)\]$/);
  if (!match) {
    return {
      count: 0,
      text: value,
    };
  }

  const declaredCount = Number(match[1]);
  const items = match[2]
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    count: Number.isFinite(declaredCount) ? declaredCount : items.length,
    text: items.join(', '),
  };
}

export function parseLienQuanAccountLine(line: string): LienQuanAccountRow | null {
  const rawLine = line.trim();
  if (!rawLine) {
    return null;
  }

  const parts = rawLine.split('|').map((part) => part.trim());
  const row: LienQuanAccountRow = {
    username: parts[0] || '',
    password: parts[1] || '',
    raw_line: rawLine,
  };

  for (const part of parts.slice(2)) {
    const separatorIndex = part.indexOf(':');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = normalizeKey(part.slice(0, separatorIndex));
    const value = part.slice(separatorIndex + 1).trim();
    if (!key) {
      continue;
    }

    if (listFieldKeys.has(key)) {
      const parsed = parseListField(value);
      row[key] = parsed.text;
      row[`${key}_COUNT`] = parsed.count;
    } else {
      row[key] = value;
    }
  }

  if (!row.username && !row.UID && !row.NAME) {
    return null;
  }

  return row;
}

export function parseLienQuanAccountText(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => parseLienQuanAccountLine(line))
    .filter((row): row is LienQuanAccountRow => Boolean(row));
}

function statusMatches(rowStatus: unknown, selectedStatuses: string[]) {
  if (selectedStatuses.length === 0) {
    return true;
  }

  const normalizedStatus = normalizeSearchText(rowStatus).toUpperCase();
  const selected = selectedStatuses.map((item) => normalizeSearchText(item).toUpperCase());
  const knownStatuses = ['ACC FULL', 'ACC BINH THUONG', 'ACC DIE'];
  const hasKnownStatus = knownStatuses.some((status) => normalizedStatus.includes(status));

  return selected.some((status) => {
    if (status === 'KHAC') {
      return !hasKnownStatus;
    }

    return normalizedStatus.includes(status);
  });
}

function hasVerifiedEmail(value: unknown) {
  const normalized = normalizeSearchText(value).toUpperCase();
  if (!normalized || normalized.includes('CHUA XAC THUC') || normalized.startsWith('NO')) {
    return false;
  }

  return normalized.includes('YES') || normalized.includes('DA XAC THUC');
}

function hasRareSkin(row: LienQuanAccountRow) {
  return ['SKIN HIẾM', 'MYSTIC', 'S-DREAMER'].some((key) => {
    const count = parseNumber(row[`${key}_COUNT`], 0);
    if (count > 0) {
      return true;
    }

    const value = String(row[key] || '');
    return value.trim() && !/^0\b|^NO\b/i.test(value.trim());
  });
}

export function filterLienQuanAccounts(
  rows: LienQuanAccountRow[],
  filters: LienQuanAccountFilters = {},
) {
  const keyword = normalizeSearchText(filters.search || '');
  const vipMin = Math.max(0, Math.trunc(Number(filters.vipMin || 0)));
  const vipMax = Math.trunc(Number(filters.vipMax || 0));
  const skinMin = Math.max(0, Math.trunc(Number(filters.skinMin || 0)));
  const skinMax = Math.trunc(Number(filters.skinMax || 0));
  const ssMin = Math.max(0, Math.trunc(Number(filters.ssMin || 0)));
  const statuses = Array.isArray(filters.statuses)
    ? filters.statuses.map((item) => String(item || '').trim()).filter(Boolean)
    : [];

  return rows.filter((row) => {
    if (keyword) {
      const haystack = normalizeSearchText(
        `${row.username} ${row.UID || ''} ${row.NAME || ''} ${row.raw_line}`,
      );
      if (!haystack.includes(keyword)) {
        return false;
      }
    }

    const vip = parseNumber(row.VIP, 0);
    if (vipMin > 0 && vip < vipMin) {
      return false;
    }
    if (vipMax > 0 && vip > vipMax) {
      return false;
    }

    const skin = parseNumber(row.SKIN, 0);
    if (skinMin > 0 && skin < skinMin) {
      return false;
    }
    if (skinMax > 0 && skin > skinMax) {
      return false;
    }

    if (ssMin > 0 && parseNumber(row.SS_COUNT, 0) < ssMin) {
      return false;
    }

    if (!statusMatches(row['TÌNH TRẠNG'], statuses)) {
      return false;
    }

    if (filters.requireCccd && !/YES/i.test(String(row.CCCD || ''))) {
      return false;
    }

    if (filters.requireVerifiedEmail && !hasVerifiedEmail(row.EMAIL)) {
      return false;
    }

    if (filters.requireRareSkin && !hasRareSkin(row)) {
      return false;
    }

    return true;
  });
}

export function buildLienQuanExportText(rows: LienQuanAccountRow[]) {
  return rows
    .map((row) => row.raw_line || buildLienQuanExportLine(row))
    .join('\n');
}

function buildLienQuanExportLine(row: LienQuanAccountRow) {
  const parts = [`${row.username || ''}|${row.password || ''}`];

  for (const key of exportFieldOrder) {
    const value = row[key];
    if (value === undefined || value === null || String(value).trim() === '') {
      continue;
    }

    parts.push(`${key} : ${value}`);
  }

  return parts.join(' | ');
}

export function summarizeLienQuanRows(rows: LienQuanAccountRow[]) {
  return {
    total: rows.length,
    full: rows.filter((row) => statusMatches(row['TÌNH TRẠNG'], ['ACC FULL'])).length,
    withCccd: rows.filter((row) => /YES/i.test(String(row.CCCD || ''))).length,
    verifiedEmail: rows.filter((row) => hasVerifiedEmail(row.EMAIL)).length,
    rareSkin: rows.filter(hasRareSkin).length,
  };
}
