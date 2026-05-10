"use client";

import type { CSSProperties, ReactNode } from "react";
import { useLayoutEffect, useRef } from "react";
import clsx from "clsx";

type AutoFitTextProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  maxFontSize?: number;
  minFontSize?: number;
  step?: number;
};

export function AutoFitText({
  children,
  className,
  style,
  maxFontSize = 44,
  minFontSize = 18,
  step = 1,
}: AutoFitTextProps) {
  const elementRef = useRef<HTMLSpanElement | null>(null);

  useLayoutEffect(() => {
    let frame = 0;

    const fitText = () => {
      const element = elementRef.current;

      if (!element) {
        return;
      }

      let nextSize = maxFontSize;

      element.style.whiteSpace = "nowrap";
      element.style.overflow = "hidden";
      element.style.textOverflow = "clip";
      element.style.fontSize = `${maxFontSize}px`;

      while (element.scrollWidth > element.clientWidth && nextSize > minFontSize) {
        nextSize -= step;
        element.style.fontSize = `${nextSize}px`;
      }
    };

    const scheduleFit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fitText);
    };

    scheduleFit();

    const observer = new ResizeObserver(scheduleFit);

    if (elementRef.current) {
      observer.observe(elementRef.current);

      if (elementRef.current.parentElement) {
        observer.observe(elementRef.current.parentElement);
      }
    }

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [children, maxFontSize, minFontSize, step]);

  return (
    <span
      ref={elementRef}
      className={clsx("portal-fit-line", className)}
      style={{ fontSize: maxFontSize, ...style }}
    >
      {children}
    </span>
  );
}
