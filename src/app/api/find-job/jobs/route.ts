import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createFindJob } from '@/lib/legacy-modules';

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
    const body = await req.json();
    const title = String(body.title || '').trim();
    const description = String(body.description || '').trim();
    const category = String(body.category || 'general').trim();

    if (title.length < 8 || description.length < 20) {
      return NextResponse.json({ success: false, message: 'Tiêu đề hoặc mô tả quá ngắn' }, { status: 400 });
    }

    const job = await createFindJob(userId, {
      title,
      description,
      category,
      price_min: Number(body.price_min || 0) || undefined,
      price_max: Number(body.price_max || 0) || undefined,
      deadline_days: Number(body.deadline_days || 0) || undefined,
    });

    return NextResponse.json({ success: true, data: job });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không tạo được tin tuyển dụng';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
