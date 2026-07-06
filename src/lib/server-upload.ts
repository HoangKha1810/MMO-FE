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

export function isUploadFileLike(value: FormDataEntryValue | null | undefined): value is File {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'arrayBuffer' in value &&
    typeof (value as { arrayBuffer?: unknown }).arrayBuffer === 'function' &&
    'size' in value &&
    Number((value as { size?: unknown }).size || 0) > 0
  );
}

function getSafeExtension(file: File) {
  return path.extname(file.name || '').replace('.', '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeUploadInput(input: SaveUploadedFileInput) {
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

  return {
    file,
    ext,
    filename,
    relativeDir,
    targetDir,
  };
}

function inferImageMimeType(file: File, ext: string) {
  const rawType = String(file.type || '').trim().toLowerCase();
  if (rawType.startsWith('image/')) {
    return rawType;
  }

  if (ext === 'jpg') {
    return 'image/jpeg';
  }

  return `image/${ext}`;
}

export async function saveUploadedFile(input: SaveUploadedFileInput) {
  const { file, filename, relativeDir, targetDir } = normalizeUploadInput(input);

  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(path.join(targetDir, filename), Buffer.from(await file.arrayBuffer()));

  return path.posix.join(relativeDir, filename);
}

export async function saveUploadedFileAsDataUrl(input: SaveUploadedFileInput) {
  const { file, ext } = normalizeUploadInput(input);
  const mimeType = inferImageMimeType(file, ext);
  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}
