import { animate, remove, stagger } from "animejs";

function readDeviceMemory() {
  if (typeof navigator === "undefined") {
    return null;
  }

  const value = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function shouldReducePortalMotion() {
  if (typeof window === "undefined") {
    return false;
  }

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return true;
  }

  if (window.matchMedia("(max-width: 900px)").matches || window.matchMedia("(pointer: coarse)").matches) {
    return true;
  }

  const memory = readDeviceMemory();
  if (memory !== null && memory <= 4) {
    return true;
  }

  if (typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency <= 4) {
    return true;
  }

  return false;
}

export { animate, remove, stagger };
