export const siteConfig = {
  name: "TRUNGTAMMMO.VN",
  shortName: "TRUNGTAMMMO.VN",
  title: "TRUNGTAMMMO.VN | Thuê VPS tốc độ cao, kích hoạt nhanh",
  description:
    "TRUNGTAMMMO.VN cung cấp dịch vụ thuê VPS tốc độ cao, mua bằng số dư, quản lý máy chủ tập trung và giao diện hiện đại cho người dùng MMO lẫn vận hành website.",
  keywords: [
    "TRUNGTAMMMO.VN",
    "thuê VPS",
    "mua VPS",
    "VPS Việt Nam",
    "VPS tốc độ cao",
    "quản trị VPS",
    "MMO",
    "hosting",
  ],
  creator: "TRUNGTAMMMO.VN",
  siteUrl: process.env.NEXT_PUBLIC_VPS_PORTAL_SITE_URL ?? "https://trungtammmo.vn/vps",
  logoPath: "/vps-assets/logo-banner.png",
  splashLogoPath: "/vps-assets/logo.gif",
  faviconPath: "/vps-assets/favicon.ico",
  favicon16Path: "/vps-assets/favicon-16x16.png",
  favicon32Path: "/vps-assets/favicon-32x32.png",
  icon192Path: "/vps-assets/icon-192.png",
  icon512Path: "/vps-assets/icon-512.png",
  maskableIconPath: "/vps-assets/icon-maskable-512.png",
  appleTouchIconPath: "/vps-assets/apple-touch-icon.png",
  openGraphImagePath: "/vps-assets/og-image.png",
  depositUrl: "https://trungtammmo.vn/deposit",
  supportUrl: "https://zalo.me/3482369546728805278",
};

export function getAbsoluteUrl(path = "") {
  return new URL(path, siteConfig.siteUrl).toString();
}
