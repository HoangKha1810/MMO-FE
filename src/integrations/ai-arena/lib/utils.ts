import { ArenaMode, ChatSession, ModelInfo } from "./types";

const modeLabels: Record<ArenaMode, string> = {
  battle: "So sánh nhiều nguồn",
  "side-by-side": "So sánh 2 nguồn",
  direct: "Trò chuyện 1 nguồn"
};

export const getModeLabel = (mode: ArenaMode) => modeLabels[mode];

export const truncate = (value: string, length = 56) =>
  value.length > length ? `${value.slice(0, length).trimEnd()}...` : value;

export const sortSessions = (sessions: ChatSession[]) =>
  [...sessions].sort(
    (first, second) => {
      if (first.isPinned !== second.isPinned) {
        return Number(second.isPinned) - Number(first.isPinned);
      }

      return new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime();
    }
  );

export const groupModelsByProvider = (models: ModelInfo[]) =>
  models.reduce<Record<string, ModelInfo[]>>((groups, model) => {
    if (!groups[model.providerLabel]) {
      groups[model.providerLabel] = [];
    }
    groups[model.providerLabel].push(model);
    return groups;
  }, {});

export const formatResponseTime = (value: number) => {
  if (value < 1000) {
    return `${value} ms`;
  }

  return `${(value / 1000).toFixed(2)} giây`;
};

export const formatTime = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit"
  }).format(new Date(value));

export const cn = (...inputs: (string | undefined | null | false | Record<string, boolean>)[]) => {
  return inputs
    .flat()
    .filter((x): x is string => typeof x === "string" && x.length > 0)
    .join(" ");
};

export const formatDayLabel = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit"
  }).format(new Date(value));

export const areArraysEqual = (left: string[], right: string[]) =>
  [...left].sort().join("||") === [...right].sort().join("||");
