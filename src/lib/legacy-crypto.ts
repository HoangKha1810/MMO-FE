import 'server-only';

import crypto from 'node:crypto';
import { getLegacyEnv } from '@/lib/legacy-env';

function getPhpCompatibleKey() {
  const secret = getLegacyEnv('ENCRYPTION_KEY');
  if (!secret) {
    return null;
  }

  const hexHash = crypto.createHash('sha256').update(secret).digest('hex');
  return Buffer.from(hexHash).subarray(0, 32);
}

export function encryptLegacyData(value: string) {
  if (!value) {
    return value;
  }

  const key = getPhpCompatibleKey();
  if (!key) {
    return value;
  }

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = `${cipher.update(value, 'utf8', 'base64')}${cipher.final('base64')}`;
  return Buffer.concat([Buffer.from(`${encrypted}::`, 'utf8'), iv]).toString('base64');
}

export function decryptLegacyData(value: string | null | undefined) {
  if (!value) {
    return '';
  }

  const key = getPhpCompatibleKey();
  if (!key) {
    return value;
  }

  try {
    const payload = Buffer.from(value, 'base64');
    const delimiter = payload.indexOf('::');
    if (delimiter < 0) {
      return value;
    }

    const encrypted = payload.subarray(0, delimiter).toString('utf8');
    const iv = payload.subarray(delimiter + 2);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    return `${decipher.update(encrypted, 'base64', 'utf8')}${decipher.final('utf8')}`;
  } catch {
    return value;
  }
}
