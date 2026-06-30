import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedSessionUserId } from '@/lib/session-cookie';
import { reportFindJob } from '@/lib/find-job-actions';

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
    const jobId = Number(body.job_id || 0);
    const reason = String(body.reason || '').trim();
    const note = String(body.note || '').trim();

    if (!jobId || reason.length < 3) {
      return NextResponse.json({ success: false, message: 'Thiếu job hoặc lý do report' }, { status: 400 });
    }

    const data = await reportFindJob(userId, jobId, reason, note);
    return NextResponse.json({ success: true, message: 'Đã gửi report cho admin', data });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể gửi report' },
      { status: 400 }
    );
  }
}
