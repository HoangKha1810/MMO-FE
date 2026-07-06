import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedSessionUserId } from '@/lib/session-cookie';
import { createOrUpdateGameItem, setGameItemState } from '@/lib/game-market-actions';
import { parseGameMarketImageRefs } from '@/lib/game-market-media';
import { isUploadFileLike, saveUploadedFileAsDataUrl } from '@/lib/server-upload';

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
    const uploadedFiles = formData.getAll('images').filter(isUploadFileLike);

    return {
      action: (getFormString(formData, 'action') || 'create').toLowerCase(),
      itemId: Number(getFormString(formData, 'item_id') || 0),
      title: getFormString(formData, 'title'),
      category: getFormString(formData, 'category'),
      tag: getFormString(formData, 'tag'),
      badge: getFormString(formData, 'badge'),
      badgeColor: getFormString(formData, 'badge_color'),
      price: Number(getFormString(formData, 'price') || 0),
      stock: Number(getFormString(formData, 'stock') || 1),
      prepTime: getFormString(formData, 'prep_time'),
      originalPrice: Number(getFormString(formData, 'original_price') || 0) || undefined,
      thumbnail: getFormString(formData, 'thumbnail'),
      description: getFormString(formData, 'description'),
      features: getFormString(formData, 'features'),
      rank: getFormString(formData, 'rank'),
      skins: getFormString(formData, 'skins'),
      champs: getFormString(formData, 'champs'),
      accountDetails: getFormString(formData, 'account_details'),
      deliveryMethod: getFormString(formData, 'delivery_method') || 'manual',
      existingImages: parseGameMarketImageRefs(getFormString(formData, 'existing_images')),
      uploadedFiles,
    };
  }

  const body = await req.json().catch(() => ({}));
  return {
    action: String(body.action || 'create').trim().toLowerCase(),
    itemId: Number(body.item_id || body.id || 0),
    title: String(body.title || ''),
    category: String(body.category || ''),
    tag: String(body.tag || ''),
    badge: String(body.badge || ''),
    badgeColor: String(body.badge_color || ''),
    price: Number(body.price || 0),
    stock: Number(body.stock || 1),
    prepTime: String(body.prep_time || ''),
    originalPrice: Number(body.original_price || 0) || undefined,
    thumbnail: String(body.thumbnail || ''),
    description: String(body.description || ''),
    features: String(body.features || ''),
    rank: String(body.rank || ''),
    skins: String(body.skins || ''),
    champs: String(body.champs || ''),
    accountDetails: String(body.account_details || ''),
    deliveryMethod: String(body.delivery_method || 'manual'),
    existingImages: parseGameMarketImageRefs(String(body.existing_images || body.images || '')),
    uploadedFiles: [] as File[],
  };
}

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await readPayload(req);
    const action = body.action;
    const itemId = body.itemId;

    if (action === 'pin' || action === 'unpin' || action === 'hide' || action === 'delete') {
      if (!itemId) {
        return NextResponse.json({ success: false, message: 'Thiếu item ID' }, { status: 400 });
      }
      const data = await setGameItemState(userId, itemId, action);
      return NextResponse.json({ success: true, message: 'Đã cập nhật trạng thái bài trao đổi', data });
    }

    if (body.uploadedFiles.length + body.existingImages.length > 3) {
      return NextResponse.json({ success: false, message: 'Mỗi bài đăng chỉ được tối đa 3 ảnh' }, { status: 400 });
    }

    const uploadedImages = await Promise.all(
      body.uploadedFiles.map((file) => saveUploadedFileAsDataUrl({
        file,
        folder: ['game-market', String(userId)],
        prefix: `game_market_${userId}`,
        maxSize: 6 * 1024 * 1024,
      }))
    );
    const imageRefs = [...body.existingImages, ...uploadedImages];

    const data = await createOrUpdateGameItem(userId, {
      itemId: action === 'update' ? itemId : undefined,
      title: body.title,
      category: body.category,
      tag: body.tag,
      badge: body.badge,
      badgeColor: body.badgeColor,
      price: body.price,
      stock: body.stock,
      prepTime: body.prepTime,
      originalPrice: body.originalPrice,
      thumbnail: imageRefs[0] || body.thumbnail || '',
      description: body.description,
      images: imageRefs.join('\n'),
      features: body.features,
      rank: body.rank,
      skins: body.skins,
      champs: body.champs,
      accountDetails: body.accountDetails,
      deliveryMethod: body.deliveryMethod,
    });

    return NextResponse.json({
      success: true,
      message: action === 'update'
        ? 'Đã cập nhật bài trao đổi và hiển thị công khai'
        : 'Đã tạo bài trao đổi mới. Hệ thống đã tự cộng 100.000đ tiền sàn vào giá hiển thị.',
      data,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Không thể xử lý bài trao đổi game' },
      { status: 400 }
    );
  }
}
