import { promises as fs, type Dirent } from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { NextRequest } from 'next/server';
import type { FunctionTool } from 'openai/resources/responses/responses';
import { db } from '@/lib/db';
import { logAdminAction } from '@/lib/admin-auth';
import {
  adminResourceConfig,
  createAdminResource,
  deleteAdminResource,
  runAdminAction,
  updateAdminResource,
} from '@/lib/admin-data';
import { isTrackableIp } from '@/lib/ip-security';

const execFileAsync = promisify(execFile);
const WORKSPACE_ROOT = path.resolve(process.cwd(), '..');
const APP_ROOT = process.cwd();

export interface AdminToolContext {
  adminId: number;
  latestUserMessage: string;
  auditRequest?: NextRequest;
}

export interface AdminToolExecution {
  name: string;
  input: Record<string, unknown>;
  output: unknown;
}

export function toJsonSafeValue<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, currentValue) => {
      if (typeof currentValue === 'bigint') {
        return Number(currentValue);
      }
      if (currentValue instanceof Date) {
        return currentValue.toISOString();
      }
      return currentValue;
    })
  ) as T;
}

const ADMIN_RESOURCE_ACTION_HINTS: Record<string, string[]> = {
  deposits: ['approve', 'reject', 'check-new-deposits'],
  'card-orders': ['refund'],
  'forum-threads': ['approve', 'reject', 'pin', 'unpin', 'bulk-delete', 'bulk-update'],
  'forum-posts': ['approve', 'reject', 'bulk-delete', 'bulk-update'],
  'find-jobs': ['approve', 'reject', 'pin', 'unpin', 'bulk-delete', 'bulk-update'],
  'registration-ips': ['block-ip', 'unblock-ip', 'lock-users-by-ip', 'unlock-users-by-ip'],
  resources: ['sync'],
  'resource-categories': ['sync'],
  'smm-services': ['sync'],
  providers: ['sync'],
};

