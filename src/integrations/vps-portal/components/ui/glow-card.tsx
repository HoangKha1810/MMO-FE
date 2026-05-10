"use client";

import { PropsWithChildren } from "react";
import clsx from "clsx";

type GlowCardProps = PropsWithChildren<{
  className?: string;
}>;

export function GlowCard({ children, className }: GlowCardProps) {
  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-[30px] border border-white/10 bg-[var(--surface)] shadow-[var(--panel-shadow)]",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.18), rgba(255,255,255,0))",
        }}
      />
      <div className="relative z-10 flex h-full flex-col">{children}</div>
    </div>
  );
}
