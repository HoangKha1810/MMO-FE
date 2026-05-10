"use client";

import { useEffect } from "react";
import {
  Clock3,
  Cpu,
  Globe2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { animate, remove, shouldReducePortalMotion, stagger } from "@vps/lib/motion";

const workflow = [
  {
    title: "Chọn cấu hình",
    description: "Chọn nhanh CPU, RAM, disk và gói phù hợp với MMO, web hoặc automation.",
  },
  {
    title: "Thanh toán bằng số dư",
    description: "Đơn được xác nhận trực tiếp trên hệ thống mà không cần qua nhiều bước trung gian.",
  },
  {
    title: "Provision và đồng bộ",
    description: "IP, user, password cùng trạng thái VPS sẽ trả về dashboard để quản lý tập trung.",
  },
] as const;

const stageStats = [
  {
    icon: Cpu,
    label: "Tài nguyên",
    lines: ["Intel Gold / Platinum", "SSD / NVMe tốc độ cao"],
  },
  {
    icon: Clock3,
    label: "Provision",
    lines: ["Xử lý theo luồng tự động", "Sync trạng thái liên tục"],
  },
  {
    icon: ShieldCheck,
    label: "Quản lý",
    lines: ["Hành động nguồn", "OS / gia hạn / dashboard"],
  },
] as const;

const orbitMarkers = [
  "hero-stage-orbital-dot-a",
  "hero-stage-orbital-dot-b",
  "hero-stage-orbital-dot-c",
  "hero-stage-orbital-dot-d",
  "hero-stage-orbital-dot-e",
] as const;

export function HeroScene() {
  useEffect(() => {
    if (shouldReducePortalMotion()) {
      return;
    }

    animate(".hero-neural-orb", {
      translateY: [0, -18],
      translateX: [0, 10],
      scale: [1, 1.08],
      opacity: [0.4, 0.8],
      duration: 4200,
      ease: "inOutSine",
      alternate: true,
      loop: true,
      delay: stagger(220),
    });

    animate(".hero-neural-card", {
      translateY: [26, 0],
      opacity: [0, 1],
      rotateX: [14, 0],
      duration: 1000,
      delay: stagger(120),
      ease: "outExpo",
    });

    animate(".hero-orbit-ring", {
      rotate: ["0deg", "360deg"],
      duration: 22000,
      easing: "linear",
      loop: true,
    });

    animate(".hero-stage-line-fill", {
      scaleX: [0.2, 1],
      opacity: [0.45, 1],
      duration: 1800,
      delay: stagger(180, { start: 160 }),
      ease: "outExpo",
    });

    animate(".hero-stage-pulse, .hero-stage-orbit-glow", {
      scale: [0.85, 1.18],
      opacity: [0.15, 0.45],
      duration: 2400,
      alternate: true,
      ease: "inOutSine",
      loop: true,
      delay: stagger(260),
    });

    animate(".hero-stage-core", {
      translateY: [0, -10],
      scale: [1, 1.04],
      duration: 3000,
      alternate: true,
      ease: "inOutSine",
      loop: true,
    });

    animate(".hero-stage-core-inner, .hero-stage-core-halo", {
      scale: [0.92, 1.08],
      opacity: [0.2, 0.48],
      duration: 2800,
      alternate: true,
      ease: "inOutSine",
      loop: true,
    });

    animate(".hero-stage-orbital-dot", {
      scale: [0.84, 1.18],
      opacity: [0.48, 1],
      duration: 1800,
      alternate: true,
      ease: "inOutSine",
      loop: true,
      delay: stagger(160),
    });

    return () => {
      remove(".hero-neural-orb");
      remove(".hero-neural-card");
      remove(".hero-orbit-ring");
      remove(".hero-stage-line-fill");
      remove(".hero-stage-pulse");
      remove(".hero-stage-orbit-glow");
      remove(".hero-stage-core");
      remove(".hero-stage-core-inner");
      remove(".hero-stage-core-halo");
      remove(".hero-stage-orbital-dot");
    };
  }, []);

  return (
    <div className="hero-scene-shell">
      <div className="hero-neural-orb absolute left-[6%] top-[10%] h-28 w-28 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="hero-neural-orb absolute right-[10%] top-[14%] h-24 w-24 rounded-full bg-indigo-400/18 blur-3xl" />
      <div className="hero-neural-orb absolute bottom-[14%] left-[20%] h-36 w-36 rounded-full bg-sky-400/14 blur-3xl" />
      <div className="hero-neural-orb absolute bottom-[8%] right-[16%] h-32 w-32 rounded-full bg-cyan-300/14 blur-3xl" />
      <div className="hero-scene-grid" />

      <div className="relative grid gap-6 xl:grid-cols-[0.9fr_1.1fr] xl:items-stretch">
        <div className="space-y-4">
          <div className="hero-neural-card hero-neural-panel rounded-[28px] p-5">
            <div className="hero-neural-badge">
              <Sparkles className="h-3.5 w-3.5" />
              Luồng triển khai
            </div>
            <div className="mt-5 space-y-3">
              {workflow.map((item, index) => (
                <div key={item.title} className="hero-workflow-step">
                  <div className="flex items-start gap-3">
                    <span className="hero-workflow-index">
                      0{index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="hero-workflow-title">{item.title}</p>
                      <p className="hero-workflow-copy">{item.description}</p>
                    </div>
                  </div>
                  <div className="hero-stage-line mt-4">
                    <div className="hero-stage-line-fill" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="hero-neural-card grid min-w-0 gap-3 sm:grid-cols-3">
            {stageStats.map((item) => (
              <div
                key={item.label}
                className="hero-neural-pillar flex min-w-0 flex-col rounded-[24px] p-4"
              >
                <item.icon className="hero-neural-pillar-icon" />
                <p className="hero-neural-pillar-label">{item.label}</p>
                <div className="mt-2 space-y-1.5">
                  {item.lines.map((line, lineIndex) => (
                    <span key={`${item.label}-${lineIndex}`} className="hero-neural-pillar-line">
                      {line}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="hero-scene-stage">
          <div className="hero-stage-mesh" />

          <div className="hero-scene-stage-copy">
            <div>
              <p className="hero-stage-kicker">Trải nghiệm gần với luồng thật</p>
              <h4 className="hero-stage-title">Một cụm điều phối gọn cho toàn bộ vòng đời VPS</h4>
            </div>
            <div className="hero-stage-tag">
              <Globe2 className="h-4 w-4" />
              Dashboard · Payment · Provision
            </div>
          </div>

          <div className="hero-stage-visual">
            <div className="hero-stage-center hero-stage-orbit-glow-shell hero-stage-orbit-glow-a">
              <div className="hero-stage-orbit-glow" />
            </div>
            <div className="hero-stage-center hero-stage-orbit-glow-shell hero-stage-orbit-glow-b">
              <div className="hero-stage-orbit-glow" />
            </div>
            <div className="hero-stage-center hero-orbit-ring-shell hero-orbit-ring-shell-1">
              <div className="hero-orbit-ring" />
            </div>
            <div className="hero-stage-center hero-orbit-ring-shell hero-orbit-ring-shell-2">
              <div className="hero-orbit-ring" />
            </div>
            <div className="hero-stage-center hero-orbit-ring-shell hero-orbit-ring-shell-3">
              <div className="hero-orbit-ring" />
            </div>

            <div className="hero-stage-center hero-stage-pulse-shell hero-stage-pulse-shell-a">
              <div className="hero-stage-pulse" />
            </div>
            <div className="hero-stage-center hero-stage-pulse-shell hero-stage-pulse-shell-b">
              <div className="hero-stage-pulse" />
            </div>

            {orbitMarkers.map((className) => (
              <span key={className} className={`hero-stage-orbital-dot ${className}`} />
            ))}

            <div className="hero-stage-core-shell">
              <div className="hero-stage-core">
                <div className="hero-stage-core-halo" />
                <div className="hero-stage-core-inner" />
                <div className="hero-stage-core-copy">
                  <p className="hero-stage-core-kicker">Điều phối</p>
                  <p className="hero-stage-core-title">VPS Engine</p>
                  <p className="hero-stage-core-subtitle">
                    Tạo đơn, gọi provision và đồng bộ dashboard theo cùng một flow.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="hero-stage-footer">
            <span className="hero-stage-footer-pill">Kích hoạt theo luồng tự động</span>
            <span className="hero-stage-footer-pill">Hỗ trợ website, MMO và bot</span>
            <span className="hero-stage-footer-pill">Trạng thái rõ ràng sau khi mua</span>
          </div>
        </div>
      </div>
    </div>
  );
}
