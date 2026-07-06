import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedSessionUserId } from '@/lib/session-cookie';
import { createForumAd, getForumAdDetail, updateForumAd } from '@/lib/forum-actions';
import { isUploadFileLike, saveUploadedFile } from '@/lib/server-upload';

export const runtime = 'nodejs';

async function getUserId() {
  return getVerifiedSessionUserId();
}

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

async function readPayload(req: NextRequest) {
  const contentType = req.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData();
    const imageFile = formData.get('image');
    return {
      action: getFormString(formData, 'action') || 'create',
      adId: Number(getFormString(formData, 'ad_id') || 0),
      durationDays: Number(getFormString(formData, 'duration_days') || 30),
      linkUrl: getFormString(formData, 'link_url'),
      imageFile: isUploadFileLike(imageFile) ? imageFile : null,
    };
  }

  const body = await req.json().catch(() => ({}));
  return {
    action: String(body.action || 'create'),
    adId: Number(body.ad_id || 0),
    durationDays: Number(body.duration_days || 30),
    linkUrl: String(body.link_url || '').trim(),
    imageFile: null as File | null,
  };
}

export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const adId = Number(req.nextUrl.searchParams.get('ad_id') || 0);
  if (!adId) {
    return NextResponse.json({ success: false, message: 'Thiếu ad_id' }, { status: 400 });
  }

  const data = await getForumAdDetail(userId, adId);
  if (!data) {
    return NextResponse.json({ success: false, message: 'Không tìm thấy quảng cáo' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data });
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await readPayload(req);
    const imagePath = payload.imageFile
      ? await saveUploadedFile({
          file: payload.imageFile,
          folder: ['forum-ads'],
          prefix: `forum_ad_${userId}`,
          maxSize: 8 * 1024 * 1024,
        })
      : undefined;

    if (!payload.linkUrl && !imagePath) {
      return NextResponse.json({ success: false, message: 'Cần ít nhất link hoặc banner quảng cáo' }, { status: 400 });
    }

    if (payload.action === 'update') {
      if (!payload.adId) {
        return NextResponse.json({ success: false, message: 'Thiếu ad_id' }, { status: 400 });
      }

      const data = await updateForumAd(userId, payload.adId, {
        durationDays: payload.durationDays,
        linkUrl: payload.linkUrl,
        imagePath,
      });
      return NextResponse.json({ success: true, message: 'Đã cập nhật quảng cáo', data });
    }

    const data = await createForumAd(userId, {
      durationDays: payload.durationDays,
      linkUrl: payload.linkUrl,
      imagePath,
    });
    return NextResponse.json({ success: true, message: 'Đã tạo yêu cầu quảng cáo', data });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không xử lý được quảng cáo' },
      { status: 400 }
    );
  }
}
