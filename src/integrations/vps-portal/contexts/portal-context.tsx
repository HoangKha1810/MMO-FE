"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  getPortalSnapshot,
  getStoredSession,
  saveSession,
  subscribeSession,
} from "@vps/lib/api";
import { OrdersResponse, Session, User } from "@vps/lib/types";

type PortalContextValue = {
  session: Session | null;
  user: User | null;
  orders: OrdersResponse | null;
  loading: boolean;
  message: string;
  setMessage: (msg: string) => void;
  refresh: () => Promise<void>;
};

const PortalContext = createContext<PortalContextValue>({
  session: null,
  user: null,
  orders: null,
  loading: false,
  message: "",
  setMessage: () => {},
  refresh: async () => {},
});

export function usePortalContext() {
  return useContext(PortalContext);
}

export function PortalProvider({ children }: { children: React.ReactNode }) {
  const sessionFromStore = useSyncExternalStoreCompat(
    subscribeSession,
    getStoredSession,
    () => null,
  );

  const [user, setUser] = useState<User | null>(sessionFromStore?.user ?? null);
  const [orders, setOrders] = useState<OrdersResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(sessionFromStore));
  const [message, setMessage] = useState("");

  const pendingRefreshRef = useRef<Promise<void> | null>(null);

  const fetchData = useCallback(
    async (currentSession: Session) => {
      try {
        const snapshot = await getPortalSnapshot(currentSession.token);
        saveSession({
          token: currentSession.token,
          user: snapshot.user,
        });
        setUser(snapshot.user);
        setOrders(snapshot.orders);
        setMessage("");
        return snapshot;
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Không tải được dữ liệu người dùng.",
        );
        throw error;
      }
    },
    [],
  );

  const refresh = useCallback(async () => {
    const currentSession = getStoredSession();
    if (!currentSession) {
      setUser(null);
      setOrders(null);
      setLoading(false);
      return;
    }

    if (pendingRefreshRef.current) {
      return pendingRefreshRef.current;
    }

    setLoading(true);
    const promise = (async () => {
      try {
        await fetchData(currentSession);
      } finally {
        pendingRefreshRef.current = null;
        setLoading(false);
      }
    })();

    pendingRefreshRef.current = promise;
    return promise;
  }, [fetchData]);

  useEffect(() => {
    if (!sessionFromStore) {
      setUser(null);
      setOrders(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        await fetchData(sessionFromStore);
      } catch {
        // error already handled in fetchData
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionFromStore, fetchData]);

  const value: PortalContextValue = {
    session: sessionFromStore,
    user,
    orders,
    loading,
    message,
    setMessage,
    refresh,
  };

  return (
    <PortalContext.Provider value={value}>
      {children}
    </PortalContext.Provider>
  );
}

function useSyncExternalStoreCompat<T>(
  subscribe: (callback: () => void) => () => void,
  getSnapshot: () => T,
  getServerSnapshot?: () => T,
): T {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