export const adminAiTools: FunctionTool[] = [
  {
    type: 'function',
    name: 'list_admin_resource_capabilities',
    description: 'Liệt kê toàn bộ resource admin đang quản lý, các field có thể create/update và action sẵn có.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'list_database_tables',
    description: 'Liệt kê các bảng trong database hiện tại để admin kiểm tra cấu trúc dữ liệu.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'describe_database_table',
    description: 'Xem cột, kiểu dữ liệu và khóa của một bảng trong database.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        table_name: {
          type: 'string',
          description: 'Tên bảng cần xem schema.',
        },
      },
      required: ['table_name'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'run_readonly_query',
    description: 'Chạy truy vấn chỉ đọc trên database. Chỉ dùng cho SELECT, SHOW, DESCRIBE, EXPLAIN hoặc WITH.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        sql: {
          type: 'string',
          description: 'Câu SQL chỉ đọc cần thực thi.',
        },
      },
      required: ['sql'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'list_env_keys',
    description: 'Liệt kê các biến môi trường đang có trong file .env của app.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'read_env_value',
    description: 'Đọc giá trị của một biến môi trường trong file .env của app.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'Tên biến môi trường cần đọc.',
        },
      },
      required: ['key'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'read_env_file',
    description: 'Đọc toàn bộ nội dung file .env của app. Chỉ dành cho admin nội bộ.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'read_workspace_file',
    description: 'Đọc nội dung file trong workspace dự án để admin kiểm tra code, config hoặc tài liệu.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Đường dẫn file tương đối từ gốc workspace /Users/hkha/Desktop/mmo hoặc đường dẫn tuyệt đối nằm trong workspace.',
        },
      },
      required: ['file_path'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'search_workspace_files',
    description: 'Tìm nhanh text hoặc tên file trong workspace dự án.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Từ khóa hoặc regex cần tìm.',
        },
      },
      required: ['pattern'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'inspect_registration_ip',
    description: 'Kiem tra mot IP da tung gan voi nhung tai khoan nao, trang thai khoa/ban va tinh trang ban IP hien tai.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        ip: {
          type: 'string',
          description: 'Dia chi IP can kiem tra.',
        },
      },
      required: ['ip'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'create_admin_resource_record',
    description: 'Tạo bản ghi mới trong resource admin. Chi dùng khi admin ra lenh tao/ghi ro rang.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        resource: {
          type: 'string',
          description: 'Ten resource admin can tao ban ghi, vi du users, settings, providers.',
        },
        data_json: {
          type: 'string',
          description: 'JSON object dang chuoi cho payload tao moi theo create_fields cua resource.',
        },
        request_excerpt: {
          type: 'string',
          description: 'Doan ngan trich nguyen van tu lenh moi nhat cua admin cho thay admin da yeu cau thao tac ghi.',
        },
      },
      required: ['resource', 'data_json', 'request_excerpt'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'update_admin_resource_record',
    description: 'Cap nhat mot ban ghi trong resource admin. Chi dung khi admin yeu cau thay doi ro rang.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        resource: {
          type: 'string',
          description: 'Ten resource admin can cap nhat.',
        },
        id: {
          type: 'number',
          description: 'ID ban ghi can cap nhat.',
        },
        data_json: {
          type: 'string',
          description: 'JSON object dang chuoi cho payload cap nhat theo update_fields cua resource.',
        },
        request_excerpt: {
          type: 'string',
          description: 'Doan ngan trich nguyen van tu lenh moi nhat cua admin cho thay admin da yeu cau thay doi.',
        },
      },
      required: ['resource', 'id', 'data_json', 'request_excerpt'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'delete_admin_resource_record',
    description: 'Xoa hoac xu ly xoa mot ban ghi trong resource admin. Chi dung khi admin yeu cau ro rang.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        resource: {
          type: 'string',
          description: 'Ten resource admin can xoa.',
        },
        id: {
          type: 'number',
          description: 'ID ban ghi can xoa.',
        },
        request_excerpt: {
          type: 'string',
          description: 'Doan ngan trich nguyen van tu lenh moi nhat cua admin cho thay admin da yeu cau xoa/ban/soft delete.',
        },
      },
      required: ['resource', 'id', 'request_excerpt'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'run_admin_resource_action',
    description: 'Chay action admin san co nhu approve deposit, refund card, block IP, pin bai, sync du lieu. Chi dung khi admin yeu cau ro rang.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        resource: {
          type: 'string',
          description: 'Ten resource admin can chay action.',
        },
        action: {
          type: 'string',
          description: 'Ten action can chay, vi du approve, reject, refund, block-ip, sync.',
        },
        id: {
          type: ['number', 'null'],
          description: 'ID ban ghi chinh can xu ly neu co.',
        },
        ids: {
          type: ['array', 'null'],
          items: { type: 'number' },
          description: 'Danh sach ID neu la bulk action.',
        },
        reason: {
          type: ['string', 'null'],
          description: 'Ly do bo sung neu action can.',
        },
        payload_json: {
          type: ['string', 'null'],
          description: 'JSON object dang chuoi cho payload bo sung truyen xuong action admin.',
        },
        request_excerpt: {
          type: 'string',
          description: 'Doan ngan trich nguyen van tu lenh moi nhat cua admin cho thay admin da yeu cau action nay.',
        },
      },
      required: ['resource', 'action', 'id', 'ids', 'reason', 'payload_json', 'request_excerpt'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'run_database_mutation',
    description: 'Chay mot cau SQL ghi du lieu hoac doi cau truc bang. Chi dung khi admin da yeu cau thuc thi ro rang.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        sql: {
          type: 'string',
          description: 'Mot cau SQL INSERT, UPDATE, DELETE, ALTER, CREATE, DROP, RENAME hoac REPLACE.',
        },
        request_excerpt: {
          type: 'string',
          description: 'Doan ngan trich nguyen van tu lenh moi nhat cua admin cho thay admin da yeu cau SQL ghi.',
        },
      },
      required: ['sql', 'request_excerpt'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'write_workspace_file',
    description: 'Ghi noi dung vao file trong workspace, ke ca code va .env. Chi dung khi admin da yeu cau ro rang.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Duong dan file tuong doi workspace hoac duong dan tuyet doi ben trong workspace.',
        },
        content: {
          type: 'string',
          description: 'Noi dung can ghi vao file.',
        },
        mode: {
          type: ['string', 'null'],
          enum: ['overwrite', 'append', null],
          description: 'overwrite de ghi de, append de noi them cuoi file.',
        },
        create_parents: {
          type: ['boolean', 'null'],
          description: 'Tao thu muc cha neu chua ton tai.',
        },
        request_excerpt: {
          type: 'string',
          description: 'Doan ngan trich nguyen van tu lenh moi nhat cua admin cho thay admin da yeu cau ghi file.',
        },
      },
      required: ['file_path', 'content', 'mode', 'create_parents', 'request_excerpt'],
      additionalProperties: false,
    },
  },
];

