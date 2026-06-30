import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedSessionUserId } from '@/lib/session-cookie';
import { createOrUpdateFindJob, deleteFindJob } from '@/lib/find-job-actions';

async function getUserId() {
  return getVerifiedSessionUserId();
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const action = String(body.action || 'create').trim().toLowerCase();
    const jobId = Number(body.job_id || body.id || 0);

    if (action === 'delete') {
      if (!jobId) {
        return NextResponse.json({ success: false, message: 'Thiếu job ID' }, { status: 400 });
      }
      const data = await deleteFindJob(userId, jobId);
      return NextResponse.json({ success: true, message: 'Đã đóng tin tuyển dụng', data });
    }

    const title = String(body.title || '').trim();
    const description = String(body.description || '').trim();
    const category = String(body.category || 'general').trim();

    const job = await createOrUpdateFindJob(userId, {
      id: action === 'update' ? jobId : undefined,
      title,
      description,
      category,
      priceMin: Number(body.price_min || 0) || undefined,
      priceMax: Number(body.price_max || 0) || undefined,
    });

    return NextResponse.json({
      success: true,
      message: action === 'update'
        ? 'Đã cập nhật tin tuyển dụng, vui lòng chờ admin duyệt lại.'
        : 'Đã tạo tin tuyển dụng, vui lòng chờ admin duyệt trước khi hiển thị công khai.',
      data: job,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không tạo được tin tuyển dụng';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
