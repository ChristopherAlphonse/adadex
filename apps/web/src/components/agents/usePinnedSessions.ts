import { useCallback, useState } from "react";

const PINNED_KEY = "adadex.agents.pinnedSessions";

const readPinned = (): ReadonlySet<string> => {
  try {
    const raw = localStorage.getItem(PINNED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];

    return new Set(
      Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [],
    );
  } catch {
    return new Set();
  }
};

/** Sessions the user pinned to the top of the rail, remembered on this device. */
export const usePinnedSessions = () => {
  const [pinnedIds, setPinnedIds] = useState<ReadonlySet<string>>(readPinned);

  const togglePin = useCallback((terminalId: string) => {
    setPinnedIds((current) => {
      const next = new Set(current);

      if (next.has(terminalId)) {
        next.delete(terminalId);
      } else {
        next.add(terminalId);
      }

      localStorage.setItem(PINNED_KEY, JSON.stringify([...next]));

      return next;
    });
  }, []);

  return { pinnedIds, togglePin };
};
