import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createPressOrder, listUserPressOrders } from '@/lib/press-service';
import { toNumber } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

const MAX_DOCX_SIZE = 25 * 1024 * 1024;
const allowedExtensions = new Set(['doc', 'docx']);

const noStoreHeaders = {
  'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
};

type UploadFileLike = {
  name: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

async function getUserId() {
  const cookieStore = await cookies();
  return Math.trunc(toNumber(cookieStore.get('user_id')?.value, 0));
}

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function isUploadFileLike(value: unknown): value is UploadFileLike {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const file = value as Partial<UploadFileLike>;
  return typeof file.name === 'string' && typeof file.size === 'number' && typeof file.arrayBuffer === 'function';
}

async function savePressDocument(input: { file: UploadFileLike; userId: number }) {
  const ext = path.extname(input.file.name || '').replace('.', '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!ext || !allowedExtensions.has(ext)) {
    throw new Error('Chỉ nhận file .doc hoặc .docx');
  }

  if (input.file.size > MAX_DOCX_SIZE) {
    throw new Error('File Word quá lớn. Giới hạn tối đa 25MB.');
  }

  const safeBaseName = path
    .basename(input.file.name, path.extname(input.file.name))
    .replace(/[^a-z0-9_-]/gi, '-')
    .replace(/-+/g, '-')
    .slice(0, 64) || 'press-order';
  const filename = `${safeBaseName}-${Date.now()}-${randomBytes(4).toString('hex')}.${ext}`;
  const relativeDir = path.posix.join('uploads', 'press', 'orders', String(input.userId));
  const targetDir = path.join(process.cwd(), 'public', relativeDir);
  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(path.join(targetDir, filename), Buffer.from(await input.file.arrayBuffer()));

  return `/${relativeDir}/${filename}`;
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Bạn cần đăng nhập' }, { status: 401, headers: noStoreHeaders });
  }

  try {
    const orders = await listUserPressOrders(userId);
    return NextResponse.json({ success: true, data: orders }, { headers: noStoreHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không tải được đơn lên báo';
    return NextResponse.json({ success: false, message }, { status: 500, headers: noStoreHeaders });
  }
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Bạn cần đăng nhập' }, { status: 401, headers: noStoreHeaders });
  }

  let savedDocxPath = '';

  try {
    const formData = await req.formData();
    const publicationId = Math.trunc(toNumber(getFormString(formData, 'publication_id'), 0));
    const title = getFormString(formData, 'title').slice(0, 180);
    const contact = getFormString(formData, 'contact').slice(0, 180);
    const note = getFormString(formData, 'note').slice(0, 4000);
    const docxFileRaw = formData.get('docx_file');
    const docxFile = isUploadFileLike(docxFileRaw) && docxFileRaw.size > 0 ? docxFileRaw : null;

    if (!publicationId) {
      return NextResponse.json({ success: false, message: 'Thiếu đầu báo cần đặt' }, { status: 400, headers: noStoreHeaders });
    }

    if (docxFile) {
      savedDocxPath = await savePressDocument({ file: docxFile, userId });
    }

    const result = await createPressOrder({
      userId,
      publicationId,
      title,
      contact,
      note,
      docxPath: savedDocxPath,
    });

    return NextResponse.json({
      success: true,
      message: 'Đã thanh toán và tạo đơn lên báo, admin sẽ liên hệ xử lý',
      data: result,
    }, { headers: noStoreHeaders });
  } catch (error) {
    if (savedDocxPath) {
      const absolutePath = path.join(process.cwd(), 'public', savedDocxPath.replace(/^\/+/, ''));
      await fs.unlink(absolutePath).catch(() => undefined);
    }

    const message = error instanceof Error ? error.message : 'Không tạo được đơn lên báo';
    return NextResponse.json({ success: false, message }, { status: 400, headers: noStoreHeaders });
  }
}
