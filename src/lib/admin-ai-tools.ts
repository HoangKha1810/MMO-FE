import { promises as fs, type Dirent } from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { FunctionTool } from 'openai/resources/responses/responses';
import { db } from '@/lib/db';
import { logAdminAction } from '@/lib/admin-auth';

const execFileAsync = promisify(execFile);
const WORKSPACE_ROOT = path.resolve(process.cwd(), '..');
const APP_ROOT = process.cwd();

export interface AdminToolContext {
  adminId: number;
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

export const adminAiTools: FunctionTool[] = [
  {
    type: 'function',
    name: 'list_database_tables',
    description: 'Liệt kê các bảng trong database hiện tại để admin kiểm tra cấu trúc dữ liệu.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {},
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

async function audit(context: AdminToolContext, action: string, target?: string) {
  await logAdminAction({
    adminId: context.adminId,
    action: `admin_ai:${action}`,
    target,
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
    default:
      throw new Error(`Tool không được hỗ trợ: ${name}`);
  }
}
