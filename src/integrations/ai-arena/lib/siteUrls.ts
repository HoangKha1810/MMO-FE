import { AI_ROUTE_BASE } from "./runtime";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const MAIN_SITE_ORIGIN = trimTrailingSlash(
  process.env.NEXT_PUBLIC_MAIN_SITE_URL ?? "https://trungtammmo.vn"
);

export const AI_SITE_ORIGIN = trimTrailingSlash(
  process.env.NEXT_PUBLIC_AI_ARENA_SITE_URL ?? `${MAIN_SITE_ORIGIN}${AI_ROUTE_BASE}`
);

export const DEPOSIT_URL =
  process.env.NEXT_PUBLIC_DEPOSIT_URL ?? `${MAIN_SITE_ORIGIN}/deposit`;
