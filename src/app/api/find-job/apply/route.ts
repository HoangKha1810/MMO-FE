import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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
    const jobId = Number(body.job_id || 0);
    if (!jobId) {
      return NextResponse.json({ success: false, message: 'Thiếu job ID' }, { status: 400 });
    }

    const ownerRows = await db.$queryRawUnsafe<Array<{ owner_id: number | bigint }>>(
      `
        SELECT posted_by AS owner_id
        FROM find_job_jobs
        WHERE id = ?
        LIMIT 1
      `,
      jobId
    ).catch(async () => {
      return db.$queryRawUnsafe<Array<{ owner_id: number | bigint }>>(
        `
          SELECT user_id AS owner_id
          FROM find_jobs
          WHERE id = ?
          LIMIT 1
        `,
        jobId
      );
    });

    if (Number(ownerRows[0]?.owner_id || 0) === userId) {
      return NextResponse.json({ success: false, message: 'Bạn không thể tự ứng tuyển tin của chính mình' }, { status: 400 });
    }

    await db.$executeRawUnsafe(`
      INSERT INTO find_job_applications (job_id, applicant_id, applied_at, status)
      VALUES (?, ?, NOW(), 'pending')
      ON DUPLICATE KEY UPDATE applied_at = VALUES(applied_at)
    `, jobId, userId).catch(async () => {
      await db.$executeRawUnsafe(`
        INSERT INTO find_job_applications (job_id, applicant_id, applied_at, status)
        SELECT ?, ?, NOW(), 'pending'
        WHERE NOT EXISTS (
          SELECT 1 FROM find_job_applications WHERE job_id = ? AND applicant_id = ?
        )
      `, jobId, userId, jobId, userId);
    });

    await db.$executeRawUnsafe(
      `
        UPDATE find_job_jobs
        SET application_count = (
          SELECT COUNT(*) FROM find_job_applications WHERE job_id = ?
        )
        WHERE id = ?
      `,
      jobId,
      jobId
    ).catch(() => undefined);

    return NextResponse.json({ success: true, message: 'Đã gửi ứng tuyển' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể ứng tuyển';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
