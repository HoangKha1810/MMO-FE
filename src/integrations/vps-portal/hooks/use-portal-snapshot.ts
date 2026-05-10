"use client";

import { usePortalContext } from "@vps/contexts/portal-context";

export function usePortalSnapshot() {
  const ctx = usePortalContext();

  return {
    session: ctx.session,
    user: ctx.user,
    orders: ctx.orders,
    loading: ctx.loading,
    message: ctx.message,
    setMessage: ctx.setMessage,
    refresh: ctx.refresh,
  };
}
