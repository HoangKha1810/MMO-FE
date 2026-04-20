import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { encryptLegacyData } from '@/lib/legacy-crypto';
import { getLegacySettingsMap, getVatPercent } from '@/lib/legacy-settings';
import { createSmmProviderOrder } from '@/lib/smm-provider';
import { toNumber } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface VariantForOrder {
  id: number;
  product_id: number;
  api_provider_id: number | null;
  api_service_id: string | number | null;
  quantity: number | null;
  name: string;
  price: unknown;
  cost: unknown;
  original_price: unknown;
  allow_avatar: boolean | number | null;
  allow_files: boolean | number | null;
  product_name: string;
  p_api_provider_id: number | null;
  p_api_service_id: string | number | null;
}

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
const imageExtensions = new Set(['jpg', 'jpeg', 'png', 'webp']);
const additionalExtensions = new Set(['jpg', 'jpeg', 'png', 'webp', 'pdf', 'txt', 'csv', 'zip', 'rar']);

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function getSafeExtension(file: File) {
  const ext = path.extname(file.name || '').replace('.', '').toLowerCase();
  return ext.replace(/[^a-z0-9]/g, '');
}

async function saveUploadFile(input: {
  file: File;
  orderId: number;
  subdir: 'avatars' | 'additional_files';
  prefix: string;
  index?: number;
  allowedExtensions: Set<string>;
}) {
  const { file, orderId, subdir, prefix, index, allowedExtensions } = input;
  const ext = getSafeExtension(file);

  if (!ext || !allowedExtensions.has(ext)) {
    throw new Error('Tệp tải lên không hợp lệ');
  }

  if (file.size > MAX_UPLOAD_SIZE) {
    throw new Error('Tệp tải lên quá lớn. Giới hạn tối đa 10MB.');
  }

  const filename = `${prefix}${typeof index === 'number' ? `_${index}` : ''}_${Date.now()}_${randomBytes(4).toString('hex')}.${ext}`;
  const relativeDir = path.posix.join('uploads', 'orders', 'original', String(orderId), subdir);
  const targetDir = path.join(process.cwd(), 'public', relativeDir);
  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(path.join(targetDir, filename), Buffer.from(await file.arrayBuffer()));

  return {
    name: file.name || filename,
    path: `public/${relativeDir}/${filename}`,
  };
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const userId = Number(cookieStore.get('user_id')?.value || 0);

  if (!userId) {
    return NextResponse.json({ success: false, error: 'Vui lòng đăng nhập' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const productId = Math.max(0, Math.trunc(Number(getFormString(formData, 'product_id'))));
    const variantId = Math.max(0, Math.trunc(Number(getFormString(formData, 'variant_id'))));
    const link = getFormString(formData, 'link');
    const buyerInfo = getFormString(formData, 'buyer_info');
    const customValue = getFormString(formData, 'custom_value');
    const confirm1 = getFormString(formData, 'confirm_1') === '1' ? 1 : 0;
    const confirm2 = getFormString(formData, 'confirm_2') === '1' ? 1 : 0;

    if (!productId || !variantId || !link) {
      return NextResponse.json({ success: false, error: 'Vui lòng điền đầy đủ thông tin' }, { status: 400 });
    }

    if (!confirm1) {
      return NextResponse.json({ success: false, error: 'Vui lòng xác nhận điều khoản' }, { status: 400 });
    }

    const variants = await db.$queryRaw<VariantForOrder[]>`
      SELECT
        v.id,
        v.product_id,
        v.api_provider_id,
        v.api_service_id,
        v.quantity,
        v.name,
        v.price,
        v.cost,
        v.original_price,
        v.allow_avatar,
        v.allow_files,
        p.name AS product_name,
        p.api_provider_id AS p_api_provider_id,
        p.api_service_id AS p_api_service_id
      FROM automxh_variants v
      JOIN automxh_products p ON v.product_id = p.id
      WHERE v.id = ${variantId} AND v.product_id = ${productId} AND v.status = 'active' AND p.status = 'active'
      LIMIT 1
    `;
    const variant = variants[0];

    if (!variant) {
      return NextResponse.json(
        { success: false, error: 'Máy chủ không tồn tại hoặc đã bị tắt' },
        { status: 404 }
      );
    }

    const settings = await getLegacySettingsMap();
    const vatPercent = getVatPercent(settings);
    const subtotal = toNumber(variant.price, 0);
    const vatAmount = Math.round((subtotal * vatPercent) / 100);
    const totalToPay = Math.round(subtotal + vatAmount);
    const costPrice = toNumber(variant.cost, 0) || toNumber(variant.original_price, 0);
    const apiProviderId = Math.max(0, Math.trunc(toNumber(variant.api_provider_id || variant.p_api_provider_id, 0)));
    const apiServiceId = variant.api_service_id || variant.p_api_service_id || '';
    const secureToken = randomBytes(16).toString('hex');
    const allowAvatar = variant.allow_avatar === true || toNumber(variant.allow_avatar, 0) === 1;
    const allowFiles = variant.allow_files === true || toNumber(variant.allow_files, 0) === 1;

    const avatarFile = formData.get('avatar');
    const additionalFiles = [
      ...formData.getAll('additional_files[]'),
      ...formData.getAll('additional_files'),
    ].filter((file): file is File => file instanceof File && file.size > 0);

    if (avatarFile instanceof File && avatarFile.size > 0 && !allowAvatar) {
      return NextResponse.json({ success: false, error: 'Gói này không hỗ trợ avatar' }, { status: 400 });
    }

    if (additionalFiles.length > 0 && !allowFiles) {
      return NextResponse.json({ success: false, error: 'Gói này không hỗ trợ tệp đính kèm' }, { status: 400 });
    }

    const result = await db.$transaction(async (tx) => {
      const updated = await tx.users.updateMany({
        where: {
          id: userId,
          balance: {
            gte: totalToPay,
          },
        },
        data: {
          balance: {
            decrement: totalToPay,
          },
        },
      });

      if (updated.count === 0) {
        throw new Error('Số dư không đủ');
      }

      const updatedUser = await tx.users.findUnique({
        where: { id: userId },
        select: { balance: true },
      });
      const newBalance = toNumber(updatedUser?.balance, 0);

      await tx.$executeRaw`
        INSERT INTO automxh_orders
          (user_id, product_id, variant_id, api_provider_id, api_order_id, link, buyer_info, custom_value, confirm_1, confirm_2, price, cost_price, status, file_delete_at, secure_token)
        VALUES
          (${userId}, ${productId}, ${variantId}, ${apiProviderId}, '', ${link}, ${encryptLegacyData(buyerInfo)}, ${encryptLegacyData(customValue)}, ${confirm1}, ${confirm2}, ${subtotal}, ${costPrice}, 'pending', DATE_ADD(NOW(), INTERVAL 7 DAY), ${secureToken})
      `;

      const inserted = await tx.$queryRaw<Array<{ id: bigint | number }>>`SELECT LAST_INSERT_ID() AS id`;
      const orderId = Number(inserted[0]?.id || 0);

      let avatarPath: string | null = null;
      const savedAdditionalFiles: Array<{ name: string; path: string }> = [];

      if (avatarFile instanceof File && avatarFile.size > 0 && allowAvatar) {
        const saved = await saveUploadFile({
          file: avatarFile,
          orderId,
          subdir: 'avatars',
          prefix: 'avatar',
          allowedExtensions: imageExtensions,
        });
        avatarPath = saved.path;
      }

      if (allowFiles) {
        for (let index = 0; index < additionalFiles.length; index += 1) {
          const saved = await saveUploadFile({
            file: additionalFiles[index],
            orderId,
            subdir: 'additional_files',
            prefix: 'file',
            index,
            allowedExtensions: additionalExtensions,
          });
          savedAdditionalFiles.push(saved);
        }
      }

      if (avatarPath || savedAdditionalFiles.length > 0) {
        await tx.$executeRaw`
          UPDATE automxh_orders
          SET avatar_path = ${avatarPath}, additional_files = ${savedAdditionalFiles.length ? JSON.stringify(savedAdditionalFiles) : null}
          WHERE id = ${orderId}
        `;
      }

      await tx.transactions.create({
        data: {
          user_id: userId,
          type: 'order',
          amount: -totalToPay,
          balance_after: newBalance,
          content: `Thanh toán đơn hàng Auto MXH #${orderId}`,
          status: 'success',
        },
      });

      return { orderId, newBalance };
    });

    if (apiProviderId > 0 && apiServiceId) {
      try {
        const serviceId = Math.max(0, Math.trunc(Number(apiServiceId)));
        if (serviceId > 0) {
          const providerOrder = await createSmmProviderOrder({
            providerId: apiProviderId,
            serviceId,
            link,
            quantity: Math.max(1, Math.trunc(toNumber(variant.quantity, 1))),
          });

          await db.$executeRaw`
            UPDATE automxh_orders
            SET api_order_id = ${providerOrder.orderId}, status = 'processing', api_response = ${JSON.stringify(providerOrder)}
            WHERE id = ${result.orderId}
          `;
        }
      } catch (providerError) {
        await db.$executeRaw`
          UPDATE automxh_orders
          SET api_response = ${JSON.stringify({
            success: false,
            error: providerError instanceof Error ? providerError.message : 'Provider error',
          })}
          WHERE id = ${result.orderId}
        `;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        id: result.orderId,
        subtotal,
        vat_amount: vatAmount,
        total_to_pay: totalToPay,
        product_name: variant.product_name,
        variant_name: variant.name,
      },
      new_balance: result.newBalance,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Có lỗi xảy ra, vui lòng thử lại sau';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
