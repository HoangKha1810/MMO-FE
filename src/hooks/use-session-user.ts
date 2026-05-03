'use client';

import { useEffect, useState } from 'react';

export interface SessionUser {
  id?: number;
  username: string;
  email: string;
  balance: number;
  rank: string;
  role: string;
  avatar?: string;
  is_blue_tick: boolean;
}

interface SessionUserState {
  data?: SessionUser;
  loading: boolean;
}

const POLL_INTERVAL_WITH_INITIAL_USER_MS = 60 * 1000;
const POLL_INTERVAL_WITHOUT_INITIAL_USER_MS = 15 * 1000;
const SESSION_USER_CACHE_KEY = 'session_user_v1';
const SESSION_USER_CACHE_TTL_MS = 2 * 60 * 1000;

let sessionUserMemoryCache:
  | {
      expiresAt: number;
      data: SessionUser;
    }
  | null = null;

function getCachedSessionUser() {
  if (sessionUserMemoryCache && sessionUserMemoryCache.expiresAt > Date.now()) {
    return sessionUserMemoryCache.data;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(SESSION_USER_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { expiresAt?: number; data?: SessionUser };
    if (!parsed?.expiresAt || parsed.expiresAt <= Date.now() || !parsed.data) {
      window.sessionStorage.removeItem(SESSION_USER_CACHE_KEY);
      return null;
    }

    sessionUserMemoryCache = {
      expiresAt: parsed.expiresAt,
      data: parsed.data,
    };
    return parsed.data;
  } catch {
    return null;
  }
}

function setCachedSessionUser(user: SessionUser) {
  sessionUserMemoryCache = {
    expiresAt: Date.now() + SESSION_USER_CACHE_TTL_MS,
    data: user,
  };

  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(SESSION_USER_CACHE_KEY, JSON.stringify(sessionUserMemoryCache));
  } catch {}
}

export function useSessionUser(initialUser?: SessionUser): SessionUserState {
  const [data, setData] = useState<SessionUser | undefined>(initialUser);
  const [loading, setLoading] = useState(!initialUser);

  useEffect(() => {
    let active = true;

    async function loadUser() {
      try {
        const response = await fetch('/api/user/me', {
          cache: 'no-store',
          credentials: 'include',
          headers: { 'Cache-Control': 'no-store' },
        });
        if (!response.ok) {
          if (active) {
            setLoading(false);
          }
          return;
        }

        const payload = await response.json();
        if (active) {
          setData(payload.user);
          if (payload.user) {
            setCachedSessionUser(payload.user);
          }
          setLoading(false);
        }
      } catch {
        if (active) {
          setLoading(false);
        }
      }
    }

    if (initialUser) {
      setData(initialUser);
      setCachedSessionUser(initialUser);
      setLoading(false);
    } else {
      const cachedUser = getCachedSessionUser();
      if (cachedUser) {
        setData(cachedUser);
        setLoading(false);
      } else {
        void loadUser();
      }
    }
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadUser();
      }
    }, initialUser ? POLL_INTERVAL_WITH_INITIAL_USER_MS : POLL_INTERVAL_WITHOUT_INITIAL_USER_MS);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [initialUser]);

  return { data, loading };
}
