import { ModelInfo } from "./types";

import { toAiAssetUrl } from "./runtime";

interface ModelLogoSource {
  id?: string;
  modelId?: string;
  modelName?: string;
  label?: string;
  providerId?: string;
  providerLabel?: string;
}

const sanitizeLogoKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const STATIC_LOGO_BY_KEY: Record<string, string[]> = {
  openai: [toAiAssetUrl("openai.png")],
  gemini: [toAiAssetUrl("gemini.png")],
  "google-gemini": [toAiAssetUrl("gemini.png")],
  cohere: [toAiAssetUrl("cohere.png")],
  xai: [toAiAssetUrl("grok.webp")],
  grok: [toAiAssetUrl("grok.webp")],
  deepseek: [toAiAssetUrl("deepseek.jpg")],
  kimi: [toAiAssetUrl("kimi.png")],
  qwen: [toAiAssetUrl("qwen.png")],
  dashscope: [toAiAssetUrl("qwen.png")],
  mistral: [toAiAssetUrl("mistral.png")]
};

export const KNOWN_STATIC_LOGO_PATHS = new Set(
  Object.values(STATIC_LOGO_BY_KEY).flat()
);

export const buildModelLogoCandidates = (
  source: ModelLogoSource | ModelInfo
) => {
  const fallbackModelId = "modelId" in source ? source.modelId : "";
  const resolvedModelId = source.id ?? fallbackModelId ?? "";
  const derivedProviderId =
    source.providerId || (resolvedModelId.includes(":") ? resolvedModelId.split(":")[0] : "");
  const derivedModelName =
    source.modelName || (resolvedModelId.includes(":") ? resolvedModelId.split(":").slice(1).join(":") : "");
  const providerLabel = source.providerLabel ?? "";
  const label = source.label ?? "";

  const aliasKeys = [
    derivedProviderId === "xai" ? "grok" : "",
    derivedProviderId === "anthropic" ? "claude" : "",
    derivedProviderId === "gemini" ? "google-gemini" : "",
    providerLabel.toLowerCase().includes("grok") ? "grok" : "",
    providerLabel.toLowerCase().includes("claude") ? "claude" : "",
    providerLabel.toLowerCase().includes("gemini") ? "gemini" : "",
    label.toLowerCase().includes("grok") ? "grok" : "",
    label.toLowerCase().includes("claude") ? "claude" : "",
    label.toLowerCase().includes("deepseek") ? "deepseek" : "",
    derivedProviderId === "cohere" ? "cohere" : "",
    label.toLowerCase().includes("command a") ? "cohere" : "",
    derivedProviderId === "kimi" ? "kimi" : "",
    label.toLowerCase().includes("kimi") ? "kimi" : "",
    derivedProviderId === "dashscope" ? "qwen" : "",
    label.toLowerCase().includes("qwen") ? "qwen" : "",
    derivedProviderId === "minimax" ? "minimax" : "",
    label.toLowerCase().includes("minimax") ? "minimax" : ""
  ]
    .filter(Boolean)
    .map(sanitizeLogoKey);

  const prioritizedKeys = [
    derivedProviderId,
    ...aliasKeys,
    providerLabel,
    label
  ]
    .filter(Boolean)
    .map(sanitizeLogoKey)
    .filter(Boolean);

  const keys = [
    ...prioritizedKeys,
    resolvedModelId,
    derivedModelName,
    label,
    providerLabel
  ]
    .filter(Boolean)
    .map(sanitizeLogoKey)
    .filter(Boolean);

  const extensions = ["png", "svg", "webp", "jpg", "jpeg"];
  const staticCandidates = prioritizedKeys.flatMap((key) => STATIC_LOGO_BY_KEY[key] ?? []);
  const candidates: string[] = [...staticCandidates];

  keys.forEach((key) => {
    extensions.forEach((extension) => {
      candidates.push(toAiAssetUrl(`${key}.${extension}`));
      candidates.push(toAiAssetUrl(`model-logos/${key}.${extension}`));
    });
  });

  return [...new Set(candidates)];
};
