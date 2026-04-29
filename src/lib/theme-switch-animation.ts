'use client';

export type ThemeName = 'light' | 'dark';

type ThemeSwitchAnimationDetail = {
  duration: number;
  radius: number;
  theme: ThemeName;
  x: number;
  y: number;
};

type ThemeSwitchSource =
  | EventTarget
  | {
      currentTarget?: EventTarget | null;
      target?: EventTarget | null;
    }
  | null
  | undefined;

type StartThemeSwitchAnimationInput = {
  currentTheme: ThemeName;
  duration?: number;
  nextTheme: ThemeName;
  setTheme: (theme: string) => void;
  source?: ThemeSwitchSource;
};

export const THEME_SWITCH_ANIMATION_EVENT = 'trungtammmo:theme-switch-animation';
const THEME_SWITCH_DURATION_MS = 720;
const THEME_SWITCH_COMMIT_MS = 260;

let cleanupTimer: number | null = null;
let commitTimer: number | null = null;

function resolveThemeToggleElement(source?: ThemeSwitchSource) {
  if (!source || typeof window === 'undefined') {
    return null;
  }

  if (source instanceof HTMLElement) {
    return source;
  }

  if ('currentTarget' in source && source.currentTarget instanceof HTMLElement) {
    return source.currentTarget;
  }

  if ('target' in source && source.target instanceof HTMLElement) {
    return source.target;
  }

  return null;
}

function getFallbackOrigin() {
  if (typeof window === 'undefined') {
    return { x: 0, y: 0 };
  }

  return {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  };
}

function getAnimationOrigin(source?: ThemeSwitchSource) {
  const element = resolveThemeToggleElement(source);
  if (!element) {
    return getFallbackOrigin();
  }

  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function getRevealRadius(x: number, y: number) {
  if (typeof window === 'undefined') {
    return 0;
  }

  const corners = [
    { x: 0, y: 0 },
    { x: window.innerWidth, y: 0 },
    { x: 0, y: window.innerHeight },
    { x: window.innerWidth, y: window.innerHeight },
  ];

  return Math.max(
    ...corners.map((corner) => Math.hypot(corner.x - x, corner.y - y))
  );
}

function dispatchThemeSwitchAnimation(detail: ThemeSwitchAnimationDetail) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<ThemeSwitchAnimationDetail>(THEME_SWITCH_ANIMATION_EVENT, {
      detail,
    })
  );
}

export function cleanupThemeSwitchAnimation() {
  if (typeof window === 'undefined') {
    return;
  }

  if (commitTimer) {
    window.clearTimeout(commitTimer);
    commitTimer = null;
  }

  if (cleanupTimer) {
    window.clearTimeout(cleanupTimer);
    cleanupTimer = null;
  }

  document.documentElement.classList.remove('theme-switching');
}

export function startThemeSwitchAnimation({
  currentTheme,
  duration = THEME_SWITCH_DURATION_MS,
  nextTheme,
  setTheme,
  source,
}: StartThemeSwitchAnimationInput) {
  if (typeof window === 'undefined') {
    setTheme(nextTheme);
    return;
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) {
    document.documentElement.style.colorScheme = nextTheme;
    setTheme(nextTheme);
    return;
  }

  const { x, y } = getAnimationOrigin(source);
  const radius = getRevealRadius(x, y);

  cleanupThemeSwitchAnimation();
  document.documentElement.classList.add('theme-switching');
  document.documentElement.style.colorScheme = currentTheme;

  dispatchThemeSwitchAnimation({
    duration,
    radius,
    theme: nextTheme,
    x,
    y,
  });

  const commitDelay = Math.min(THEME_SWITCH_COMMIT_MS, Math.max(duration - 180, 140));

  commitTimer = window.setTimeout(() => {
    document.documentElement.style.colorScheme = nextTheme;
    setTheme(nextTheme);
  }, commitDelay);

  cleanupTimer = window.setTimeout(() => {
    document.documentElement.classList.remove('theme-switching');
    document.documentElement.style.colorScheme = nextTheme;
  }, duration + 40);
}
