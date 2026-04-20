import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import {
  createSmmProviderOrder,
  findSmmService,
  getSmmCheckoutAmount,
} from '@/lib/smm-provider';
import { toNumber } from '@/lib/utils';

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const userId = Number(cookieStore.get('user_id')?.value || 0);

  if (!userId) {
    return NextResponse.json({ success: false, message: 'Vui lòng đăng nhập để đặt đơn' }, { status: 401 });
  }

  try {
    const { service_id, provider_id, quantity, link, comments, reaction } = await req.json();
    const serviceId = Math.max(0, Math.trunc(toNumber(service_id, 0)));
    const providerId = provider_id === undefined || provider_id === null ? undefined : Math.max(0, Math.trunc(toNumber(provider_id, 0)));
    let serviceQty = Math.max(0, Math.trunc(toNumber(quantity, 0)));
    const sanitizedLink = String(link || '').trim();
    const sanitizedComments = String(comments || '').trim();
    const sanitizedReaction = String(reaction || '').trim();

    if (!serviceId || !serviceQty || !sanitizedLink) {
      return NextResponse.json({ success: false, message: 'Thiếu thông tin đơn hàng' }, { status: 400 });
    }

    const [user, service] = await Promise.all([
      db.users.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          balance: true,
        },
      }),
      findSmmService(serviceId, providerId),
    ]);

    if (!user) {
      return NextResponse.json({ success: false, message: 'Không tìm thấy tài khoản' }, { status: 404 });
    }

    if (!service) {
      return NextResponse.json({ success: false, message: 'Không tìm thấy dịch vụ SMM' }, { status: 404 });
    }

    if (service.is_comment_service) {
      const commentLines = sanitizedComments
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      if (commentLines.length === 0) {
        return NextResponse.json(
          { success: false, message: 'Dịch vụ này yêu cầu danh sách bình luận' },
          { status: 400 }
        );
      }

      serviceQty = commentLines.length;
    }

    if (serviceQty < service.min || serviceQty > service.max) {
      return NextResponse.json(
        {
          success: false,
          message: `Số lượng không hợp lệ. Min ${service.min.toLocaleString()} - Max ${service.max.toLocaleString()}`,
        },
        { status: 400 }
      );
    }

    const checkout = await getSmmCheckoutAmount(service, serviceQty);
    const currentBalance = toNumber(user.balance, 0);

    if (currentBalance < checkout.totalToPay) {
      return NextResponse.json(
        { success: false, message: 'Số dư không đủ. Vui lòng nạp thêm tiền' },
        { status: 400 }
      );
    }

    const provisionalOrder = await db.$transaction(async (tx) => {
      const updated = await tx.users.updateMany({
        where: {
          id: userId,
          balance: {
            gte: checkout.totalToPay,
          },
        },
        data: {
          balance: {
            decrement: checkout.totalToPay,
          },
        },
      });

      if (updated.count === 0) {
        throw new Error('Giao dịch thất bại. Vui lòng kiểm tra lại số dư.');
      }

      const updatedUser = await tx.users.findUnique({
        where: { id: userId },
        select: { balance: true },
      });

      const order = await tx.smm_orders.create({
        data: {
          user_id: userId,
          provider_id: service.provider_id,
          api_order_id: '',
          service_id: service.service,
          service_name: service.name,
          link: sanitizedLink,
          custom_data: sanitizedComments || null,
          quantity: serviceQty,
          price: checkout.subtotal,
          status: 'Processing',
        },
      });

      return {
        orderId: order.id,
        newBalance: toNumber(updatedUser?.balance, currentBalance - checkout.totalToPay),
      };
    });

    try {
      const providerOrder = await createSmmProviderOrder({
        providerId: service.provider_id,
        serviceId: service.service,
        quantity: serviceQty,
        link: sanitizedLink,
        comments: service.is_comment_service ? sanitizedComments : undefined,
        reaction: sanitizedReaction || undefined,
      });

      const savedOrder = await db.$transaction(async (tx) => {
        await tx.smm_orders.update({
          where: { id: provisionalOrder.orderId },
          data: {
            api_order_id: providerOrder.orderId,
            status: 'Pending',
            balance_after: provisionalOrder.newBalance,
          },
        });

        await tx.transactions.create({
          data: {
            user_id: userId,
            type: 'order',
            amount: -checkout.totalToPay,
            balance_after: provisionalOrder.newBalance,
            content: `Thanh toán đơn SMM #${providerOrder.orderId} - ${service.name}`,
            status: 'success',
          },
        });

        return tx.smm_orders.findUnique({
          where: { id: provisionalOrder.orderId },
        });
      });

      return NextResponse.json({
        success: true,
        message: 'Đơn SMM đã được tạo từ provider thật',
        data: {
          id: savedOrder?.id || provisionalOrder.orderId,
          api_order_id: providerOrder.orderId,
          subtotal: checkout.subtotal,
          vat_amount: checkout.vatAmount,
          total_to_pay: checkout.totalToPay,
          quantity: serviceQty,
          service_name: service.name,
          provider_id: service.provider_id,
        },
        new_balance: provisionalOrder.newBalance,
      });
    } catch (providerError) {
      const revertedBalance = await db.$transaction(async (tx) => {
        await tx.users.update({
          where: { id: userId },
          data: {
            balance: {
              increment: checkout.totalToPay,
            },
          },
        });

        const refundedUser = await tx.users.findUnique({
          where: { id: userId },
          select: { balance: true },
        });

        const reason =
          providerError instanceof Error ? providerError.message : 'Provider từ chối tạo đơn';

        await tx.smm_orders.update({
          where: { id: provisionalOrder.orderId },
          data: {
            status: 'Cancelled',
            reason,
            is_refunded: true,
            refund_amount: checkout.totalToPay,
          },
        });

        await tx.transactions.create({
          data: {
            user_id: userId,
            type: 'refund',
            amount: checkout.totalToPay,
            balance_after: toNumber(refundedUser?.balance, currentBalance),
            content: `Hoàn tiền đơn SMM lỗi: ${reason}`,
            status: 'success',
          },
        });

        return toNumber(refundedUser?.balance, currentBalance);
      });

      const message =
        providerError instanceof Error ? providerError.message : 'Provider từ chối tạo đơn';

      return NextResponse.json(
        {
          success: false,
          message,
          new_balance: revertedBalance,
        },
        { status: 502 }
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể tạo đơn SMM';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