function ensureWorkspacePath(inputPath: string) {
  const resolved = path.isAbsolute(inputPath)
    ? path.resolve(inputPath)
    : path.resolve(WORKSPACE_ROOT, inputPath);

  if (!resolved.startsWith(WORKSPACE_ROOT)) {
    throw new Error('Duong dan nam ngoai workspace duoc phep.');
  }

  return resolved;
}

async function readEnvMap() {
  const envPath = path.join(APP_ROOT, '.env');
  const raw = await fs.readFile(envPath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const map = new Map<string, string>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) {
      continue;
    }
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^"(.*)"$/, '$1');
    map.set(key, value);
  }

  return { envPath, raw, map };
}

function normalizeReadonlySql(sql: string) {
  const normalized = sql.trim().replace(/;+$/g, '');
  const compact = normalized.replace(/\s+/g, ' ').trim().toLowerCase();

  if (!compact) {
    throw new Error('SQL trống.');
  }

  if (!/^(select|show|describe|desc|explain|with)\b/.test(compact)) {
    throw new Error('Chi cho phep truy van chi doc.');
  }

  if (/\b(insert|update|delete|drop|alter|truncate|create|replace|grant|revoke|rename)\b/.test(compact)) {
    throw new Error('SQL co chua tu khoa thay doi du lieu va da bi chan.');
  }

  if (normalized.includes(';')) {
    throw new Error('Chi cho phep mot cau SQL duy nhat.');
  }

  if (/^select\b/i.test(normalized) && !/\blimit\s+\d+\b/i.test(normalized)) {
    return `${normalized} LIMIT 200`;
  }

  return normalized;
}

function normalizeMutationSql(sql: string) {
  const normalized = sql.trim().replace(/;+$/g, '');
  const compact = normalized.replace(/\s+/g, ' ').trim().toLowerCase();

  if (!compact) {
    throw new Error('SQL trống.');
  }

  if (!/^(insert|update|delete|replace|alter|create|drop|rename)\b/.test(compact)) {
    throw new Error('Tool này chỉ cho phép SQL ghi hoặc thay đổi cấu trúc.');
  }

  if (/\bdrop\s+database\b/.test(compact) || /\btruncate\b/.test(compact) || /\bgrant\b/.test(compact) || /\brevoke\b/.test(compact)) {
    throw new Error('SQL quá nguy hiểm và đã bị chặn ở tool này.');
  }

  if (normalized.includes(';')) {
    throw new Error('Chi cho phep mot cau SQL duy nhat.');
  }

  return normalized;
}

