import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function getUserId() {
  const cookieStore = await cookies();
  return Number(cookieStore.get('user_id')?.value || 0);
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null) as { accounts?: { username: string; password: string }[] } | null;
    const accounts = body?.accounts || [];

    if (!accounts.length) {
      return NextResponse.json({ success: false, message: 'Vui lòng cung cấp danh sách tài khoản cần check.' }, { status: 400 });
    }

    if (accounts.length > 5) {
      return NextResponse.json({ success: false, message: 'Chỉ hỗ trợ check tối đa 5 tài khoản cùng lúc trên giao diện web để tránh quá tải.' }, { status: 400 });
    }

    // 1. Create temp file paths
    const tempDir = path.join(process.cwd(), 'scratch');
    await fs.mkdir(tempDir, { recursive: true });
    
    const uniqueId = Date.now().toString();
    const inputPath = path.join(tempDir, `input_${uniqueId}.json`);
    const outputPath = path.join(tempDir, `output_${uniqueId}.json`);

    // 2. Write accounts input to JSON
    await fs.writeFile(inputPath, JSON.stringify({ accounts }, null, 2), 'utf-8');

    // 3. Exec python helper script
    const scriptPath = path.join(tempDir, 'run_check_api.py');
    const command = `python3 "${scriptPath}" "${inputPath}" "${outputPath}"`;

    await new Promise<void>((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error('Python execution error:', error, stderr);
          reject(new Error('Có lỗi xảy ra khi chạy tiến trình check.'));
        } else {
          resolve();
        }
      });
    });

    // 4. Read output JSON
    const outputContent = await fs.readFile(outputPath, 'utf-8').catch(() => null);
    if (!outputContent) {
      throw new Error('Không nhận được dữ liệu kết quả từ trình check.');
    }

    const data = JSON.parse(outputContent) as { results: Record<string, string | number>[] };

    // 5. Clean up temp files
    await fs.unlink(inputPath).catch(() => undefined);
    await fs.unlink(outputPath).catch(() => undefined);

    // 6. Return response
    return NextResponse.json({
      success: true,
      message: 'Đã check skins thành công!',
      results: data.results,
    });

  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể thực hiện check skins.' },
      { status: 500 },
    );
  }
}
