"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import {
  ArrowDownLeft,
  BanknoteArrowDown,
  Landmark,
  PlusCircle,
  ReceiptText,
  RefreshCw,
  Search,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { PortalAuthFallback, PortalShell } from "@vps/components/portal/portal-shell";
import { GlowCard } from "@vps/components/ui/glow-card";
import { usePortalSnapshot } from "@vps/hooks/use-portal-snapshot";
import { formatCurrency } from "@vps/lib/api";
import { formatDateTime, formatTransactionType } from "@vps/lib/portal";
import { UserTransaction } from "@vps/lib/types";

const TX_TYPE_META: Record<
  string,
  { color: string; bg: string; icon: typeof ArrowDownLeft }
> = {
  deposit: {
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
    icon: BanknoteArrowDown,
  },
  order: {
    color: "text-red-400",
    bg: "bg-red-400/10",
    icon: ShoppingCart,
  },
  refund: {
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    icon: RefreshCw,
  },
  renew: {
    color: "text-orange-400",
    bg: "bg-orange-400/10",
    icon: Truck,
  },
  adjustment: {
    color: "text-sky-400",
    bg: "bg-sky-400/10",
    icon: PlusCircle,
  },
};

function getTxTypeMeta(type: string | null | undefined) {
  const key = String(type ?? "").toLowerCase();
  return (
    TX_TYPE_META[key] ?? {
      color: "text-slate-400",
      bg: "bg-slate-400/10",
      icon: Landmark,
    }
  );
}

function getTxStatusTone(status: string | null | undefined) {
  const key = String(status ?? "").toLowerCase();

  if (/(success|done|completed)/i.test(key)) {
    return "portal-tone-positive";
  }

  if (/(pending|processing|queue)/i.test(key)) {
    return "portal-tone-warning";
  }

  if (/(failed|cancel|error|reject)/i.test(key)) {
    return "portal-tone-negative";
  }

  return "portal-tone-neutral";
}

function formatTxStatus(status: string | null | undefined) {
  const key = String(status ?? "").trim().toLowerCase();

  if (!key) {
    return "Đang xử lý";
  }

  if (/(success|done|completed)/i.test(key)) {
    return "Thành công";
  }

  if (/(pending|processing|queue)/i.test(key)) {
    return "Đang xử lý";
  }

  if (/(failed|cancel|error|reject)/i.test(key)) {
    return "Thất bại";
  }

  return key.charAt(0).toUpperCase() + key.slice(1);
}

