"use client";

import dynamicImport from "next/dynamic";

const WelcomeSplashNoSsr = dynamicImport(
  () =>
    import("@vps/components/layout/welcome-splash").then(
      (module) => module.WelcomeSplash,
    ),
  { ssr: false },
);

export function WelcomeSplashHost() {
  return <WelcomeSplashNoSsr />;
}
