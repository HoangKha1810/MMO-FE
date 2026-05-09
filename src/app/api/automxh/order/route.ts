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

type UploadFileLike = {
  name: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

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

function getSafeExtension(file: UploadFileLike) {
  const ext = path.extname(file.name || '').replace('.', '').toLowerCase();
  return ext.replace(/[^a-z0-9]/g, '');
}

async function saveUploadFile(input: {
  file: UploadFileLike;
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

async function getTableColumns(table: string) {
  const rows = await db.$queryRawUnsafe<Array<{ Field: string }>>(`SHOW COLUMNS FROM \`${table}\``);
  return new Set(rows.map((row) => String(row.Field || '').trim()).filter(Boolean));
}

function addColumnValue(
  columns: Set<string>,
  targetColumns: string[],
  targetValues: unknown[],
  column: string,
  value: unknown
) {
  if (!columns.has(column)) {
    return;
  }

  targetColumns.push(`\`${column}\``);
  targetValues.push(value);
}

async function updateAutomxhOrderColumns(
  orderId: number,
  columns: Set<string>,
  updates: Record<string, unknown>
) {
  const entries = Object.entries(updates).filter(([key]) => columns.has(key));
  if (entries.length === 0) {
    return;
  }

  const assignments = entries.map(([key]) => `\`${key}\` = ?`);
  const values = entries.map(([, value]) => value);
  await db.$executeRawUnsafe(
    `UPDATE automxh_orders SET ${assignments.join(', ')} WHERE id = ?`,
    ...values,
    orderId
  );
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
    const automxhOrderColumns = await getTableColumns('automxh_orders');

    const avatarFileRaw = formData.get('avatar');
    const avatarFile = isUploadFileLike(avatarFileRaw) && avatarFileRaw.size > 0 ? avatarFileRaw : null;
    const additionalFiles = [
      ...formData.getAll('additional_files[]'),
      ...formData.getAll('additional_files'),
    ].filter((file): file is FormDataEntryValue & UploadFileLike => isUploadFileLike(file) && file.size > 0);

    if (avatarFile && !allowAvatar) {
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

      const insertColumns: string[] = [];
      const insertValues: unknown[] = [];
      const now = new Date();
      const fileDeleteAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      addColumnValue(automxhOrderColumns, insertColumns, insertValues, 'user_id', userId);
      addColumnValue(automxhOrderColumns, insertColumns, insertValues, 'category_id', null);
      addColumnValue(automxhOrderColumns, insertColumns, insertValues, 'product_id', productId);
      addColumnValue(automxhOrderColumns, insertColumns, insertValues, 'variant_id', variantId);
      addColumnValue(automxhOrderColumns, insertColumns, insertValues, 'title', variant.product_name || variant.name);
      addColumnValue(automxhOrderColumns, insertColumns, insertValues, 'link', link);
      addColumnValue(automxhOrderColumns, insertColumns, insertValues, 'quantity', Math.max(1, Math.trunc(toNumber(variant.quantity, 1))));
      addColumnValue(automxhOrderColumns, insertColumns, insertValues, 'amount', totalToPay);
      addColumnValue(automxhOrderColumns, insertColumns, insertValues, 'buyer_info', encryptLegacyData(buyerInfo));
      addColumnValue(automxhOrderColumns, insertColumns, insertValues, 'custom_value', encryptLegacyData(customValue));
      addColumnValue(automxhOrderColumns, insertColumns, insertValues, 'status', 'pending');
      addColumnValue(automxhOrderColumns, insertColumns, insertValues, 'created_at', now);
      addColumnValue(automxhOrderColumns, insertColumns, insertValues, 'updated_at', now);
      addColumnValue(automxhOrderColumns, insertColumns, insertValues, 'api_provider_id', apiProviderId);
      addColumnValue(automxhOrderColumns, insertColumns, insertValues, 'api_order_id', '');
      addColumnValue(automxhOrderColumns, insertColumns, insertValues, 'confirm_1', confirm1);
      addColumnValue(automxhOrderColumns, insertColumns, insertValues, 'confirm_2', confirm2);
      addColumnValue(automxhOrderColumns, insertColumns, insertValues, 'price', subtotal);
      addColumnValue(automxhOrderColumns, insertColumns, insertValues, 'cost_price', costPrice);
      addColumnValue(automxhOrderColumns, insertColumns, insertValues, 'file_delete_at', fileDeleteAt);
      addColumnValue(automxhOrderColumns, insertColumns, insertValues, 'secure_token', secureToken);

      if (insertColumns.length === 0) {
        throw new Error('Bảng automxh_orders không có cột hợp lệ để tạo đơn');
      }

      const placeholders = insertColumns.map(() => '?').join(', ');
      await tx.$executeRawUnsafe(
        `INSERT INTO automxh_orders (${insertColumns.join(', ')}) VALUES (${placeholders})`,
        ...insertValues
      );

      const inserted = await tx.$queryRaw<Array<{ id: bigint | number }>>`SELECT LAST_INSERT_ID() AS id`;
      const orderId = Number(inserted[0]?.id || 0);

      let avatarPath: string | null = null;
      const savedAdditionalFiles: Array<{ name: string; path: string }> = [];

      if (avatarFile && allowAvatar) {
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
        const updateEntries: string[] = [];
        const updateValues: unknown[] = [];
        addColumnValue(automxhOrderColumns, updateEntries, updateValues, 'avatar_path', avatarPath);
        addColumnValue(
          automxhOrderColumns,
          updateEntries,
          updateValues,
          'additional_files',
          savedAdditionalFiles.length ? JSON.stringify(savedAdditionalFiles) : null
        );

        if (updateEntries.length > 0) {
          const assignmentSql = updateEntries.map((column) => `${column} = ?`).join(', ');
          await tx.$executeRawUnsafe(
            `UPDATE automxh_orders SET ${assignmentSql} WHERE id = ?`,
            ...updateValues,
            orderId
          );
        }
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

          await updateAutomxhOrderColumns(result.orderId, automxhOrderColumns, {
            api_order_id: providerOrder.orderId,
            status: 'processing',
            api_response: JSON.stringify(providerOrder),
            updated_at: new Date(),
          });
        }
      } catch (providerError) {
        await updateAutomxhOrderColumns(result.orderId, automxhOrderColumns, {
          api_response: JSON.stringify({
            success: false,
            error: providerError instanceof Error ? providerError.message : 'Provider error',
          }),
          updated_at: new Date(),
        });
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
