import { MyInstance } from "./types";
import { normalizeInstanceStatusKey } from "./instance-status";

export function getUserInitial(name: string | null | undefined) {
  return String(name ?? "?").trim().charAt(0).toUpperCase() || "?";
}

export function normalizeRank(rank: string | null | undefined) {
  const value = String(rank ?? "").trim().toLowerCase();

  if (!value || value === "member") {
    return "Cơ bản";
  }

  if (value === "admin") {
    return "Quản trị";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "--";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function formatDateOnly(value: string | null | undefined) {
  if (!value) {
    return "--";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
  }).format(date);
}

export function formatBillingCycle(code: string | null | undefined) {
  const normalized = String(code ?? "").trim().toLowerCase();
  const compact = normalized.replace(/\s+/g, "");

  if (!normalized) {
    return "--";
  }

  if (
    normalized === "monthly" ||
    normalized === "month" ||
    normalized === "1 month" ||
    normalized === "1 tháng" ||
    normalized === "1 thang" ||
    compact === "1thang" ||
    compact === "1tháng"
  ) {
    return "1 tháng";
  }

  if (
    normalized === "quarterly" ||
    normalized === "3 month" ||
    normalized === "3 tháng" ||
    normalized === "3 thang" ||
    compact === "3thang" ||
    compact === "3tháng"
  ) {
    return "3 tháng";
  }

  if (
    normalized === "semiannually" ||
    normalized === "semi-annually" ||
    normalized === "6 month" ||
    normalized === "6 tháng" ||
    normalized === "6 thang" ||
    compact === "6thang" ||
    compact === "6tháng"
  ) {
    return "6 tháng";
  }

  if (
    normalized === "annually" ||
    normalized === "yearly" ||
    normalized === "12 month" ||
    normalized === "12 tháng" ||
    normalized === "12 thang" ||
    compact === "12thang" ||
    compact === "12tháng"
  ) {
    return "12 tháng";
  }

  return normalized;
}

export function formatOrderStatus(status: string | null | undefined) {
  const normalized = String(status ?? "").trim().toLowerCase();

  if (!normalized) {
    return "Đang xử lý";
  }

  if (/(success|paid|active|completed)/i.test(normalized)) {
    return "Hoàn tất";
  }

  if (/(pending|processing|new)/i.test(normalized)) {
    return "Đang xử lý";
  }

  if (/(cancel|failed|reject|error)/i.test(normalized)) {
    return "Thất bại";
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function formatInstanceStatus(status: string | null | undefined) {
  const normalized = normalizeInstanceStatusKey(status);

  if (normalized === "on") {
    return "Bật";
  }

  if (normalized === "off") {
    return "Tắt";
  }

  if (normalized === "progressing") {
    return "Đang tạo";
  }

  if (normalized === "waiting") {
    return "Đang chờ tạo";
  }

  if (normalized === "rebuild") {
    return "Đang cài lại";
  }

  if (normalized === "expire") {
    return "Hết hạn";
  }

  if (normalized === "delete_vps") {
    return "Đã xóa";
  }

  if (normalized === "starting") {
    return "Đang bật VPS";
  }

  if (normalized === "stopping") {
    return "Đang tắt VPS";
  }

  if (normalized === "restarting") {
    return "Đang khởi động lại";
  }

  return status?.trim() ? status : "Đang chờ tạo";
}

export function describeInstanceStatus(status: string | null | undefined) {
  const normalized = normalizeInstanceStatusKey(status);

  if (normalized === "on") {
    return "VPS đã bật và sẵn sàng. Anh có thể đăng nhập bằng IP, user và mật khẩu đang hiển thị.";
  }

  if (normalized === "off") {
    return "VPS đang ở trạng thái tắt. Anh cần bật lại nếu muốn tiếp tục truy cập và vận hành.";
  }

  if (normalized === "progressing") {
    return "VNCloud đang tạo VPS. Sau khi tạo xong, hệ thống sẽ gọi get-info-vps theo ID để cập nhật sang trạng thái bật.";
  }

  if (normalized === "waiting") {
    return "VPS đang chờ được tạo ở phía VNCloud. Dashboard sẽ tự đồng bộ lại ngay khi nhà cung cấp trả trạng thái mới.";
  }

  if (normalized === "rebuild") {
    return "Hệ thống đang cài lại OS. IP hoặc thông tin đăng nhập có thể thay đổi sau khi quá trình hoàn tất.";
  }

  if (normalized === "expire") {
    return "Dịch vụ đã hết hạn hoặc bị tạm ngưng. Anh nên gia hạn hoặc liên hệ hỗ trợ để tiếp tục sử dụng.";
  }

  if (normalized === "delete_vps") {
    return "VPS đã bị xóa hoặc hủy trên hệ thống. Hãy kiểm tra lại đơn hàng hoặc liên hệ hỗ trợ nếu cần.";
  }

  if (normalized === "starting") {
    return "Lệnh bật đã được gửi. Hệ thống đang chờ VNCloud chuyển trạng thái sang on.";
  }

  if (normalized === "stopping") {
    return "Lệnh tắt đã được gửi. Hệ thống đang chờ VNCloud chuyển trạng thái sang off.";
  }

  if (normalized === "restarting") {
    return "VPS đang khởi động lại. Dịch vụ và phiên đăng nhập tạm thời sẽ bị gián đoạn trong lúc reboot.";
  }

  return "Trạng thái hiện tại đã được hệ thống ghi nhận. Anh có thể theo dõi thêm trong lúc dashboard tiếp tục đồng bộ.";
}

export function formatTransactionType(type: string | null | undefined) {
  const normalized = String(type ?? "").trim().toLowerCase();

  if (normalized === "deposit") {
    return "Nạp tiền";
  }

  if (normalized === "order") {
    return "Mua VPS";
  }

  if (normalized === "refund") {
    return "Hoàn tiền";
  }

  if (normalized === "withdraw") {
    return "Rút tiền";
  }

  return normalized || "--";
}

export function resolveStatusTone(status: string | null | undefined) {
  const normalized = normalizeInstanceStatusKey(status);

  if (normalized === "on") {
    return "positive";
  }

  if (["progressing", "waiting", "rebuild", "starting", "stopping", "restarting"].includes(normalized)) {
    return "warning";
  }

  if (["off", "expire", "delete_vps"].includes(normalized)) {
    return "negative";
  }

  return "neutral";
}

export function resolveInstanceBucket(instance: MyInstance) {
  const status = normalizeInstanceStatusKey(instance.status);

  if (status === "delete_vps") {
    return "cancelled";
  }

  if (status === "expire") {
    return "expired";
  }

  if (instance.next_due_date) {
    const due = new Date(instance.next_due_date);

    if (!Number.isNaN(due.getTime()) && due.getTime() < Date.now()) {
      return "expired";
    }
  }

  return "active";
}

export function formatRelativeRental(
  createdAt: string | null | undefined,
  dueAt: string | null | undefined,
  billingCycleCode: string | null | undefined,
) {
  if (createdAt && dueAt) {
    const start = new Date(createdAt);
    const end = new Date(dueAt);

    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));

      if (days >= 365) {
        return `${Math.round(days / 30)} tháng`;
      }

      if (days >= 30) {
        return `${Math.max(1, Math.round(days / 30))} tháng`;
      }

      return `${days} ngày`;
    }
  }

  return formatBillingCycle(billingCycleCode);
}
