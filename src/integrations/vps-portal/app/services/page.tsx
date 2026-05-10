"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { getStoredSession, subscribeSession } from "@vps/lib/api";

export default function ServicesRedirectPage() {
  const router = useRouter();
  const session = useSyncExternalStore(subscribeSession, getStoredSession, () => null);

  useEffect(() => {
    if (session) {
      router.replace("/vps/dashboard/services");
      return;
    }

    router.replace("/vps/auth");
  }, [router, session]);

  return null;
}
