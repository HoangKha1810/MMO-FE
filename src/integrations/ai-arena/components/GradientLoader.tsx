import Lottie from "lottie-react";
import type { CSSProperties } from "react";
import gradientLoaderAnimation from "../assets/sparkels.json";

interface GradientLoaderProps {
  size?: number;
  label?: string;
  className?: string;
}

export function GradientLoader({
  size = 120,
  label,
  className = ""
}: GradientLoaderProps) {
  return (
    <div
      className={`gradient-loader ${className}`.trim()}
      style={{ "--loader-size": `${size}px` } as CSSProperties}
      role="status"
      aria-live="polite"
    >
      <Lottie
        animationData={gradientLoaderAnimation}
        loop
        autoplay
        className="gradient-loader__animation"
      />
      {label ? <span className="gradient-loader__label">{label}</span> : null}
    </div>
  );
}
