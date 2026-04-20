import 'server-only';

import fs from 'node:fs';

const FALLBACK_LEGACY_ENV_PATH = '/Users/hkha/Downloads/vscode/.env';

let cachedEnv:
  | {
      path: string;
      mtimeMs: number;
      values: Record<string, string>;
    }
  | null = null;

function stripWrappedQuotes(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function parseEnvFile(content: string) {
  return content.split(/\r?\n/).reduce<Record<string, string>>((acc, rawLine) => {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      return acc;
    }

    const equalsIndex = line.indexOf('=');
    if (equalsIndex <= 0) {
      return acc;
    }

    const key = line.slice(0, equalsIndex).trim();
    const value = stripWrappedQuotes(line.slice(equalsIndex + 1).trim());

    if (key) {
      acc[key] = value;
    }

    return acc;
  }, {});
}

function resolveLegacyEnvPath() {
  const candidate = process.env.LEGACY_PHP_ENV_PATH?.trim() || FALLBACK_LEGACY_ENV_PATH;
  return fs.existsSync(candidate) ? candidate : null;
}

function readLegacyEnv() {
  const resolvedPath = resolveLegacyEnvPath();
  if (!resolvedPath) {
    return {};
  }

  const stat = fs.statSync(resolvedPath);
  if (cachedEnv && cachedEnv.path === resolvedPath && cachedEnv.mtimeMs === stat.mtimeMs) {
    return cachedEnv.values;
  }

  const values = parseEnvFile(fs.readFileSync(resolvedPath, 'utf8'));
  cachedEnv = {
    path: resolvedPath,
    mtimeMs: stat.mtimeMs,
    values,
  };

  return values;
}

export function getLegacyEnv(key: string, fallback = '') {
  const runtimeValue = process.env[key];
  if (typeof runtimeValue === 'string' && runtimeValue.trim() !== '') {
    return runtimeValue.trim();
  }

  const values = readLegacyEnv();
  const legacyValue = values[key];
  return typeof legacyValue === 'string' && legacyValue.trim() !== ''
    ? legacyValue.trim()
    : fallback;
}

export function getLegacyEnvPath() {
  return resolveLegacyEnvPath();
}