function parseJsonObjectInput(value: unknown, fieldName: string) {
  const raw = String(value || '').trim();
  if (!raw) {
    throw new Error(`Thiếu ${fieldName}.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${fieldName} phải là JSON hợp lệ.`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${fieldName} phải là JSON object.`);
  }

  return parsed as Record<string, unknown>;
}

async function audit(context: AdminToolContext, action: string, target?: string) {
  await logAdminAction({
    adminId: context.adminId,
    action: `admin_ai:${action}`,
    target,
    req: context.auditRequest,
  });
}

const SEARCH_MAX_RESULTS = 200;
const SEARCH_MAX_FILE_BYTES = 250_000;
const SEARCH_EXCLUDED_DIRS = new Set([
  '.git',
  '.next',
  '.turbo',
  'build',
  'coverage',
  'dist',
  'node_modules',
]);
const SEARCH_BINARY_EXTENSIONS = new Set([
  '.avif',
  '.eot',
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.mp3',
  '.mp4',
  '.otf',
  '.pdf',
  '.png',
  '.ttf',
  '.webm',
  '.webp',
  '.woff',
  '.woff2',
]);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeComparisonText(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function requestAllowsElevatedAccess(message: string) {
  const normalized = normalizeComparisonText(message);
  if (!normalized) {
    return false;
  }

  const elevatedPatterns = [
    /\b(ban|khoa|mo khoa|unlock|unblock|block|duyet|tu choi|approve|reject|refund|pin|unpin)\b/,
    /\b(cap nhat|chinh|sua|doi|set|reset|tao|them|xoa|delete|drop|remove|purge|hard delete|xoa cung|loai bo|ghi|write|overwrite|append)\b/,
    /\b(chay|run|thuc hien|tien hanh|lam di|fix|sua loi)\b/,
  ];

  return elevatedPatterns.some((pattern) => pattern.test(normalized));
}

function ensureElevatedPermission(context: AdminToolContext, requestExcerpt: unknown) {
  const latest = String(context.latestUserMessage || '').trim();
  if (!requestAllowsElevatedAccess(latest)) {
    throw new Error('Tool quyền cao chỉ chạy khi admin ra lệnh thay đổi rõ ràng trong tin nhắn hiện tại.');
  }

  const excerpt = String(requestExcerpt || '').trim();
  if (!excerpt) {
    throw new Error('Thiếu request_excerpt để đối chiếu lệnh admin.');
  }

  const normalizedLatest = normalizeComparisonText(latest);
  const normalizedExcerpt = normalizeComparisonText(excerpt);
  if (!normalizedExcerpt || !normalizedLatest.includes(normalizedExcerpt)) {
    throw new Error('request_excerpt không khớp với yêu cầu mới nhất của admin.');
  }
}

function buildAdminToolRequest(context: AdminToolContext, method: string) {
  const source = context.auditRequest;
  const headers = new Headers();
  const forwardedFor = source?.headers.get('x-forwarded-for');
  const realIp = source?.headers.get('x-real-ip');
  const userAgent = source?.headers.get('user-agent') || 'admin-ai';

  if (forwardedFor) {
    headers.set('x-forwarded-for', forwardedFor);
  }
  if (realIp) {
    headers.set('x-real-ip', realIp);
  }
  headers.set('user-agent', userAgent);
  headers.set('x-admin-ai', '1');

  return new NextRequest(source?.url || 'http://internal.local/api/admin/ai', {
    method,
    headers,
  });
}

function listAdminResourceCapabilities() {
  return Object.entries(adminResourceConfig).map(([resource, config]) => ({
    resource,
    title: config.title,
    readonly: Boolean(config.readonly),
    create_fields: config.createFields || [],
    update_fields: config.updateFields || [],
    actions: ADMIN_RESOURCE_ACTION_HINTS[resource] || [],
  }));
}

async function inspectRegistrationIp(ip: string) {
  if (!isTrackableIp(ip)) {
    throw new Error('IP không hợp lệ để kiểm tra.');
  }

  const [accounts, activeBans, blacklistEntries] = await Promise.all([
    db.users.findMany({
      where: { last_ip: ip },
      orderBy: [
        { created_at: 'desc' },
        { id: 'desc' },
      ],
      select: {
        id: true,
        username: true,
        fullname: true,
        email: true,
        role: true,
        status: true,
        created_at: true,
        last_login: true,
        last_activity: true,
        last_ip: true,
        lock_reason: true,
        locked_at: true,
      },
      take: 50,
    }),
    db.banned_ips.findMany({
      where: {
        ip,
        OR: [
          { expire_at: null },
          { expire_at: { gt: new Date() } },
        ],
      },
      orderBy: { created_at: 'desc' },
      take: 10,
    }).catch(() => []),
    db.ip_blacklist.findMany({
      where: { ip_address: ip },
      orderBy: { created_at: 'desc' },
      take: 10,
    }).catch(() => []),
  ]);

  return {
    ip,
    accounts_count: accounts.length,
    accounts: toJsonSafeValue(accounts),
    active_bans_count: activeBans.length,
    active_bans: toJsonSafeValue(activeBans),
    blacklist_entries_count: blacklistEntries.length,
    blacklist_entries: toJsonSafeValue(blacklistEntries),
  };
}

function buildSearchMatcher(pattern: string) {
  try {
    const regex = new RegExp(pattern, 'i');
    return (value: string) => regex.test(value);
  } catch {
    const regex = new RegExp(escapeRegExp(pattern), 'i');
    return (value: string) => regex.test(value);
  }
}

async function searchWorkspaceFilesWithNode(pattern: string) {
  const matcher = buildSearchMatcher(pattern);
  const results: string[] = [];

  async function visitDirectory(directory: string) {
    if (results.length >= SEARCH_MAX_RESULTS) {
      return;
    }

    let entries: Dirent[];
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= SEARCH_MAX_RESULTS) {
        return;
      }

      const fullPath = path.join(directory, entry.name);
      const relativePath = path.relative(WORKSPACE_ROOT, fullPath);

      if (entry.isDirectory()) {
        if (!SEARCH_EXCLUDED_DIRS.has(entry.name)) {
          await visitDirectory(fullPath);
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (matcher(relativePath)) {
        results.push(`${fullPath}:0:${relativePath}`);
        continue;
      }

      if (SEARCH_BINARY_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        continue;
      }

      try {
        const stats = await fs.stat(fullPath);
        if (stats.size > SEARCH_MAX_FILE_BYTES) {
          continue;
        }

        const content = await fs.readFile(fullPath, 'utf8');
        const lines = content.split(/\r?\n/);
        for (let index = 0; index < lines.length && results.length < SEARCH_MAX_RESULTS; index += 1) {
          const line = lines[index] || '';
          if (matcher(line)) {
            results.push(`${fullPath}:${index + 1}:${line.trim().slice(0, 500)}`);
          }
        }
      } catch {
        continue;
      }
    }
  }

  await visitDirectory(WORKSPACE_ROOT);
  return results;
}

async function searchWorkspaceFiles(pattern: string) {
  try {
    const { stdout } = await execFileAsync(
      'rg',
      ['-n', '--hidden', '--glob', '!.next', '--glob', '!node_modules', pattern, WORKSPACE_ROOT],
      { maxBuffer: 1024 * 1024 }
    );

    return stdout
      .split('\n')
      .filter(Boolean)
      .slice(0, SEARCH_MAX_RESULTS);
  } catch (error) {
    const typedError = error as { code?: string | number; stdout?: string };
    if (typedError.code === 1 || typedError.code === '1') {
      return [];
    }
    if (typedError.code === 'ENOENT') {
      return searchWorkspaceFilesWithNode(pattern);
    }
    throw error;
  }
}

export async function executeAdminAiTool(
  context: AdminToolContext,
  name: string,
  input: Record<string, unknown>
): Promise<AdminToolExecution> {
  switch (name) {
    case 'list_admin_resource_capabilities': {
      const resources = listAdminResourceCapabilities();
      await audit(context, 'list_admin_resource_capabilities');
      return { name, input, output: toJsonSafeValue(resources) };
    }
    case 'list_database_tables': {
      const rows = await db.$queryRawUnsafe<Array<{ table_name: string }>>(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = DATABASE()
        ORDER BY table_name
      `);
      await audit(context, 'list_database_tables');
      return { name, input, output: toJsonSafeValue(rows) };
    }
    case 'describe_database_table': {
      const tableName = String(input.table_name || '').trim();
      if (!tableName) {
        throw new Error('Thiếu table_name.');
      }
      const safeTable = tableName.replace(/[^a-zA-Z0-9_]/g, '');
      if (!safeTable) {
        throw new Error('Tên bảng không hợp lệ.');
      }
      const rows = await db.$queryRawUnsafe(`
        SELECT column_name, data_type, column_type, is_nullable, column_key, extra
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = '${safeTable}'
        ORDER BY ordinal_position
      `);
      await audit(context, 'describe_database_table', safeTable);
      return { name, input, output: toJsonSafeValue(rows) };
    }
    case 'run_readonly_query': {
      const sql = normalizeReadonlySql(String(input.sql || ''));
      const rows = await db.$queryRawUnsafe(sql);
      await audit(context, 'run_readonly_query', sql.slice(0, 180));
      return { name, input: { sql }, output: toJsonSafeValue(rows) };
    }
    case 'list_env_keys': {
      const env = await readEnvMap();
      const keys = Array.from(env.map.keys()).sort();
      await audit(context, 'list_env_keys');
      return { name, input, output: toJsonSafeValue({ envPath: env.envPath, keys }) };
    }
    case 'read_env_value': {
      const key = String(input.key || '').trim();
      if (!key) {
        throw new Error('Thiếu key.');
      }
      const env = await readEnvMap();
      await audit(context, 'read_env_value', key);
      return {
        name,
        input,
        output: toJsonSafeValue({
          envPath: env.envPath,
          key,
          value: env.map.get(key) ?? null,
        }),
      };
    }
    case 'read_env_file': {
      const env = await readEnvMap();
      await audit(context, 'read_env_file');
      return { name, input, output: toJsonSafeValue({ envPath: env.envPath, content: env.raw }) };
    }
    case 'read_workspace_file': {
      const filePath = String(input.file_path || '').trim();
      if (!filePath) {
        throw new Error('Thiếu file_path.');
      }
      const resolved = ensureWorkspacePath(filePath);
      const stats = await fs.stat(resolved);
      if (!stats.isFile()) {
        throw new Error('Đường dẫn không phải file.');
      }
      if (stats.size > 250_000) {
        throw new Error('File quá lớn, hãy đọc file nhỏ hơn hoặc dùng search trước.');
      }
      const content = await fs.readFile(resolved, 'utf8');
      await audit(context, 'read_workspace_file', resolved);
      return {
        name,
        input,
        output: toJsonSafeValue({
          path: resolved,
          content,
        }),
      };
    }
    case 'search_workspace_files': {
      const pattern = String(input.pattern || '').trim();
      if (!pattern) {
        throw new Error('Thiếu pattern.');
      }
      const results = await searchWorkspaceFiles(pattern);
      await audit(context, 'search_workspace_files', pattern);
      return {
        name,
        input,
        output: toJsonSafeValue(results),
      };
    }
    case 'inspect_registration_ip': {
      const ip = String(input.ip || '').trim();
      if (!ip) {
        throw new Error('Thiếu ip.');
      }
      const output = await inspectRegistrationIp(ip);
      await audit(context, 'inspect_registration_ip', ip);
      return { name, input: { ip }, output };
    }
    case 'create_admin_resource_record': {
      ensureElevatedPermission(context, input.request_excerpt);
      const resource = String(input.resource || '').trim();
      if (!resource) {
        throw new Error('Thiếu resource.');
      }
      const data = parseJsonObjectInput(input.data_json, 'data_json');
      const result = await createAdminResource(resource, data, context.adminId, buildAdminToolRequest(context, 'POST'));
      await audit(context, 'create_admin_resource_record', `${resource}`);
      return { name, input, output: toJsonSafeValue(result) };
    }
    case 'update_admin_resource_record': {
      ensureElevatedPermission(context, input.request_excerpt);
      const resource = String(input.resource || '').trim();
      const id = Number(input.id || 0);
      if (!resource || !id) {
        throw new Error('Thiếu resource hoặc id.');
      }
      const data = parseJsonObjectInput(input.data_json, 'data_json');
      const result = await updateAdminResource(resource, id, data, context.adminId, buildAdminToolRequest(context, 'PATCH'));
      await audit(context, 'update_admin_resource_record', `${resource}#${id}`);
      return { name, input, output: toJsonSafeValue(result) };
    }
    case 'delete_admin_resource_record': {
      ensureElevatedPermission(context, input.request_excerpt);
      const resource = String(input.resource || '').trim();
      const id = Number(input.id || 0);
      if (!resource || !id) {
        throw new Error('Thiếu resource hoặc id.');
      }
      const result = await deleteAdminResource(resource, id, context.adminId, buildAdminToolRequest(context, 'DELETE'));
      await audit(context, 'delete_admin_resource_record', `${resource}#${id}`);
      return { name, input, output: toJsonSafeValue(result) };
    }
    case 'run_admin_resource_action': {
      ensureElevatedPermission(context, input.request_excerpt);
      const resource = String(input.resource || '').trim();
      const action = String(input.action || '').trim();
      if (!resource || !action) {
        throw new Error('Thiếu resource hoặc action.');
      }

      const payload = String(input.payload_json || '').trim()
        ? parseJsonObjectInput(input.payload_json, 'payload_json')
        : {};
      const id = Number(input.id || 0);
      const ids = Array.isArray(input.ids)
        ? input.ids.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0)
        : [];
      const reason = String(input.reason || '').trim();

      payload.action = action;
      if (id > 0) {
        payload.id = id;
      }
      if (ids.length > 0) {
        payload.ids = ids;
      }
      if (reason) {
        payload.reason = reason;
      }

      const result = await runAdminAction(resource, payload, context.adminId, buildAdminToolRequest(context, 'POST'));
      await audit(context, 'run_admin_resource_action', `${resource}:${action}`);
      return { name, input, output: toJsonSafeValue(result) };
    }
    case 'run_database_mutation': {
      ensureElevatedPermission(context, input.request_excerpt);
      const sql = normalizeMutationSql(String(input.sql || ''));
      const affected = await db.$executeRawUnsafe(sql);
      await audit(context, 'run_database_mutation', sql.slice(0, 180));
      return {
        name,
        input: {
          sql,
          request_excerpt: input.request_excerpt,
        },
        output: toJsonSafeValue({ affected_rows: Number(affected || 0) }),
      };
    }
    case 'write_workspace_file': {
      ensureElevatedPermission(context, input.request_excerpt);
      const filePath = String(input.file_path || '').trim();
      const content = String(input.content ?? '');
      const mode = String(input.mode || 'overwrite').trim().toLowerCase();
      const createParents = Boolean(input.create_parents);
      if (!filePath) {
        throw new Error('Thiếu file_path.');
      }
      if (!['overwrite', 'append'].includes(mode)) {
        throw new Error('mode chỉ hỗ trợ overwrite hoặc append.');
      }

      const resolved = ensureWorkspacePath(filePath);
      if (createParents) {
        await fs.mkdir(path.dirname(resolved), { recursive: true });
      }
      if (mode === 'append') {
        await fs.appendFile(resolved, content, 'utf8');
      } else {
        await fs.writeFile(resolved, content, 'utf8');
      }

      await audit(context, 'write_workspace_file', resolved);
      return {
        name,
        input: {
          file_path: filePath,
          mode,
          create_parents: createParents,
          request_excerpt: input.request_excerpt,
        },
        output: toJsonSafeValue({
          path: resolved,
          bytes_written: Buffer.byteLength(content, 'utf8'),
          mode,
        }),
      };
    }
    default:
      throw new Error(`Tool không được hỗ trợ: ${name}`);
  }
}
