"use client";

import dynamicImport from "next/dynamic";

const AiArenaApp = dynamicImport(() => import("@ai/App"), { ssr: false });

export default function AiArenaRouteClient() {
  return <AiArenaApp />;
}
