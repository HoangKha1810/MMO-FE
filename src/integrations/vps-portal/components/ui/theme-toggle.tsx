"use client";

import type { MouseEvent } from "react";
import { useSyncExternalStore } from "react";
import clsx from "clsx";
import { useTheme } from "./theme-provider";

const subscribe = () => () => {};

export function ThemeToggle() {
  return <ThemeToggleButton />;
}

export function ThemeToggleButton({
  className,
}: {
  className?: string;
}) {
  const { theme, toggleTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const themeMode = mounted ? theme : "dark";

  const handleToggle = (event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const origin = {
      x: event.clientX || rect.left + rect.width / 2,
      y: event.clientY || rect.top + rect.height / 2,
    };

    toggleTheme(origin);
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={clsx("theme-toggle-button", className)}
      data-theme-mode={themeMode}
      data-loading-ignore="true"
      aria-label={
        themeMode === "light"
          ? "Đang ở giao diện sáng, bấm để chuyển sang tối"
          : "Đang ở giao diện tối, bấm để chuyển sang sáng"
      }
      aria-checked={themeMode === "light"}
      role="switch"
      title="Chuyển giao diện sáng và tối"
    >
      <span className="theme-toggle-glyph" aria-hidden="true" />
      <span className="sr-only">
        {themeMode === "light" ? "Chuyển sang giao diện tối" : "Chuyển sang giao diện sáng"}
      </span>
    </button>
  );
}
