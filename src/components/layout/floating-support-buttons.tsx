"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, MessageCircleMore, Minus, Plus, Send, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { ADMIN_ZALO_URL, TELEGRAM_GROUP_URL, TELEGRAM_SUPPORT_URL } from "@/lib/support-links";

const HIDDEN_PREFIXES = ["/admin", "/vps", "/ai"];

function shouldHide(pathname: string) {
  return HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function FloatingSupportButtons() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(true);

  if (!pathname || shouldHide(pathname)) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-[calc(1rem+env(safe-area-inset-right))]",
        "z-[80] flex flex-col items-end gap-2 sm:bottom-5 sm:right-5 sm:gap-2.5"
      )}
      aria-label="Liên hệ hỗ trợ nhanh"
    >
      <button
        type="button"
        onClick={() => setCollapsed((value) => !value)}
        className={cn(
          "relative inline-flex h-14 w-14 items-center justify-center overflow-hidden rounded-[1.15rem] border text-white sm:h-16 sm:w-16",
          "border-cyan-300/45 bg-[linear-gradient(135deg,#2563eb,#06b6d4_55%,#22c55e)] shadow-[0_0_0_7px_rgba(34,211,238,0.12),0_22px_58px_rgba(14,165,233,0.48)] backdrop-blur-xl",
          "transition-transform duration-300 hover:-translate-y-1 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300",
          collapsed ? "animate-pulse" : "border-white/35 bg-[linear-gradient(135deg,#0f172a,#2563eb)]"
        )}
        aria-label={collapsed ? "Mở liên hệ hỗ trợ" : "Thu gọn liên hệ hỗ trợ"}
        title={collapsed ? "Mở liên hệ hỗ trợ" : "Thu gọn liên hệ hỗ trợ"}
      >
        <span className="support-fab__shine" />
        {collapsed ? <Plus className="relative z-10 h-7 w-7 sm:h-8 sm:w-8" /> : <Minus className="relative z-10 h-7 w-7 sm:h-8 sm:w-8" />}
      </button>

      <div
        className={cn(
          "flex flex-col gap-3 transition-all duration-300 ease-out origin-bottom-right",
          collapsed ? "pointer-events-none scale-90 opacity-0 translate-y-2 max-h-0 overflow-hidden" : "scale-100 opacity-100 translate-y-0"
        )}
        aria-hidden={collapsed}
      >
      <Link
        href="/user/chatbot"
        className={cn(
          "support-fab group relative flex min-h-0 items-center gap-2 overflow-hidden rounded-[1rem]",
          "border border-cyan-300/35 bg-[linear-gradient(135deg,rgba(14,165,233,0.98),rgba(34,197,94,0.96))]",
          "px-2.5 py-2.5 text-white shadow-[0_18px_48px_rgba(14,165,233,0.42)]",
          "transition-transform duration-300 hover:-translate-y-1 hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
        )}
        onClick={() => setCollapsed(true)}
      >
        <span className="support-fab__shine" />
        <span className="flex h-9 w-9 items-center justify-center rounded-[0.85rem] bg-white/16 backdrop-blur">
          <Bot className="h-5 w-5" />
        </span>
        <span className="hidden pr-1.5 text-xs font-black uppercase tracking-[0.18em] sm:inline">
          Trợ lý AI
        </span>
      </Link>

      <a
        href={TELEGRAM_GROUP_URL}
        target="_blank"
        rel="noreferrer"
        className={cn(
          "support-fab group relative flex min-h-0 items-center gap-2 overflow-hidden rounded-[1rem]",
          "border border-emerald-400/30 bg-[linear-gradient(135deg,rgba(5,150,105,0.96),rgba(16,185,129,0.96))]",
          "px-2.5 py-2.5 text-white shadow-[0_16px_40px_rgba(5,150,105,0.32)]",
          "transition-transform duration-300 hover:-translate-y-1 hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
        )}
      >
        <span className="support-fab__shine" />
        <span className="flex h-9 w-9 items-center justify-center rounded-[0.85rem] bg-white/14 backdrop-blur">
          <Users className="h-5 w-5" />
        </span>
        <span className="hidden pr-1.5 text-xs font-black uppercase tracking-[0.18em] sm:inline">
          Nhóm Telegram
        </span>
      </a>

      <a
        href={ADMIN_ZALO_URL}
        target="_blank"
        rel="noreferrer"
        className={cn(
          "support-fab group relative flex min-h-0 items-center gap-2 overflow-hidden rounded-[1rem]",
          "border border-cyan-400/30 bg-[linear-gradient(135deg,rgba(37,99,235,0.96),rgba(56,189,248,0.96))]",
          "px-2.5 py-2.5 text-white shadow-[0_16px_40px_rgba(14,116,144,0.42)]",
          "transition-transform duration-300 hover:-translate-y-1 hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
        )}
      >
        <span className="support-fab__shine" />
        <span className="flex h-9 w-9 items-center justify-center rounded-[0.85rem] bg-white/14 backdrop-blur">
          <MessageCircleMore className="h-5 w-5" />
        </span>
        <span className="hidden pr-1.5 text-xs font-black uppercase tracking-[0.18em] sm:inline">
          Zalo
        </span>
      </a>

      <a
        href={TELEGRAM_SUPPORT_URL}
        target="_blank"
        rel="noreferrer"
        className={cn(
          "support-fab group relative flex min-h-0 items-center gap-2 overflow-hidden rounded-[1rem]",
          "border border-fuchsia-400/30 bg-[linear-gradient(135deg,rgba(88,28,135,0.96),rgba(219,39,119,0.96))]",
          "px-2.5 py-2.5 text-white shadow-[0_16px_40px_rgba(124,58,237,0.38)]",
          "transition-transform duration-300 hover:-translate-y-1 hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300"
        )}
      >
        <span className="support-fab__shine support-fab__shine--alt" />
        <span className="flex h-9 w-9 items-center justify-center rounded-[0.85rem] bg-white/14 backdrop-blur">
          <Send className="h-5 w-5" />
        </span>
        <span className="hidden pr-1.5 text-xs font-black uppercase tracking-[0.18em] sm:inline">
          Telegram
        </span>
      </a>
      </div>
    </div>
  );
}
