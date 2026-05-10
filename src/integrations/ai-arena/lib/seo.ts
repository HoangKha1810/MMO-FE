import { AI_SITE_ORIGIN, MAIN_SITE_ORIGIN } from "./siteUrls";

const normalizeUrl = (value: string) => value.trim().replace(/\/+$/, "");

export const SITE_URL = normalizeUrl(
  process.env.NEXT_PUBLIC_AI_ARENA_SITE_URL || AI_SITE_ORIGIN
);
export const SITE_NAME =
  process.env.NEXT_PUBLIC_AI_ARENA_SITE_NAME || "AI TTM";
export const SITE_DESCRIPTION =
  process.env.NEXT_PUBLIC_AI_ARENA_SITE_DESCRIPTION ||
  "Không gian chat AI đa mô hình của TrungTamMMO với trò chuyện trực tiếp, so sánh song song và battle mode.";
export const SITE_IMAGE = `${MAIN_SITE_ORIGIN}/ai-assets/og-image.png`;
export const SITE_AUTHOR = "TrungTamMMO";
export const SITE_LOCALE = "vi_VN";
export const SITE_LANGUAGE = "vi-VN";
export const TWITTER_HANDLE = process.env.NEXT_PUBLIC_AI_ARENA_TWITTER_HANDLE || "";

export const toAbsoluteUrl = (pathOrUrl: string) => {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  return `${SITE_URL}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
};

export const buildSeoTitle = (title?: string) =>
  title ? `${title} | ${SITE_NAME}` : SITE_NAME;
