"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock3, ReceiptText, Search, ShoppingCart } from "lucide-react";
import { PortalAuthFallback, PortalShell } from "@vps/components/portal/portal-shell";
import { GlowCard } from "@vps/components/ui/glow-card";
import { ConfirmModal } from "@vps/components/ui/confirm-modal";
import { NoticeModal } from "@vps/components/ui/notice-modal";
import { usePortalSnapshot } from "@vps/hooks/use-portal-snapshot";
import { formatCurrency, requestRefund } from "@vps/lib/api";
import {
  formatBillingCycle,
  formatDateTime,
  formatOrderStatus,
  resolveStatusTone,
} from "@vps/lib/portal";
import { MyOrder } from "@vps/lib/types";

function getToneClassName(tone: string) {
  if (tone === "positive") {
    return "portal-tone-positive";
  }

  if (tone === "warning") {
    return "portal-tone-warning";
  }

  if (tone === "negative") {
    return "portal-tone-negative";
  }

  return "portal-tone-neutral";
}

function canRequestRefund(order: MyOrder) {
  return (
    /^(active|success)$/i.test(order.status) &&
    !order.refund_requested_at &&
    !order.refund_amount
  );
}

export default function OrdersPage() {
  const { session, user, orders, loading, refresh } = usePortalSnapshot();
  const currentUser = user ?? session?.user ?? null;
  const [searchQuery, setSearchQuery] = useState("");
  const [refundOrder, setRefundOrder] = useState<MyOrder | null>(null);
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundFeedback, setRefundFeedback] = useState<{
    title: string;
    message: string;
    variant: "success" | "warning" | "info";
    highlights: string[];
  } | null>(null);

  const allOrders = useMemo(() => orders?.orders ?? [], [orders]);
  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return allOrders;
    }

    return allOrders.filter((order) =>
      [order.order_code, order.title, order.buyer_note ?? "", order.failure_reason ?? ""].some(
        (value) => String(value).toLowerCase().includes(query),
      ),
    );
  }, [allOrders, searchQuery]);
  const pendingOrders = useMemo(
    () => allOrders.filter((order) => resolveStatusTone(order.status) === "warning").length,
    [allOrders],
  );
  const completedOrders = useMemo(
    () => allOrders.filter((order) => resolveStatusTone(order.status) === "positive").length,
    [allOrders],
  );
  const totalOrders = orders?.summary?.total_orders ?? allOrders.length;

  async function handleRefundConfirm() {
    const token = session?.token;

    if (!token || !refundOrder) {
      return;
    }

    setRefundLoading(true);

    try {
      const result = await requestRefund(token, refundOrder.id);
      setRefundFeedback({
        title: "Yêu cầu hoàn tiền đã được ghi nhận",
        message: result.message,
        variant: "success",
        highlights: [
          "Nếu đơn đủ điều kiện, số dư sẽ được cập nhật lại trong lịch sử thanh toán sau khi hệ thống xử lý.",
          `Số tiền đơn hàng: ${formatCurrency(refundOrder.total_price)}.`,
        ],
      });
      setRefundOrder(null);
      await refresh();
    } catch (error) {
      setRefundFeedback({
        title: "Yêu cầu hoàn tiền chưa thành công",
        message:
          error instanceof Error ? error.message : "Không thể xử lý yêu cầu hoàn tiền.",
        variant: "warning",
        highlights: [
          "Anh có thể thử lại sau hoặc liên hệ hỗ trợ nếu đơn hàng vẫn còn trong điều kiện hoàn tiền.",
        ],
      });
    } finally {
      setRefundLoading(false);
    }
  }

  if (!currentUser) {
    return <PortalAuthFallback />;
  }

  return (
    <PortalShell
      user={currentUser}
      pageTitle="Danh sách đơn hàng"
      breadcrumb="Danh sách đơn hàng"
      pageDescription="Theo dõi toàn bộ đơn hàng VPS đã mua, trạng thái xử lý và ghi chú của từng đơn."
      notificationCount={orders?.summary.notifications ?? 0}
    >
      <section className="grid gap-4 xl:grid-cols-3">
        <GlowCard>
          <div className="portal-stat-card">
            <span className="portal-stat-dot portal-stat-dot-neutral" />
            <div className="min-w-0 flex-1">
              <p className="portal-info-label">Tổng đơn hàng</p>
              <div className="portal-stat-number">
                <span className="text-3xl font-bold tabular-nums text-[var(--foreground)]">
                  {loading ? "—" : totalOrders}
                </span>
              </div>
            </div>
            <ReceiptText className="h-8 w-8 flex-shrink-0 text-[var(--muted)]" />
          </div>
        </GlowCard>

        <GlowCard>
          <div className="portal-stat-card">
            <span className="portal-stat-dot portal-stat-dot-warning" />
            <div className="min-w-0 flex-1">
              <p className="portal-info-label">Đơn đang xử lý</p>
              <div className="portal-stat-number">
                <span className="text-3xl font-bold tabular-nums text-amber-400">
                  {loading ? "—" : pendingOrders}
                </span>
              </div>
            </div>
            <Clock3 className="h-8 w-8 flex-shrink-0 text-amber-400/60" />
          </div>
        </GlowCard>

        <GlowCard>
          <div className="portal-stat-card">
            <span className="portal-stat-dot portal-stat-dot-positive" />
            <div className="min-w-0 flex-1">
              <p className="portal-info-label">Đơn hoàn tất</p>
              <div className="portal-stat-number">
                <span className="text-3xl font-bold tabular-nums text-emerald-400">
                  {loading ? "—" : completedOrders}
                </span>
              </div>
            </div>
            <CheckCircle2 className="h-8 w-8 flex-shrink-0 text-emerald-400/60" />
          </div>
        </GlowCard>
      </section>

      <GlowCard>
        <div className="portal-card">
          <div className="portal-filterbar">
            <label className="portal-search lg:max-w-md">
              <Search className="h-4 w-4 text-[var(--muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Tìm theo mã đơn / gói / ghi chú"
                className="w-full bg-transparent text-sm outline-none"
              />
            </label>

            <div className="portal-count-badge">
              <span>Hiển thị</span>
              <strong>{loading ? "—" : filteredOrders.length}</strong>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-18 animate-pulse rounded-2xl bg-white/[0.03]" />
              ))}
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="portal-empty-card">
              <ShoppingCart className="h-10 w-10 text-[var(--brand-solid)]" />
              <p className="mt-4 text-lg font-semibold text-[var(--foreground)]">
                {searchQuery ? "Không tìm thấy đơn hàng nào" : "Chưa có đơn hàng nào"}
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                {searchQuery
                  ? "Thử tìm với từ khóa khác hoặc xóa bộ lọc."
                  : "Hãy mua VPS trong khu dịch vụ để đơn hàng hiển thị tại đây."}
              </p>
              {!searchQuery ? (
                <Link href="/vps/dashboard/services" className="action-button mt-4">
                  Mua VPS ngay
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="portal-table-shell">
              <table>
                <thead>
                  <tr>
                    <th>Mã đơn</th>
                    <th>Gói dịch vụ</th>
                    <th>Ghi chú / lỗi</th>
                    <th>Số lượng</th>
                    <th>Chu kỳ</th>
                    <th>Tổng tiền</th>
                    <th>Ngày tạo</th>
                    <th>Trạng thái</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <span className="portal-code">{order.order_code}</span>
                      </td>
                      <td>
                        <div className="min-w-[12rem]">
                          <p className="font-semibold text-[var(--foreground)]">{order.title}</p>
                        </div>
                      </td>
                      <td>
                        <div className="space-y-1 text-sm leading-7 text-[var(--muted)]">
                          <p>{order.buyer_note || "Không có ghi chú"}</p>
                          {order.failure_reason ? (
                            <p className="text-xs leading-6 text-red-400">{order.failure_reason}</p>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <span className="portal-badge">{order.quantity}</span>
                      </td>
                      <td>{formatBillingCycle(order.billing_cycle_code)}</td>
                      <td>
                        <span className="font-semibold tabular-nums text-[var(--foreground)]">
                          {formatCurrency(order.total_price)}
                        </span>
                      </td>
                      <td>{formatDateTime(order.created_at)}</td>
                      <td>
                        <div className="flex flex-col gap-1">
                          <span
                            className={`portal-status-chip ${getToneClassName(
                              resolveStatusTone(order.status),
                            )}`}
                          >
                            {formatOrderStatus(order.status)}
                          </span>
                          {order.refund_amount ? (
                            <span className="text-xs leading-6 text-cyan-400">
                              Hoàn tiền: {formatCurrency(order.refund_amount)}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        {canRequestRefund(order) ? (
                          <button
                            type="button"
                            className="portal-mini-button"
                            onClick={() => setRefundOrder(order)}
                          >
                            Yêu cầu hoàn tiền
                          </button>
                        ) : (
                          <span className="text-xs text-[var(--muted)]">
                            {order.refund_requested_at
                              ? "Đã gửi yêu cầu"
                              : order.refund_amount
                                ? "Đã hoàn tiền"
                                : "Không có thao tác"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </GlowCard>

      <ConfirmModal
        open={Boolean(refundOrder)}
        title="Xác nhận yêu cầu hoàn tiền"
        message={
          refundOrder
            ? `Bạn có chắc muốn gửi yêu cầu hoàn tiền cho đơn ${refundOrder.order_code} với số tiền ${formatCurrency(refundOrder.total_price)} không?`
            : ""
        }
        confirmLabel="Gửi yêu cầu"
        variant="warning"
        highlights={
          refundOrder
            ? [
                "Hệ thống sẽ kiểm tra điều kiện hoàn tiền theo chính sách dịch vụ VPS.",
                "Nếu được duyệt, biến động số dư sẽ xuất hiện trong lịch sử thanh toán.",
              ]
            : []
        }
        loading={refundLoading}
        onClose={() => setRefundOrder(null)}
        onConfirm={handleRefundConfirm}
      />

      <NoticeModal
        open={Boolean(refundFeedback)}
        title={refundFeedback?.title ?? ""}
        message={refundFeedback?.message ?? ""}
        variant={refundFeedback?.variant ?? "info"}
        highlights={refundFeedback?.highlights ?? []}
        onClose={() => setRefundFeedback(null)}
      />
    </PortalShell>
  );
}
