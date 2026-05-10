export type InstanceStatusKey =
  | "on"
  | "off"
  | "progressing"
  | "waiting"
  | "rebuild"
  | "expire"
  | "delete_vps"
  | "starting"
  | "stopping"
  | "restarting"
  | "unknown";

function normalizeStatusInput(status: string | null | undefined) {
  return String(status ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-+/g, "_");
}

export function normalizeInstanceStatusKey(status: string | null | undefined): InstanceStatusKey {
  const normalized = normalizeStatusInput(status);

  if (!normalized) {
    return "unknown";
  }

  if (["on", "running", "active", "online", "created", "success"].includes(normalized)) {
    return "on";
  }

  if (["off", "stop", "stopped", "offline", "shut"].includes(normalized)) {
    return "off";
  }

  if (["progressing", "processing", "provision", "provisioning", "queue", "new", "creating"].includes(normalized)) {
    return "progressing";
  }

  if (["waiting", "pending", "wait"].includes(normalized)) {
    return "waiting";
  }

  if (["rebuild", "rebuilding", "reinstall", "reinstalling"].includes(normalized)) {
    return "rebuild";
  }

  if (["expire", "expired", "suspend", "het_han", "hết_hạn"].includes(normalized)) {
    return "expire";
  }

  if (["delete_vps", "deleted", "delete", "cancel", "cancelled", "terminate", "failed"].includes(normalized)) {
    return "delete_vps";
  }

  if (["starting", "powering_on", "booting"].includes(normalized)) {
    return "starting";
  }

  if (["stopping", "shutting_down", "powering_off"].includes(normalized)) {
    return "stopping";
  }

  if (["restarting", "rebooting"].includes(normalized)) {
    return "restarting";
  }

  return "unknown";
}

export function isRunningInstanceStatus(status: string | null | undefined) {
  return normalizeInstanceStatusKey(status) === "on";
}

export function isStoppedInstanceStatus(status: string | null | undefined) {
  return normalizeInstanceStatusKey(status) === "off";
}

export function isProcessingInstanceStatus(status: string | null | undefined) {
  return ["progressing", "waiting", "rebuild", "starting", "stopping", "restarting"].includes(
    normalizeInstanceStatusKey(status),
  );
}

export function isRebuildingInstanceStatus(status: string | null | undefined) {
  return normalizeInstanceStatusKey(status) === "rebuild";
}

export function isProblemInstanceStatus(status: string | null | undefined) {
  return ["expire", "delete_vps"].includes(normalizeInstanceStatusKey(status));
}
