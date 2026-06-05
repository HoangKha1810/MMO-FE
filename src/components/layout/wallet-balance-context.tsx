'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type WalletBalanceContextValue = {
  balance: number | null;
  gameBalance: number | null;
  pulse: 'up' | 'down' | null;
  pulseScope: 'balance' | 'gameBalance' | null;
  soundTick: number;
  setBalances: (input: { balance?: number | null; gameBalance?: number | null }) => void;
};

const WalletBalanceContext = createContext<WalletBalanceContextValue | null>(null);

export function WalletBalanceProvider({ children }: { children: ReactNode }) {
  const [balance, setBalance] = useState<number | null>(null);
  const [gameBalance, setGameBalance] = useState<number | null>(null);
  const [pulse, setPulse] = useState<'up' | 'down' | null>(null);
  const [pulseScope, setPulseScope] = useState<'balance' | 'gameBalance' | null>(null);
  const [soundTick, setSoundTick] = useState(0);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setBalances = useCallback((input: { balance?: number | null; gameBalance?: number | null }) => {
    setBalance((current) => {
      const next = typeof input.balance === 'number' ? input.balance : current;
      if (typeof current === 'number' && typeof next === 'number' && current !== next) {
        setPulse(next > current ? 'up' : 'down');
        setPulseScope('balance');
        setSoundTick((tick) => tick + 1);
        if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
        resetTimerRef.current = setTimeout(() => {
          setPulse(null);
          setPulseScope(null);
        }, 900);
      }
      return next;
    });
    setGameBalance((current) => {
      const next = typeof input.gameBalance === 'number' ? input.gameBalance : current;
      if (typeof current === 'number' && typeof next === 'number' && current !== next) {
        setPulse(next > current ? 'up' : 'down');
        setPulseScope('gameBalance');
        setSoundTick((tick) => tick + 1);
        if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
        resetTimerRef.current = setTimeout(() => {
          setPulse(null);
          setPulseScope(null);
        }, 900);
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({
    balance,
    gameBalance,
    pulse,
    pulseScope,
    soundTick,
    setBalances,
  }), [balance, gameBalance, pulse, pulseScope, soundTick, setBalances]);

  return <WalletBalanceContext.Provider value={value}>{children}</WalletBalanceContext.Provider>;
}

export function useWalletBalance() {
  const context = useContext(WalletBalanceContext);
  if (!context) {
    throw new Error('useWalletBalance must be used within WalletBalanceProvider');
  }
  return context;
}
