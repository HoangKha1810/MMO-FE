import type { Metadata } from "next";
import { IntroductionPageClient } from "@vps/components/sections/introduction-page-client";
import { siteConfig } from "@vps/lib/site";

export const metadata: Metadata = {
  title: "Giới thiệu VPS",
  description:
    "Trang giới thiệu dịch vụ VPS của TRUNGTAMMMO.VN với tổng quan hệ điều hành, hạ tầng kết nối và các tính năng nổi bật.",
  alternates: {
    canonical: "/vps/gioi-thieu",
  },
  openGraph: {
    title: `Giới thiệu VPS | ${siteConfig.name}`,
    description:
      "Khám phá tổng quan dịch vụ VPS tại TRUNGTAMMMO.VN, từ hệ điều hành triển khai đến hạ tầng và tính năng nổi bật.",
    url: `${siteConfig.siteUrl}/gioi-thieu`,
  },
};

export default function IntroductionPage() {
  return <IntroductionPageClient />;
}