export default function PaymentsPage() {
  const { session, user, orders, loading } = usePortalSnapshot();
  const currentUser = user ?? session?.user ?? null;
  const [searchQuery, setSearchQuery] = useState("");

  const allTransactions = useMemo(() => orders?.transactions ?? [], [orders]);
  const summary = orders?.summary;
  const totalDeposited = summary?.total_deposited ?? 0;
  const totalSpent = summary?.total_spent ?? 0;

  const filteredTransactions = useMemo<UserTransaction[]>(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return allTransactions;
    }

    return allTransactions.filter((tx) => {
      const typeLabel = formatTransactionType(tx.type).toLowerCase();
      return [tx.content ?? "", typeLabel, tx.type ?? "", String(Math.abs(tx.amount))]
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [allTransactions, searchQuery]);

  if (!currentUser) {
    return <PortalAuthFallback />;
  }

  return (
    <PortalShell
      user={currentUser}
      pageTitle="Lịch sử thanh toán"
      breadcrumb="Lịch sử thanh toán"
      pageDescription="Theo dõi toàn bộ biến động số dư tài khoản, các khoản nạp tiền và chi tiêu."
      notificationCount={summary?.notifications ?? 0}
    >
      <section className="grid gap-4 xl:grid-cols-3">
        <GlowCard>
          <div className="portal-stat-card">
            <span className="portal-stat-dot portal-stat-dot-positive" />
            <div className="min-w-0 flex-1">
              <p className="portal-info-label">Tổng đã nạp</p>
              <div className="portal-stat-number">
                <span className="text-2xl font-bold tabular-nums text-emerald-400">
                  {loading ? "—" : formatCurrency(totalDeposited)}
                </span>
              </div>
            </div>
            <BanknoteArrowDown className="h-8 w-8 flex-shrink-0 text-emerald-400/60" />
          </div>
        </GlowCard>

        <GlowCard>
          <div className="portal-stat-card">
            <span className="portal-stat-dot portal-stat-dot-negative" />
            <div className="min-w-0 flex-1">
              <p className="portal-info-label">Tổng đã chi</p>
              <div className="portal-stat-number">
                <span className="text-2xl font-bold tabular-nums text-red-400">
                  {loading ? "—" : formatCurrency(totalSpent)}
                </span>
              </div>
            </div>
            <ShoppingCart className="h-8 w-8 flex-shrink-0 text-red-400/60" />
          </div>
        </GlowCard>

        <GlowCard>
          <div className="portal-stat-card">
            <span className="portal-stat-dot portal-stat-dot-neutral" />
            <div className="min-w-0 flex-1">
              <p className="portal-info-label">Số dư hiện tại</p>
              <div className="portal-stat-number">
                <span className="text-2xl font-bold tabular-nums text-[var(--foreground)]">
                  {formatCurrency(currentUser.balance)}
                </span>
              </div>
            </div>
            <Landmark className="h-8 w-8 flex-shrink-0 text-[var(--muted)]" />
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
                placeholder="Tìm theo nạp tiền / mua VPS / hoàn tiền"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full bg-transparent text-sm outline-none"
              />
            </label>

            <div className="portal-count-badge">
              <span>Giao dịch</span>
              <strong>{loading ? "—" : filteredTransactions.length}</strong>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-16 animate-pulse rounded-2xl bg-white/[0.03]" />
              ))}
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="portal-empty-card">
              <ReceiptText className="h-10 w-10 text-[var(--brand-solid)]" />
              <p className="mt-4 text-lg font-semibold text-[var(--foreground)]">
                {searchQuery ? "Không tìm thấy giao dịch nào" : "Chưa có giao dịch nào"}
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                {searchQuery
                  ? "Thử tìm với từ khóa khác hoặc xóa bộ lọc."
                  : "Các giao dịch nạp tiền, mua VPS và hoàn tiền sẽ hiển thị tại đây."}
              </p>
            </div>
          ) : (
            <div className="portal-table-shell">
              <table>
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Loại giao dịch</th>
                    <th>Nội dung</th>
                    <th>Biến động</th>
                    <th>Trạng thái</th>
                    <th>Số dư sau giao dịch</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((tx) => {
                    const typeMeta = getTxTypeMeta(tx.type);
                    const TypeIcon = typeMeta.icon;
                    const isPositive = tx.amount > 0;
                    const isNegative = tx.amount < 0;

                    return (
                      <tr key={tx.id}>
                        <td>{formatDateTime(tx.created_at)}</td>
                        <td>
                          <div className="flex min-w-[11rem] items-center gap-3">
                            <span
                              className={clsx(
                                "flex h-10 w-10 items-center justify-center rounded-xl",
                                typeMeta.bg,
                              )}
                            >
                              <TypeIcon className={clsx("h-4 w-4", typeMeta.color)} />
                            </span>
                            <div>
                              <p className={clsx("font-semibold", typeMeta.color)}>
                                {formatTransactionType(tx.type)}
                              </p>
                              <p className="text-xs text-[var(--muted)]">
                                {tx.type ? tx.type.toUpperCase() : "OTHER"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="min-w-[16rem]">
                            <p className="text-sm leading-7 text-[var(--foreground)]">
                              {tx.content || "Không có mô tả"}
                            </p>
                          </div>
                        </td>
                        <td>
                          <span
                            className={clsx(
                              "font-semibold tabular-nums",
                              isPositive && "text-emerald-400",
                              isNegative && "text-red-400",
                              !isPositive && !isNegative && "text-[var(--muted)]",
                            )}
                          >
                            {isPositive ? "+" : ""}
                            {formatCurrency(tx.amount)}
                          </span>
                        </td>
                        <td>
                          <span className={`portal-status-chip ${getTxStatusTone(tx.status)}`}>
                            {formatTxStatus(tx.status)}
                          </span>
                        </td>
                        <td>
                          <span className="font-semibold tabular-nums text-[var(--foreground)]">
                            {tx.balance_after !== null ? formatCurrency(tx.balance_after) : "—"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </GlowCard>
    </PortalShell>
  );
}
