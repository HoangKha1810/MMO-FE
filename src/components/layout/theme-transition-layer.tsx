'use client';

import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  THEME_SWITCH_ANIMATION_EVENT,
  type ThemeName,
} from '@/lib/theme-switch-animation';

type ThemeTransitionState = {
  duration: number;
  id: number;
  radius: number;
  theme: ThemeName;
  x: number;
  y: number;
};

type ThemeSwitchAnimationDetail = Omit<ThemeTransitionState, 'id'>;

export function ThemeTransitionLayer() {
  const [transition, setTransition] = useState<ThemeTransitionState | null>(null);

  useEffect(() => {
    let clearTimer: number | null = null;

    const handleThemeSwitch = (event: Event) => {
      const customEvent = event as CustomEvent<ThemeSwitchAnimationDetail>;
      const detail = customEvent.detail;

      if (!detail) {
        return;
      }

      if (clearTimer) {
        window.clearTimeout(clearTimer);
      }

      setTransition({
        ...detail,
        id: Date.now(),
      });

      clearTimer = window.setTimeout(() => {
        setTransition(null);
      }, detail.duration + 80);
    };

    window.addEventListener(THEME_SWITCH_ANIMATION_EVENT, handleThemeSwitch);

    return () => {
      window.removeEventListener(THEME_SWITCH_ANIMATION_EVENT, handleThemeSwitch);
      if (clearTimer) {
        window.clearTimeout(clearTimer);
      }
    };
  }, []);

  if (!transition) {
    return null;
  }

  return (
    <div
      key={transition.id}
      aria-hidden="true"
      className={cn(
        'theme-transition-overlay-circular',
        transition.theme === 'dark'
          ? 'theme-transition-overlay-circular-dark'
          : 'theme-transition-overlay-circular-light'
      )}
      style={
        {
          '--theme-reveal-duration': `${transition.duration}ms`,
          '--theme-reveal-radius': `${transition.radius}px`,
          '--theme-reveal-x': `${transition.x}px`,
          '--theme-reveal-y': `${transition.y}px`,
        } as CSSProperties
      }
    />
  );
}
