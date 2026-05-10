"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  CheckSquare,
  Copy,
  Filter,
  Info,
  Power,
  PowerOff,
  RefreshCw,
  ServerCog,
  Square,
} from "lucide-react";
import { PortalAuthFallback, PortalShell } from "@vps/components/portal/portal-shell";
import { GlowCard } from "@vps/components/ui/glow-card";
import { ConfirmModal } from "@vps/components/ui/confirm-modal";
import { NoticeModal } from "@vps/components/ui/notice-modal";
import { RebuildOsModal } from "@vps/components/vps/rebuild-os-modal";
import { usePortalSnapshot } from "@vps/hooks/use-portal-snapshot";
import {
  isProblemInstanceStatus,
  isProcessingInstanceStatus,
  isRebuildingInstanceStatus,
  isRunningInstanceStatus,
  isStoppedInstanceStatus,
} from "@vps/lib/instance-status";
import { getUserOperatingSystems, runInstanceAction } from "@vps/lib/api";
import {
  describeInstanceStatus,
  formatBillingCycle,
  formatDateOnly,
  formatInstanceStatus,
  resolveStatusTone,
} from "@vps/lib/portal";
import { MyInstance, RemoteOs } from "@vps/lib/types";

type InstanceAction = "on" | "off" | "restart";

type ActionFeedback = {
  title: string;
  message: string;
  variant: "info" | "success" | "warning";
  highlights: string[];
};

const STATUS_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "Tất cả" },
  { value: "running", label: "Đang chạy" },
  { value: "stopped", label: "Đã tắt" },
  { value: "processing", label: "Đang xử lý" },
  { value: "problem", label: "Có vấn đề" },
];

const ACTION_META: Record<
  InstanceAction,
  {
    buttonLabel: string;
    confirmTitle: string;
    confirmLabel: string;
    confirmVariant: "info" | "warning";
    acceptedTitle: string;
    queuedHint: string;
  }
> = {
  on: {
    buttonLabel: "Bật VPS",
    confirmTitle: "Xác nhận bật VPS",
    confirmLabel: "Gửi lệnh bật",
    confirmVariant: "info",
    acceptedTitle: "Đã ghi nhận lệnh bật VPS",
    queuedHint: "VPS sẽ chuyển dần sang trạng thái đang chạy sau khi nhà cung cấp xử lý xong.",
  },
  off: {
    buttonLabel: "Tắt VPS",
    confirmTitle: "Xác nhận tắt VPS",
    confirmLabel: "Gửi lệnh tắt",
    confirmVariant: "warning",
    acceptedTitle: "Đã ghi nhận lệnh tắt VPS",
    queuedHint: "Kết nối hiện tại có thể ngắt trong lúc hệ thống tắt máy chủ ở phía nhà cung cấp.",
  },
  restart: {
    buttonLabel: "Khởi động lại",
    confirmTitle: "Xác nhận khởi động lại VPS",
    confirmLabel: "Gửi lệnh reboot",
    confirmVariant: "info",
    acceptedTitle: "Đã ghi nhận lệnh khởi động lại",
    queuedHint: "VPS sẽ reboot lại trong thời gian ngắn và dashboard sẽ tự đồng bộ trạng thái mới.",
  },
};

const MANUAL_ACTIONS: InstanceAction[] = ["on", "off", "restart"];

