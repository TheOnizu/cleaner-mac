import { createContext, useContext, useState, useCallback } from "react";

interface SessionStats {
  spaceFreed: number;   // bytes freed this session
  itemsCleaned: number; // items moved to trash this session
}

interface SessionStatsContextValue extends SessionStats {
  addClean: (bytes: number, count: number) => void;
  reset: () => void;
}

const SessionStatsContext = createContext<SessionStatsContextValue>({
  spaceFreed: 0,
  itemsCleaned: 0,
  addClean: () => {},
  reset: () => {},
});

export function SessionStatsProvider({ children }: { children: React.ReactNode }) {
  const [stats, setStats] = useState<SessionStats>({ spaceFreed: 0, itemsCleaned: 0 });

  const addClean = useCallback((bytes: number, count: number) => {
    setStats((prev) => ({
      spaceFreed: prev.spaceFreed + bytes,
      itemsCleaned: prev.itemsCleaned + count,
    }));
  }, []);

  const reset = useCallback(() => {
    setStats({ spaceFreed: 0, itemsCleaned: 0 });
  }, []);

  return (
    <SessionStatsContext.Provider value={{ ...stats, addClean, reset }}>
      {children}
    </SessionStatsContext.Provider>
  );
}

export function useSessionStats() {
  return useContext(SessionStatsContext);
}
