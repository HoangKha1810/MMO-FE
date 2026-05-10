import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { buildModelLogoCandidates, KNOWN_STATIC_LOGO_PATHS } from "../lib/modelLogos";

const loadedLogoCache = new Set<string>();
const failedLogoCache = new Set<string>();

interface ModelAvatarMarkProps {
  modelId?: string;
  modelName?: string;
  label?: string;
  providerId?: string;
  providerLabel?: string;
  accent?: string;
  size?: number;
  className?: string;
  alt?: string;
}

export function ModelAvatarMark({
  modelId,
  modelName,
  label,
  providerId,
  providerLabel,
  accent = "#4da4ff",
  size = 16,
  className = "",
  alt
}: ModelAvatarMarkProps) {
  const candidates = useMemo(
    () =>
      buildModelLogoCandidates({
        modelId,
        modelName,
        label,
        providerId,
        providerLabel
      }),
    [label, modelId, modelName, providerId, providerLabel]
  );
  const cachedResolvedCandidate = useMemo(
    () => candidates.find((candidate) => loadedLogoCache.has(candidate)) ?? null,
    [candidates]
  );
  const knownStaticCandidate = useMemo(
    () => candidates.find((candidate) => KNOWN_STATIC_LOGO_PATHS.has(candidate)) ?? null,
    [candidates]
  );
  const allCandidatesFailed = useMemo(
    () => candidates.length === 0 || candidates.every((candidate) => failedLogoCache.has(candidate)),
    [candidates]
  );
  const [resolvedCandidate, setResolvedCandidate] = useState<string | null>(
    cachedResolvedCandidate ?? knownStaticCandidate
  );
  const [showFallback, setShowFallback] = useState(allCandidatesFailed);

  useEffect(() => {
    let cancelled = false;

    if (cachedResolvedCandidate) {
      setResolvedCandidate(cachedResolvedCandidate);
      setShowFallback(false);
      return () => {
        cancelled = true;
      };
    }

    if (knownStaticCandidate) {
      setResolvedCandidate(knownStaticCandidate);
      setShowFallback(false);
      return () => {
        cancelled = true;
      };
    }

    if (allCandidatesFailed) {
      setResolvedCandidate(null);
      setShowFallback(true);
      return () => {
        cancelled = true;
      };
    }

    setResolvedCandidate(null);
    setShowFallback(false);

    const probeCandidates = candidates.filter((candidate) => !failedLogoCache.has(candidate));
    let probeIndex = 0;

    const probeNext = () => {
      if (cancelled) {
        return;
      }

      const candidate = probeCandidates[probeIndex];
      if (!candidate) {
        setShowFallback(true);
        return;
      }

      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        loadedLogoCache.add(candidate);
        if (!cancelled) {
          setResolvedCandidate(candidate);
          setShowFallback(false);
        }
      };
      image.onerror = () => {
        failedLogoCache.add(candidate);
        probeIndex += 1;
        probeNext();
      };
      image.src = candidate;
    };

    probeNext();

    return () => {
      cancelled = true;
    };
  }, [allCandidatesFailed, cachedResolvedCandidate, candidates, knownStaticCandidate]);

  const style = {
    "--chip-accent": accent,
    "--model-avatar-size": `${size}px`
  } as CSSProperties;

  if (showFallback) {
    return (
      <span className={`model-avatar-mark is-fallback ${className}`.trim()} style={style}>
        <span className="model-avatar-mark__dot" />
      </span>
    );
  }

  return (
    <span
      className={`model-avatar-mark ${resolvedCandidate ? "is-loaded" : "is-loading"} ${className}`.trim()}
      style={style}
    >
      {resolvedCandidate ? (
        <img
          src={resolvedCandidate}
          alt={alt ?? `${providerLabel ?? label ?? "Model"} logo`}
          className="model-avatar-mark__image"
          loading="eager"
        />
      ) : (
        <span className="model-avatar-mark__dot" aria-hidden="true" />
      )}
    </span>
  );
}
