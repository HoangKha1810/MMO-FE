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

export function useSessionUser(initialUser?: SessionUser): SessionUserState {
  const [data, setData] = useState<SessionUser | undefined>(initialUser);
  const [loading, setLoading] = useState(!initialUser);

  useEffect(() => {
    if (initialUser) {
      setData(initialUser);
      setLoading(false);
      return;
    }

    let active = true;

    async function loadUser() {
      try {
        const response = await fetch('/api/user/me', { credentials: 'include' });
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

    void loadUser();

    return () => {
      active = false;
    };
  }, [initialUser]);

  return { data, loading };
}
