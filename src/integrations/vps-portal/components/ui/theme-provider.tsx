"use client";

import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from "react";
import { shouldReducePortalMotion } from "@vps/lib/motion";
import { ThemeMode } from "@vps/lib/types";

type ThemeAnimationOrigin = {
  x: number;
  y: number;
};

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode, origin?: ThemeAnimationOrigin) => void;
  toggleTheme: (origin?: ThemeAnimationOrigin) => void;
};

type ViewTransition = {
  ready: Promise<void>;
  finished: Promise<void>;
};

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => ViewTransition;
};

const STORAGE_KEY = "vncloud-vps-theme";
const THEME_TRANSITION_DURATION = 780;
const THEME_TRANSITION_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

function persistTheme(theme: ThemeMode) {
  window.localStorage.setItem(STORAGE_KEY, theme);
}

function animateThemeSwitch(origin?: ThemeAnimationOrigin) {
  const x = origin?.x ?? window.innerWidth / 2;
  const y = origin?.y ?? window.innerHeight / 2;
  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  );
  const animationOptions = {
    duration: THEME_TRANSITION_DURATION,
    easing: THEME_TRANSITION_EASING,
    fill: "both",
  } satisfies KeyframeAnimationOptions;

  document.documentElement.animate(
    {
      clipPath: [
        `circle(0px at ${x}px ${y}px)`,
        `circle(${endRadius}px at ${x}px ${y}px)`,
      ],
      opacity: [0.62, 1],
      filter: ["blur(18px) saturate(1.08)", "blur(0px) saturate(1)"],
      transform: ["scale(0.985)", "scale(1)"],
    },
    {
      ...animationOptions,
      pseudoElement: "::view-transition-new(root)",
    },
  );

  document.documentElement.animate(
    {
      opacity: [1, 0.92],
      filter: ["blur(0px)", "blur(12px)"],
      transform: ["scale(1)", "scale(1.012)"],
    },
    {
      ...animationOptions,
      duration: 340,
      easing: "ease-out",
      pseudoElement: "::view-transition-old(root)",
    },
  );
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof document !== "undefined") {
      const bootstrappedTheme = document.documentElement.dataset.theme;

      if (bootstrappedTheme === "dark" || bootstrappedTheme === "light") {
        return bootstrappedTheme;
      }
    }

    if (typeof window !== "undefined") {
      const storedTheme = window.localStorage.getItem(STORAGE_KEY);

      if (storedTheme === "dark" || storedTheme === "light") {
        return storedTheme;
      }
    }

    return "dark";
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = (nextTheme: ThemeMode, origin?: ThemeAnimationOrigin) => {
    if (theme === nextTheme) {
      return;
    }

    const documentWithTransition = document as ViewTransitionDocument;
    const commitTheme = () => {
      setThemeState(nextTheme);
      applyTheme(nextTheme);
      persistTheme(nextTheme);
    };

    if (documentWithTransition.startViewTransition && !shouldReducePortalMotion()) {
      try {
        const transition = documentWithTransition.startViewTransition(commitTheme);

        transition.ready
          .then(() => {
            animateThemeSwitch(origin);
          })
          .catch(() => undefined);
        transition.finished.catch(() => undefined);
      } catch {
        commitTheme();
      }

      return;
    }

    commitTheme();
  };

  const toggleTheme = (origin?: ThemeAnimationOrigin) => {
    setTheme(theme === "dark" ? "light" : "dark", origin);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme phải được dùng bên trong ThemeProvider.");
  }

  return context;
}
