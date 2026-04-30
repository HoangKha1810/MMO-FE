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
      setLoading(false);
    } else {
      void loadUser();
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