function getToneClassName(status: string | null | undefined) {
  const tone = resolveStatusTone(status);

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

function getAvailableActions(status: string | null | undefined): InstanceAction[] {
  if (isStoppedInstanceStatus(status)) {
    return ["on"];
  }

  if (isRunningInstanceStatus(status)) {
    return ["off", "restart"];
  }

  return [];
}

function canRunAction(status: string | null | undefined, action: InstanceAction) {
  return getAvailableActions(status).includes(action);
}

function getActionRequirement(action: InstanceAction) {
  if (action === "on") {
    return "Lệnh bật chỉ áp dụng cho VPS đang ở trạng thái đã tắt.";
  }

  if (action === "off") {
    return "Lệnh tắt chỉ áp dụng cho VPS đang ở trạng thái đang chạy.";
  }

  return "Lệnh khởi động lại chỉ áp dụng cho VPS đang ở trạng thái đang chạy.";
}

function summarizeStatuses(instances: MyInstance[]) {
  const groups = new Map<string, number>();

  for (const instance of instances) {
    const label = formatInstanceStatus(instance.status);
    groups.set(label, (groups.get(label) ?? 0) + 1);
  }

  return Array.from(groups.entries()).map(([label, count]) => `${count} VPS đang ở trạng thái ${label}.`);
}

function filterByGroup(instances: MyInstance[], group: string) {
  switch (group) {
    case "running":
      return instances.filter((instance) => isRunningInstanceStatus(instance.status));
    case "stopped":
      return instances.filter((instance) => isStoppedInstanceStatus(instance.status));
    case "processing":
      return instances.filter((instance) => isProcessingInstanceStatus(instance.status));
    case "problem":
      return instances.filter((instance) => isProblemInstanceStatus(instance.status));
    default:
      return instances;
  }
}

function copyToClipboard(text: string | null | undefined) {
  if (!text || typeof window === "undefined") {
    return;
  }

  navigator.clipboard.writeText(text).catch(() => {
    // no-op
  });
}

export default function VpsPage() {
  const { session, user, orders, loading, refresh } = usePortalSnapshot();
  const currentUser = user ?? session?.user ?? null;
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [actionLoading, setActionLoading] = useState(false);
  const [rebuildLoading, setRebuildLoading] = useState(false);
  const [rebuildSystemsLoading, setRebuildSystemsLoading] = useState(false);
  const [availableOperatingSystems, setAvailableOperatingSystems] = useState<RemoteOs[]>([]);
  const [rebuildInstance, setRebuildInstance] = useState<MyInstance | null>(null);
  const [selectedRebuildOsId, setSelectedRebuildOsId] = useState(0);
  const [pendingAction, setPendingAction] = useState<{
    ids: number[];
    action: InstanceAction;
    skippedCount: number;
  } | null>(null);
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);

  const allInstances = useMemo(() => orders?.instances ?? [], [orders]);
  const filteredInstances = useMemo(
    () => filterByGroup(allInstances, statusFilter),
    [allInstances, statusFilter],
  );
  const counts = useMemo(
    () => ({
      all: allInstances.length,
      running: allInstances.filter((instance) => isRunningInstanceStatus(instance.status)).length,
      stopped: allInstances.filter((instance) => isStoppedInstanceStatus(instance.status)).length,
      processing: allInstances.filter((instance) => isProcessingInstanceStatus(instance.status)).length,
      problem: allInstances.filter((instance) => isProblemInstanceStatus(instance.status)).length,
    }),
    [allInstances],
  );
  const selectedInstances = useMemo(
    () => allInstances.filter((instance) => selectedIds.has(instance.id)),
    [allInstances, selectedIds],
  );
  const eligibleSelectedIds = useMemo(
    () => ({
      on: selectedInstances.filter((instance) => canRunAction(instance.status, "on")).map((instance) => instance.id),
      off: selectedInstances
        .filter((instance) => canRunAction(instance.status, "off"))
        .map((instance) => instance.id),
      restart: selectedInstances
        .filter((instance) => canRunAction(instance.status, "restart"))
        .map((instance) => instance.id),
    }),
    [selectedInstances],
  );

  useEffect(() => {
    const visibleIds = new Set(filteredInstances.map((instance) => instance.id));
    setSelectedIds((previous) => new Set(Array.from(previous).filter((id) => visibleIds.has(id))));
  }, [filteredInstances]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!allInstances.some((instance) => isProcessingInstanceStatus(instance.status))) {
      return;
    }

    const intervalMs = allInstances.some((instance) => isRebuildingInstanceStatus(instance.status))
      ? 6000
      : 10000;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }, intervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [allInstances, refresh]);

  const handleSelectAll = useCallback(() => {
    if (!filteredInstances.length) {
      setSelectedIds(new Set());
      return;
    }

    setSelectedIds((previous) => {
      if (previous.size === filteredInstances.length) {
        return new Set();
      }

      return new Set(filteredInstances.map((instance) => instance.id));
    });
  }, [filteredInstances]);

  const handleSelectOne = useCallback((id: number) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }, []);

  const queueAction = useCallback(
    (ids: number[], action: InstanceAction) => {
      if (!ids.length) {
        return;
      }

      const targetInstances = allInstances.filter((instance) => ids.includes(instance.id));
      const eligibleIds = targetInstances
        .filter((instance) => canRunAction(instance.status, action))
        .map((instance) => instance.id);
      const skippedCount = targetInstances.length - eligibleIds.length;

      if (!eligibleIds.length) {
        setFeedback({
          title: "Chưa thể gửi lệnh quản lý VPS",
          message: getActionRequirement(action),
          variant: "warning",
          highlights: [
            `Đã chọn ${targetInstances.length} VPS nhưng chưa có VPS nào ở trạng thái phù hợp để nhận lệnh.`,
            ...summarizeStatuses(targetInstances),
            "Anh hãy bấm đồng bộ lại hoặc chờ nhà cung cấp cập nhật xong rồi thử lại.",
          ],
        });
        return;
      }

      setPendingAction({ ids: eligibleIds, action, skippedCount });
    },
    [allInstances],
  );

  async function performAction(action: InstanceAction, ids: number[]) {
    const token = session?.token;

    if (!token || !ids.length) {
      return;
    }

    setActionLoading(true);
    setPendingAction(null);

    try {
      const results = await Promise.allSettled(
        ids.map((id) => runInstanceAction(token, id, action)),
      );
      const successful = results.filter(
        (
          result,
        ): result is PromiseFulfilledResult<{
          message: string;
        }> => result.status === "fulfilled",
      );
      const failedCount = results.length - successful.length;
      const successCount = successful.length;
      const firstSuccessMessage = successful.find((result) => result.value.message)?.value.message;
      const actionMeta = ACTION_META[action];
      const targetText = ids.length === 1 ? "1 VPS" : `${ids.length} VPS`;
      const targetInstances = allInstances.filter((instance) => ids.includes(instance.id));

      if (successCount > 0) {
        setFeedback({
          title: actionMeta.acceptedTitle,
          message: `Hệ thống đã ghi nhận ${successCount}/${ids.length} lệnh cho ${targetText}.`,
          variant: failedCount > 0 ? "warning" : "success",
          highlights: [
            "Lệnh đã vào hàng đợi xử lý. Nếu popup này đã báo ghi nhận thì anh không cần bấm lại nhiều lần.",
            actionMeta.queuedHint,
            failedCount > 0
              ? `Có ${failedCount} VPS chưa nhận lệnh trong lượt này. Anh có thể thử lại ngay.`
              : `Toàn bộ ${successCount} VPS đã nhận lệnh thành công.`,
            ...(failedCount > 0 ? summarizeStatuses(targetInstances) : []),
            ...(firstSuccessMessage ? [firstSuccessMessage] : []),
          ],
        });
      } else {
        const firstError = results.find((result) => result.status === "rejected");
        const failureMessage =
          firstError && firstError.status === "rejected" && firstError.reason instanceof Error
            ? firstError.reason.message
            : "Hệ thống chưa tiếp nhận được lệnh. Vui lòng thử lại sau.";
        setFeedback({
          title: "Chưa gửi được lệnh quản lý VPS",
          message: failureMessage,
          variant: "warning",
          highlights: [
            "Không có VPS nào nhận được lệnh trong lượt thao tác này.",
            ...summarizeStatuses(targetInstances),
            /trạng thái/i.test(failureMessage)
              ? "Nhà cung cấp đang ghi nhận trạng thái hiện tại chưa phù hợp. Anh nên đồng bộ lại trạng thái rồi thử sau."
              : "Anh có thể thử lại sau vài giây hoặc liên hệ hỗ trợ nếu trạng thái vẫn không thay đổi.",
          ],
        });
      }

      setSelectedIds(new Set());
      await refresh();

      if (typeof window !== "undefined") {
        window.setTimeout(() => {
          void refresh();
        }, 1800);
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function loadOperatingSystems() {
    const token = session?.token;

    if (!token) {
      return [];
    }

    if (availableOperatingSystems.length > 0) {
      return availableOperatingSystems;
    }

    setRebuildSystemsLoading(true);

    try {
      const response = await getUserOperatingSystems(token);
      const systems = response.operatingSystems.filter((item) => item.is_active !== 0);
      setAvailableOperatingSystems(systems);
      return systems;
    } finally {
      setRebuildSystemsLoading(false);
    }
  }

  async function openRebuildModal(instance: MyInstance) {
    try {
      const systems = await loadOperatingSystems();

      if (!systems.length) {
        setFeedback({
          title: "Chưa tải được danh sách OS để cài lại",
          message: "Hệ thống chưa lấy được danh sách hệ điều hành có thể reinstall cho VPS này.",
          variant: "warning",
          highlights: [
            "Vui lòng thử lại sau ít phút hoặc bấm đồng bộ lại để tải lại tài nguyên từ hệ thống.",
            "Nếu tình trạng kéo dài, anh có thể liên hệ hỗ trợ để kiểm tra nguồn OS khả dụng.",
          ],
        });
        return;
      }

      setSelectedRebuildOsId(systems[0]?.vncloud_os_id ?? 0);
      setRebuildInstance(instance);
    } catch (error) {
      setFeedback({
        title: "Chưa mở được form cài lại OS",
        message:
          error instanceof Error
            ? error.message
            : "Không thể tải danh sách hệ điều hành. Vui lòng thử lại sau.",
        variant: "warning",
        highlights: [
          "Danh sách OS hiện đang được lấy từ tài nguyên VPS thật của hệ thống.",
          "Anh có thể thử lại sau vài giây hoặc liên hệ hỗ trợ nếu lỗi lặp lại nhiều lần.",
        ],
      });
    }
  }

  async function handleConfirmRebuild() {
    const token = session?.token;

    if (!token || !rebuildInstance || !selectedRebuildOsId) {
      return;
    }

    const selectedSystem =
      availableOperatingSystems.find((system) => system.vncloud_os_id === selectedRebuildOsId) ??
      null;

    setRebuildLoading(true);

    try {
      const result = await runInstanceAction(token, rebuildInstance.id, "confirm-rebuild-vps", {
        osId: selectedRebuildOsId,
      });

      setRebuildInstance(null);
      setFeedback({
        title: "Đã ghi nhận lệnh cài lại OS",
        message: result.message,
        variant: "success",
        highlights: [
          `VPS: ${rebuildInstance.title || `#${rebuildInstance.vncloud_vps_id}`}.`,
          `OS đã chọn: ${selectedSystem?.name || "Hệ điều hành mới"}.`,
          "Reinstall OS là thao tác lâu hơn bật/tắt VPS vì nhà cung cấp phải cài mới toàn bộ hệ điều hành.",
          "Hệ thống đang tự tăng tần suất đồng bộ để trạng thái mới và thông tin đăng nhập cập nhật sớm hơn.",
          "Sau khi hoàn tất, anh nên kiểm tra lại IP, user, mật khẩu và trạng thái trong dashboard trước khi đăng nhập lại.",
        ],
      });

      await refresh();

      if (typeof window !== "undefined") {
        for (const delay of [1800, 6000, 15000, 30000]) {
          window.setTimeout(() => {
            void refresh();
          }, delay);
        }
      }
    } catch (error) {
      setRebuildInstance(null);
      setFeedback({
        title: "Chưa gửi được lệnh cài lại OS",
        message:
          error instanceof Error
            ? error.message
            : "Hệ thống chưa tiếp nhận được lệnh reinstall OS. Vui lòng thử lại sau.",
        variant: "warning",
        highlights: [
          `VPS: ${rebuildInstance.title || `#${rebuildInstance.vncloud_vps_id}`}.`,
          `OS đã chọn: ${selectedSystem?.name || "Hệ điều hành mới"}.`,
          "Nếu VPS đang trong lúc provision hoặc đồng bộ trạng thái, nhà cung cấp có thể từ chối lệnh ở thời điểm hiện tại.",
        ],
      });
    } finally {
      setRebuildLoading(false);
    }
  }

  function renderActionButtons(instance: MyInstance) {
    const actions = MANUAL_ACTIONS.map((key) => ({
      key,
      available: canRunAction(instance.status, key),
    }));
    const buttonDisabled = actionLoading || rebuildLoading || rebuildSystemsLoading;
    const rebuildButton = (
      <button
        type="button"
        disabled={buttonDisabled}
        className="portal-mini-button"
        onClick={() => {
          void openRebuildModal(instance);
        }}
      >
        <ServerCog className="h-3.5 w-3.5" />
        Cài lại OS
      </button>
    );

    if (!actions.some((action) => action.available)) {
      return (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {actions.map(({ key, available }) => (
              <button
                key={`${instance.id}-${key}`}
                type="button"
                disabled={buttonDisabled}
                title={!available ? getActionRequirement(key) : undefined}
                className={clsx(
                  "portal-mini-button",
                  !available && "opacity-60",
                  key === "off" && "portal-mini-button-danger",
                )}
                onClick={() => queueAction([instance.id], key)}
              >
                {key === "on" ? <Power className="h-3.5 w-3.5" /> : null}
                {key === "off" ? <PowerOff className="h-3.5 w-3.5" /> : null}
                {key === "restart" ? <RefreshCw className="h-3.5 w-3.5" /> : null}
                {ACTION_META[key].buttonLabel}
              </button>
            ))}
            {rebuildButton}
          </div>
          <span className="text-xs leading-6 text-[var(--muted)]">
            Trạng thái hiện tại chưa phù hợp để bật, tắt hoặc khởi động lại. Anh vẫn có thể bấm để xem
            hệ thống giải thích rõ lý do.
          </span>
        </div>
      );
    }

    return (
      <div className="flex flex-wrap gap-2">
        {actions.map(({ key, available }) => (
          <button
            key={`${instance.id}-${key}`}
            type="button"
            disabled={buttonDisabled}
            title={!available ? getActionRequirement(key) : undefined}
            className={clsx(
              "portal-mini-button",
              !available && "opacity-60",
              key === "off" && "portal-mini-button-danger",
            )}
            onClick={() => queueAction([instance.id], key)}
          >
            {key === "on" ? <Power className="h-3.5 w-3.5" /> : null}
            {key === "off" ? <PowerOff className="h-3.5 w-3.5" /> : null}
            {key === "restart" ? <RefreshCw className="h-3.5 w-3.5" /> : null}
            {ACTION_META[key].buttonLabel}
          </button>
        ))}
        {rebuildButton}
      </div>
    );
  }

  if (!currentUser) {
    return <PortalAuthFallback />;
  }

  return (
    <PortalShell
      user={currentUser}
      pageTitle="VPS đang sử dụng"
      breadcrumb="VPS đang sử dụng"
      pageDescription="Quản lý VPS đang chạy, lọc theo trạng thái và gửi lệnh nguồn với phản hồi rõ ràng."
      notificationCount={orders?.summary.notifications ?? 0}
    >
      <section className="grid gap-4 xl:grid-cols-3">
        <GlowCard>
          <div className="portal-stat-card">
            <span className="portal-stat-dot portal-stat-dot-positive" />
            <div className="min-w-0 flex-1">
              <p className="portal-info-label">VPS đang chạy</p>
              <div className="portal-stat-number">
                <span className="text-3xl font-bold tabular-nums text-emerald-400">
                  {loading ? "—" : counts.running}
                </span>
              </div>
            </div>
            <Power className="h-8 w-8 flex-shrink-0 text-emerald-400/60" />
          </div>
        </GlowCard>

        <GlowCard>
          <div className="portal-stat-card">
            <span className="portal-stat-dot portal-stat-dot-neutral" />
            <div className="min-w-0 flex-1">
              <p className="portal-info-label">VPS đã tắt</p>
              <div className="portal-stat-number">
                <span className="text-3xl font-bold tabular-nums text-slate-400">
                  {loading ? "—" : counts.stopped}
                </span>
              </div>
            </div>
            <PowerOff className="h-8 w-8 flex-shrink-0 text-slate-400/60" />
          </div>
        </GlowCard>

        <GlowCard>
          <div className="portal-stat-card">
            <span className="portal-stat-dot portal-stat-dot-warning" />
            <div className="min-w-0 flex-1">
              <p className="portal-info-label">Đang xử lý</p>
              <div className="portal-stat-number">
                <span className="text-3xl font-bold tabular-nums text-yellow-400">
                  {loading ? "—" : counts.processing}
                </span>
              </div>
            </div>
            <RefreshCw className="h-8 w-8 flex-shrink-0 text-yellow-400/60" />
          </div>
        </GlowCard>
      </section>

      <GlowCard>
        <div className="portal-card">
          <div className="portal-vps-guide">
            <div className="portal-vps-guide-item">
              <p className="portal-vps-guide-title">Lọc trạng thái nhanh</p>
              <p className="portal-vps-guide-copy">
                Tách riêng VPS đang chạy, đã tắt, đang xử lý hoặc có vấn đề chỉ với một chạm.
              </p>
            </div>
            <div className="portal-vps-guide-item">
              <p className="portal-vps-guide-title">Chọn nhiều VPS</p>
              <p className="portal-vps-guide-copy">
                Có thể chọn nhiều dòng để bật, tắt hoặc khởi động lại theo lô.
              </p>
            </div>
            <div className="portal-vps-guide-item">
              <p className="portal-vps-guide-title">Phản hồi rõ sau khi bấm</p>
              <p className="portal-vps-guide-copy">
                Sau mỗi lệnh, hệ thống báo ngay đã ghi nhận hay chưa để tránh bấm lặp.
              </p>
            </div>
            <div className="portal-vps-guide-item">
              <p className="portal-vps-guide-title">Tự đồng bộ trạng thái</p>
              <p className="portal-vps-guide-copy">
                Dashboard sẽ tự refresh lại vài giây sau khi gửi lệnh để anh thấy trạng thái mới.
              </p>
            </div>
          </div>

          <div className="portal-filterbar">
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-4 w-4 text-[var(--muted)]" />
              {STATUS_FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setStatusFilter(option.value)}
                  className={clsx(
                    "rounded-full px-3 py-2 text-xs font-semibold transition-all",
                    statusFilter === option.value
                      ? "bg-[#356dff] text-white shadow-[0_12px_28px_rgba(53,109,255,0.25)]"
                      : "bg-[var(--card)] text-[var(--foreground)] hover:bg-[var(--card-hover)]",
                  )}
                >
                  {option.label}
                  <span className="ml-1 tabular-nums">{counts[option.value as keyof typeof counts]}</span>
                </button>
              ))}
            </div>

            <div className="portal-count-badge">
              <span>Hiển thị</span>
              <strong>{loading ? "—" : filteredInstances.length}</strong>
            </div>

            <button
              type="button"
              disabled={loading || actionLoading}
              className="portal-mini-button"
              onClick={() => {
                void refresh();
              }}
            >
              <RefreshCw className={clsx("h-3.5 w-3.5", (loading || actionLoading) && "animate-spin")} />
              Đồng bộ lại
            </button>
          </div>

          {selectedIds.size > 0 ? (
            <div className="portal-selection-summary">
              <div>
                <p className="text-sm font-semibold text-[#356dff]">
                  Đã chọn {selectedIds.size} VPS để thao tác hàng loạt
                </p>
                <p className="mt-1 text-sm leading-7 text-[var(--muted)]">
                  Hệ thống sẽ gửi từng lệnh tới nhà cung cấp rồi tự đồng bộ lại bảng trạng thái.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={actionLoading || rebuildLoading || rebuildSystemsLoading}
                  title={
                    eligibleSelectedIds.on.length === 0 ? getActionRequirement("on") : undefined
                  }
                  className={clsx(
                    "portal-mini-button",
                    eligibleSelectedIds.on.length === 0 && "opacity-60",
                  )}
                  onClick={() => queueAction(Array.from(selectedIds), "on")}
                >
                  <Power className="h-3.5 w-3.5" />
                  Bật VPS ({eligibleSelectedIds.on.length})
                </button>
                <button
                  type="button"
                  disabled={actionLoading || rebuildLoading || rebuildSystemsLoading}
                  title={
                    eligibleSelectedIds.off.length === 0 ? getActionRequirement("off") : undefined
                  }
                  className={clsx(
                    "portal-mini-button portal-mini-button-danger",
                    eligibleSelectedIds.off.length === 0 && "opacity-60",
                  )}
                  onClick={() => queueAction(Array.from(selectedIds), "off")}
                >
                  <PowerOff className="h-3.5 w-3.5" />
                  Tắt VPS ({eligibleSelectedIds.off.length})
                </button>
                <button
                  type="button"
                  disabled={actionLoading || rebuildLoading || rebuildSystemsLoading}
                  title={
                    eligibleSelectedIds.restart.length === 0
                      ? getActionRequirement("restart")
                      : undefined
                  }
                  className={clsx(
                    "portal-mini-button",
                    eligibleSelectedIds.restart.length === 0 && "opacity-60",
                  )}
                  onClick={() => queueAction(Array.from(selectedIds), "restart")}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Khởi động lại ({eligibleSelectedIds.restart.length})
                </button>
                <button
                  type="button"
                  className="portal-mini-button"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Bỏ chọn
                </button>
              </div>
            </div>
          ) : null}

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-2xl bg-white/[0.03]" />
              ))}
            </div>
          ) : filteredInstances.length === 0 ? (
            <div className="portal-empty-card">
              <ServerCog className="h-10 w-10 text-[var(--brand-solid)]" />
              <p className="mt-4 text-lg font-semibold text-[var(--foreground)]">
                {statusFilter === "all" ? "Chưa có VPS nào" : "Không có VPS phù hợp"}
              </p>
              <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                {statusFilter === "all"
                  ? "Hãy đăng ký dịch vụ VPS để bắt đầu sử dụng."
                  : "Thử chọn bộ lọc khác để xem toàn bộ VPS."}
              </p>
            </div>
          ) : (
            <>
              <div className="portal-instance-grid lg:hidden">
                {filteredInstances.map((instance) => (
                  <div key={instance.id} className="portal-instance-card">
                    <div className="portal-instance-card-top">
                      <button
                        type="button"
                        className="portal-instance-select"
                        onClick={() => handleSelectOne(instance.id)}
                      >
                        {selectedIds.has(instance.id) ? (
                          <CheckSquare className="h-4 w-4 text-[#356dff]" />
                        ) : (
                          <Square className="h-4 w-4 text-[var(--muted)]" />
                        )}
                        Chọn VPS
                      </button>

                      <span className={`portal-status-chip ${getToneClassName(instance.status)}`}>
                        {formatInstanceStatus(instance.status)}
                      </span>
                    </div>

                    <div className="portal-instance-card-heading">
                      <p className="portal-instance-card-title">
                        {instance.title || `VPS #${instance.vncloud_vps_id}`}
                      </p>
                      <p className="portal-instance-card-subtitle">
                        {instance.order_code ? `Đơn ${instance.order_code}` : "Chưa gắn mã đơn"}
                      </p>
                    </div>

                    <div className="portal-instance-credential-grid">
                      <div className="portal-instance-credential">
                        <span>IP Address</span>
                        <strong>{instance.ip_address || "Đang đồng bộ"}</strong>
                        {instance.ip_address ? (
                          <button
                            type="button"
                            className="portal-mini-button mt-3"
                            onClick={() => copyToClipboard(instance.ip_address)}
                          >
                            <Copy className="h-3.5 w-3.5" />
                            Copy IP
                          </button>
                        ) : null}
                      </div>

                      <div className="portal-instance-credential">
                        <span>Username</span>
                        <strong>{instance.username || "Đang đồng bộ"}</strong>
                        {instance.username ? (
                          <button
                            type="button"
                            className="portal-mini-button mt-3"
                            onClick={() => copyToClipboard(instance.username)}
                          >
                            <Copy className="h-3.5 w-3.5" />
                            Copy User
                          </button>
                        ) : null}
                      </div>

                      <div className="portal-instance-credential">
                        <span>Password</span>
                        <strong>{instance.password || "Đang đồng bộ"}</strong>
                        {instance.password ? (
                          <button
                            type="button"
                            className="portal-mini-button mt-3"
                            onClick={() => copyToClipboard(instance.password)}
                          >
                            <Copy className="h-3.5 w-3.5" />
                            Copy Pass
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="portal-instance-meta-grid">
                      <div className="portal-instance-meta-card">
                        <span>Gia hạn</span>
                        <strong>{formatDateOnly(instance.next_due_date)}</strong>
                      </div>
                      <div className="portal-instance-meta-card">
                        <span>Chu kỳ</span>
                        <strong>{formatBillingCycle(instance.billing_cycle_code)}</strong>
                      </div>
                      <div className="portal-instance-meta-card">
                        <span>Auto Renew</span>
                        <strong>{instance.auto_renew === 1 ? "Đang bật" : "Đang tắt"}</strong>
                      </div>
                      <div className="portal-instance-meta-card">
                        <span>Mã đơn</span>
                        <strong>{instance.order_code || "Đang đồng bộ"}</strong>
                      </div>
                      <div className="portal-instance-meta-card">
                        <span>Hệ điều hành</span>
                        <strong>{instance.operating_system_name || "Đang đồng bộ OS"}</strong>
                      </div>
                    </div>

                    <div className="portal-instance-state-note">
                      <Info className="mt-1 h-4 w-4 shrink-0 text-[#356dff]" />
                      <p>{describeInstanceStatus(instance.status)}</p>
                    </div>

                    <div className="portal-instance-actions">{renderActionButtons(instance)}</div>
                  </div>
                ))}
              </div>

              <div className="hidden lg:block">
                <div className="portal-table-shell">
                  <table>
                    <thead>
                      <tr>
                        <th className="w-12">
                          <button
                            type="button"
                            onClick={handleSelectAll}
                            className="mx-auto flex h-6 w-6 items-center justify-center rounded border border-white/20 transition-colors hover:border-white/40"
                            title="Chọn tất cả"
                          >
                            {selectedIds.size === filteredInstances.length && filteredInstances.length > 0 ? (
                              <CheckSquare className="h-4 w-4 text-[#356dff]" />
                            ) : (
                              <Square className="h-4 w-4 text-[var(--muted)]" />
                            )}
                          </button>
                        </th>
                        <th>VPS / truy cập</th>
                        <th>Mã đơn</th>
                        <th>Gia hạn</th>
                        <th>Auto Renew</th>
                        <th>Trạng thái</th>
                        <th>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInstances.map((instance) => (
                        <tr key={instance.id}>
                          <td>
                            <button
                              type="button"
                              onClick={() => handleSelectOne(instance.id)}
                              className="mx-auto flex h-6 w-6 items-center justify-center rounded border transition-colors"
                              style={{
                                borderColor: selectedIds.has(instance.id)
                                  ? "#356dff"
                                  : "rgba(255,255,255,0.2)",
                              }}
                            >
                              {selectedIds.has(instance.id) ? (
                                <CheckSquare className="h-4 w-4 text-[#356dff]" />
                              ) : (
                                <Square className="h-4 w-4 text-[var(--muted)]" />
                              )}
                            </button>
                          </td>
                          <td>
                            <div className="min-w-[18rem]">
                              <p className="font-semibold text-[var(--foreground)]">
                                {instance.title || `VPS #${instance.vncloud_vps_id}`}
                              </p>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span className="portal-code">{instance.ip_address || "Đang đồng bộ IP"}</span>
                                {instance.ip_address ? (
                                  <button
                                    type="button"
                                    className="rounded p-1 text-[var(--muted)] transition-colors hover:text-[var(--foreground)]"
                                    onClick={() => copyToClipboard(instance.ip_address)}
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </button>
                                ) : null}
                                {instance.username ? (
                                  <span className="text-xs text-[var(--muted)]">
                                    User: {instance.username}
                                  </span>
                                ) : null}
                                <span className="text-xs text-[var(--muted)]">
                                  OS: {instance.operating_system_name || "Đang đồng bộ OS"}
                                </span>
                              </div>
                              <p className="mt-2 text-xs leading-6 text-[var(--muted)]">
                                {describeInstanceStatus(instance.status)}
                              </p>
                            </div>
                          </td>
                          <td>
                            <div className="space-y-1">
                              <span className="portal-code">{instance.order_code || "—"}</span>
                              <p className="text-xs text-[var(--muted)]">
                                {formatBillingCycle(instance.billing_cycle_code)}
                              </p>
                            </div>
                          </td>
                          <td>{formatDateOnly(instance.next_due_date)}</td>
                          <td>
                            <span
                              className={clsx(
                                "portal-status-chip",
                                instance.auto_renew === 1
                                  ? "portal-tone-positive"
                                  : "portal-tone-neutral",
                              )}
                            >
                              {instance.auto_renew === 1 ? "Đang bật" : "Đang tắt"}
                            </span>
                          </td>
                          <td>
                            <span className={`portal-status-chip ${getToneClassName(instance.status)}`}>
                              {formatInstanceStatus(instance.status)}
                            </span>
                          </td>
                          <td>{renderActionButtons(instance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </GlowCard>

      {pendingAction ? (
        <ConfirmModal
          open={Boolean(pendingAction)}
          title={ACTION_META[pendingAction.action].confirmTitle}
          message={`Anh sắp gửi lệnh cho ${pendingAction.ids.length} VPS. Hệ thống sẽ tiếp nhận lệnh và đồng bộ trạng thái lại ngay sau đó.`}
          confirmLabel={ACTION_META[pendingAction.action].confirmLabel}
          variant={ACTION_META[pendingAction.action].confirmVariant}
          highlights={[
            pendingAction.skippedCount > 0
              ? `Có ${pendingAction.skippedCount} VPS đã chọn chưa đúng trạng thái nên hệ thống sẽ bỏ qua trong lượt này.`
              : "Tất cả VPS đã chọn đều đang ở trạng thái phù hợp để nhận lệnh.",
            "Nếu popup sau đó báo đã ghi nhận lệnh, anh không cần bấm thao tác lại thêm lần nữa.",
            ACTION_META[pendingAction.action].queuedHint,
          ]}
          loading={actionLoading}
          onClose={() => setPendingAction(null)}
          onConfirm={() => {
            if (pendingAction) {
              void performAction(pendingAction.action, pendingAction.ids);
            }
          }}
        />
      ) : null}

      <NoticeModal
        open={Boolean(feedback)}
        title={feedback?.title ?? ""}
        message={feedback?.message ?? ""}
        variant={feedback?.variant ?? "info"}
        highlights={feedback?.highlights ?? []}
        onClose={() => setFeedback(null)}
      />

      <RebuildOsModal
        open={Boolean(rebuildInstance)}
        systems={availableOperatingSystems}
        selectedOsId={selectedRebuildOsId}
        loading={rebuildLoading}
        instanceTitle={rebuildInstance?.title || null}
        onSelect={setSelectedRebuildOsId}
        onClose={() => {
          setRebuildInstance(null);
          setSelectedRebuildOsId(0);
        }}
        onConfirm={() => {
          void handleConfirmRebuild();
        }}
      />
    </PortalShell>
  );
}
