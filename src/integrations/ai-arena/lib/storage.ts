import { ArenaPreferences, User } from "./types";

const PREFERENCES_KEY = "ttmmo-ai-arena-preferences";
const AUTH_TOKEN_KEY = "ttmmo-ai-arena-auth-token";
const AUTH_USER_KEY = "ttmmo-ai-arena-auth-user";
const THEME_KEY = "ttmmo-ai-arena-theme";

export type ThemeMode = "dark" | "light";

export const defaultPreferences: ArenaPreferences = {
  mode: "battle",
  directModelId: "",
  leftModelId: "",
  rightModelId: "",
  battlePoolIds: [],
  battleModelCount: 4
};

const parse = <T>(value: string | null, fallback: T): T => {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export const loadPreferences = () => {
  if (typeof window === "undefined") {
    return defaultPreferences;
  }

  return parse<ArenaPreferences>(
    window.localStorage.getItem(PREFERENCES_KEY),
    defaultPreferences
  );
};

export const savePreferences = (preferences: ArenaPreferences) => {
  window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
};

const detectSystemTheme = (): ThemeMode => {
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: light)").matches
  ) {
    return "light";
  }

  return "dark";
};

export const loadTheme = (): ThemeMode => {
  if (typeof window === "undefined") {
    return "dark";
  }

  const storedTheme = window.localStorage.getItem(THEME_KEY);
  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }

  return detectSystemTheme();
};

export const saveTheme = (theme: ThemeMode) => {
  window.localStorage.setItem(THEME_KEY, theme);
};

export const loadAuthToken = () => {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(AUTH_TOKEN_KEY) ?? "";
};

export const saveAuthToken = (token: string) => {
  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
};

export const clearAuthToken = () => {
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
};

export const loadAuthUser = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return parse<User | null>(window.localStorage.getItem(AUTH_USER_KEY), null);
};

export const saveAuthUser = (user: User) => {
  window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
};

export const clearAuthUser = () => {
  window.localStorage.removeItem(AUTH_USER_KEY);
};
