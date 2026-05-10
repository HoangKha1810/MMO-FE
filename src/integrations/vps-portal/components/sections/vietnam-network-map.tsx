"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import clsx from "clsx";
import {
  vietnamAdministrativeUnits,
  vietnamNetworkHubs,
} from "@vps/lib/vietnam-administrative-map";

const DEFAULT_UNIT_ID = "ho-chi-minh";
const DISPLAY_MAP_VIEWBOX = {
  minX: 50,
  minY: 18,
  width: 390,
  height: 815,
} as const;

export function VietnamNetworkMap() {
  const [activeUnitId, setActiveUnitId] = useState(DEFAULT_UNIT_ID);
  const [hoveredUnitId, setHoveredUnitId] = useState<string | null>(null);
  const [compactInteraction, setCompactInteraction] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia(
      "(max-width: 1199px), (max-height: 820px), (pointer: coarse)",
    );

    const syncInteractionMode = () => {
      const nextCompactInteraction = mediaQuery.matches;
      setCompactInteraction(nextCompactInteraction);

      if (nextCompactInteraction) {
        setHoveredUnitId(null);
      }
    };

    syncInteractionMode();
    mediaQuery.addEventListener("change", syncInteractionMode);

    return () => {
      mediaQuery.removeEventListener("change", syncInteractionMode);
    };
  }, []);

  const focusedUnitId = compactInteraction ? activeUnitId : hoveredUnitId ?? activeUnitId;
  const focusedUnit =
    vietnamAdministrativeUnits.find((unit) => unit.id === focusedUnitId) ??
    vietnamAdministrativeUnits[0];
  const overviewStats = [
    { label: "Tỉnh, thành", value: vietnamAdministrativeUnits.length },
    { label: "Hub nổi bật", value: vietnamNetworkHubs.length },
    { label: "Vùng phủ", value: "Bắc - Trung - Nam" },
  ];
  const stageLegend = [
    "Vùng được tô đậm là cụm hạ tầng thường được ưu tiên triển khai.",
    "Chấm sáng biểu thị các hub kết nối thường dùng cho website, MMO và bot.",
    "Bấm trực tiếp vào bản đồ hoặc danh sách bên phải để đổi cụm đang xem.",
  ];

  function previewUnit(unitId: string) {
    if (!compactInteraction) {
      setHoveredUnitId(unitId);
    }
  }

  function clearPreviewUnit() {
    if (!compactInteraction) {
      setHoveredUnitId(null);
    }
  }

  return (
    <div
      className="intro-vn-map-shell intro-vn-map-shell-detailed"
      data-compact-interaction={compactInteraction ? "true" : "false"}
    >
      <div className="intro-vn-map-topbar">
        <div className="min-w-0">
          <p className="intro-vn-map-kicker">Hạ tầng VPS tại Việt Nam</p>
          <h3 className="intro-vn-map-title intro-vn-map-title-large">
            Chọn khu vực triển khai VPS phù hợp để vận hành ổn định hơn
          </h3>
          <p className="intro-vn-map-subtitle">
            Theo dõi các cụm hạ tầng từ Bắc vào Nam để dễ hình dung nơi dịch vụ đang được ưu
            tiên triển khai cho website, MMO, backend và automation bot cần độ trễ tốt, băng
            thông ổn định và thời gian vận hành dài hạn.
          </p>
        </div>

        <div className="intro-vn-map-topbar-pills">
          <span className="landing-mini-pill">Phủ rộng Bắc - Trung - Nam</span>
          <span className="landing-mini-pill">Ưu tiên website, MMO và bot</span>
          <span className="landing-mini-pill">Dễ chọn khu vực triển khai</span>
        </div>

        <div className="intro-vn-topbar-stats">
          {overviewStats.map((item) => (
            <div key={item.label} className="intro-vn-topbar-stat">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="intro-vn-map-layout">
        <div className="intro-vn-map-stage">
          <div className="intro-vn-map-grid" />
          <div className="intro-vn-map-canvas">
            <svg
              viewBox={`${DISPLAY_MAP_VIEWBOX.minX} ${DISPLAY_MAP_VIEWBOX.minY} ${DISPLAY_MAP_VIEWBOX.width} ${DISPLAY_MAP_VIEWBOX.height}`}
              className="intro-vn-map-svg intro-vn-map-svg-detailed"
              role="img"
              aria-label="Bản đồ hành chính Việt Nam theo 34 tỉnh, thành hiện hành"
            >
              <defs>
                <filter id="vn-province-shadow" x="-25%" y="-25%" width="150%" height="150%">
                  <feDropShadow
                    dx="0"
                    dy="8"
                    stdDeviation="16"
                    floodColor="rgba(0, 102, 255, 0.18)"
                  />
                </filter>
              </defs>

              {vietnamAdministrativeUnits.map((unit) => {
                const isActive = unit.id === focusedUnitId;

                return (
                  <g
                    key={unit.id}
                    className="intro-vn-region"
                    data-active={isActive ? "true" : "false"}
                    data-hub={unit.isKeyHub ? "true" : "false"}
                    tabIndex={0}
                    role="button"
                    aria-label={`Xem ${unit.label}`}
                    onMouseEnter={() => previewUnit(unit.id)}
                    onMouseLeave={clearPreviewUnit}
                    onFocus={() => previewUnit(unit.id)}
                    onBlur={clearPreviewUnit}
                    onClick={() => setActiveUnitId(unit.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setActiveUnitId(unit.id);
                      }
                    }}
                  >
                    <title>{unit.label}</title>
                    {unit.locations.map((location) => (
                      <path
                        key={location.id}
                        d={location.path}
                        data-location-id={location.id}
                        className={clsx(
                          "intro-vn-region-path",
                          unit.isKeyHub && "intro-vn-region-path-hub",
                          isActive && "intro-vn-region-path-active",
                        )}
                        filter={isActive ? "url(#vn-province-shadow)" : undefined}
                      />
                    ))}
                  </g>
                );
              })}
            </svg>

            {vietnamNetworkHubs.map((hub) => {
              const isCurrentHub = hub.unitId === focusedUnitId;

              return (
                <button
                  key={hub.id}
                  type="button"
                  className="intro-vn-map-pin intro-vn-map-pin-button"
                  data-active={isCurrentHub ? "true" : "false"}
                  style={{
                    left: `${hub.displayLeft ?? 50}%`,
                    top: `${hub.displayTop ?? 50}%`,
                    "--hub-label-offset-x": `${hub.labelOffsetX ?? 20}px`,
                    "--hub-label-offset-y": `${hub.labelOffsetY ?? -8}px`,
                  } as CSSProperties}
                  onClick={() => setActiveUnitId(hub.unitId)}
                >
                  <span className="intro-vn-map-pin-dot" />
                  <span className="intro-vn-map-pin-label">{hub.label}</span>
                </button>
              );
            })}
          </div>

          <div className="intro-vn-stage-focus">
            <p className="intro-vn-map-kicker">Khu vực đang nổi bật</p>
            <h4 className="intro-vn-stage-focus-title">{focusedUnit.label}</h4>
            <p className="intro-vn-stage-focus-copy">
              {focusedUnit.region} · {focusedUnit.kind}
            </p>
          </div>

          <div className="intro-vn-stage-legend">
            {stageLegend.map((item) => (
              <div key={item} className="intro-vn-stage-legend-item">
                {item}
              </div>
            ))}
          </div>
        </div>

        <aside className="intro-vn-map-sidebar">
          <div className="intro-vn-focus-card">
            <p className="intro-vn-map-kicker">Khu vực đang xem</p>
            <h4 className="intro-vn-focus-title">{focusedUnit.label}</h4>
            <p className="intro-vn-focus-copy">{focusedUnit.description}</p>

            <div className="intro-vn-focus-meta">
              <div className="intro-vn-focus-meta-item">
                <span>Phân loại</span>
                <strong>{focusedUnit.kind}</strong>
              </div>
              <div className="intro-vn-focus-meta-item">
                <span>Khu vực</span>
                <strong>{focusedUnit.region}</strong>
              </div>
              <div className="intro-vn-focus-meta-item">
                <span>Phạm vi gộp</span>
                <strong>{focusedUnit.mergedFrom.length} đơn vị</strong>
              </div>
            </div>

            <div className="intro-vn-source-grid">
              {focusedUnit.mergedFrom.map((provinceName) => (
                <span key={provinceName} className="landing-mini-pill">
                  {provinceName}
                </span>
              ))}
            </div>
          </div>

          <div className="intro-vn-list-card">
            <div className="intro-vn-list-header">
              <div>
                <p className="intro-vn-map-kicker">Điểm hạ tầng nổi bật</p>
                <h4 className="intro-vn-list-title">Các khu vực thường được ưu tiên triển khai</h4>
              </div>
            </div>

            <div className="intro-vn-hub-list">
              {vietnamNetworkHubs.map((hub) => (
                <button
                  key={hub.id}
                  type="button"
                  className="intro-vn-hub-item"
                  data-active={hub.unitId === focusedUnitId ? "true" : "false"}
                  onClick={() => setActiveUnitId(hub.unitId)}
                >
                  <span className="intro-vn-hub-item-title">{hub.label}</span>
                  <span className="intro-vn-hub-item-copy">{hub.detail}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="intro-vn-list-card">
            <div className="intro-vn-list-header">
              <div>
                <p className="intro-vn-map-kicker">Bản đồ toàn quốc</p>
                <h4 className="intro-vn-list-title">Danh sách 34 tỉnh, thành hiện hành</h4>
              </div>
              <span className="intro-vn-list-count">{vietnamAdministrativeUnits.length}</span>
            </div>

            <div className="intro-vn-province-scroll">
              {vietnamAdministrativeUnits.map((unit) => (
                <button
                  key={unit.id}
                  type="button"
                  className="intro-vn-province-button"
                  data-active={unit.id === focusedUnitId ? "true" : "false"}
                  onMouseEnter={() => previewUnit(unit.id)}
                  onMouseLeave={clearPreviewUnit}
                  onFocus={() => previewUnit(unit.id)}
                  onBlur={clearPreviewUnit}
                  onClick={() => setActiveUnitId(unit.id)}
                >
                  <span className="intro-vn-province-button-title">{unit.label}</span>
                  <span className="intro-vn-province-button-copy">
                    {unit.kind} · {unit.region}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
