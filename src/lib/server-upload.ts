import 'server-only';

import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

interface SaveUploadedFileInput {
  file: File;
  folder: string[];
  prefix: string;
  maxSize?: number;
  allowedExtensions?: string[];
}

function getSafeExtension(file: File) {
  return path.extname(file.name || '').replace('.', '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export async function saveUploadedFile(input: SaveUploadedFileInput) {
  const { file, folder, prefix } = input;
  const maxSize = input.maxSize ?? 6 * 1024 * 1024;
  const allowedExtensions = new Set((input.allowedExtensions ?? ['jpg', 'jpeg', 'png', 'webp', 'gif']).map((ext) => ext.toLowerCase()));
  const ext = getSafeExtension(file);

  if (!ext || !allowedExtensions.has(ext)) {
    throw new Error(`Tệp không hợp lệ. Chỉ hỗ trợ: ${Array.from(allowedExtensions).join(', ').toUpperCase()}`);
  }

  if (file.size > maxSize) {
    throw new Error(`Tệp quá lớn. Giới hạn ${Math.round(maxSize / 1024 / 1024)}MB.`);
  }

  const filename = `${prefix}_${Date.now()}_${randomBytes(4).toString('hex')}.${ext}`;
  const relativeDir = path.posix.join('uploads', ...folder.map((segment) => segment.replace(/[^a-z0-9/_-]/gi, '').trim()).filter(Boolean));
  const targetDir = path.join(process.cwd(), 'public', relativeDir);

  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(path.join(targetDir, filename), Buffer.from(await file.arrayBuffer()));

  return path.posix.join(relativeDir, filename);
}
