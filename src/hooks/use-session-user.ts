'use client';

import { useEffect, useState } from 'react';
import { useWalletBalance } from '@/components/layout/wallet-balance-context';
import { readJsonResponse } from '@/lib/client-api';

export interface SessionUser {
  id?: number;
  username: string;
  email: string;
  balance: number;
  game_balance: number;
  rank: string;
  role: string;
  avatar?: string;
  is_blue_tick: boolean;
  blue_tick_expiry?: string | null;
}

interface SessionUserState {
  data?: SessionUser;
  loading: boolean;
}

const POLL_INTERVAL_WITH_INITIAL_USER_MS = 60 * 1000;
const POLL_INTERVAL_WITHOUT_INITIAL_USER_MS = 15 * 1000;
const SESSION_USER_CACHE_KEY = 'session_user_v1';
const SESSION_USER_REFRESH_EVENT = 'session-user-refresh';

export function clearSessionUserCache() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.removeItem(SESSION_USER_CACHE_KEY);
  } catch {}
}

export function requestSessionUserRefresh() {
  clearSessionUserCache();

  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(SESSION_USER_REFRESH_EVENT));
}

export function useSessionUser(initialUser?: SessionUser): SessionUserState {
  const { setBalances } = useWalletBalance();
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
            clearSessionUserCache();
            setData(undefined);
            setBalances({ balance: 0, gameBalance: 0 });
            setLoading(false);
          }
          return;
        }

        const payload = await readJsonResponse(response, 'Không tải được thông tin tài khoản');
        if (active) {
          setData(payload.user as SessionUser | undefined);
          if (payload.user) {
            setBalances({
              balance: Number((payload.user as SessionUser).balance || 0),
              gameBalance: Number((payload.user as SessionUser).game_balance || 0),
            });
          } else {
            clearSessionUserCache();
            setBalances({ balance: 0, gameBalance: 0 });
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
      setBalances({
        balance: initialUser.balance,
        gameBalance: initialUser.game_balance,
      });
      setLoading(false);
    } else {
      setData(undefined);
      setLoading(true);
      void loadUser();
    }
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadUser();
      }
    }, initialUser ? POLL_INTERVAL_WITH_INITIAL_USER_MS : POLL_INTERVAL_WITHOUT_INITIAL_USER_MS);
    window.addEventListener(SESSION_USER_REFRESH_EVENT, loadUser);

    return () => {
      active = false;
      window.removeEventListener(SESSION_USER_REFRESH_EVENT, loadUser);
      window.clearInterval(timer);
    };
  }, [initialUser, setBalances]);

  return { data, loading };
}
