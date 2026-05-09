import { useCallback, useEffect, useRef, useState } from "react";

type UsePollingDataOptions<T> = {
  fetchUrl: string;
  intervalMs: number;
  normalize: (raw: unknown) => T | null;
  fallback: () => T;
  enabled?: boolean;
};

export const usePollingData = <T>(options: UsePollingDataOptions<T>) => {
  const { fetchUrl, intervalMs, enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const isInFlightRef = useRef(false);
  const isDisposedRef = useRef(false);
  const hasQueuedRefreshRef = useRef(false);

  const normalizeRef = useRef(options.normalize);
  normalizeRef.current = options.normalize;
  const fallbackRef = useRef(options.fallback);
  fallbackRef.current = options.fallback;

  const sync = useCallback(
    async (force = false) => {
      if (isDisposedRef.current) return;
      if (isInFlightRef.current) {
        if (force) {
          hasQueuedRefreshRef.current = true;
        }
        return;
      }
      isInFlightRef.current = true;
      setIsLoading(true);
      try {
        const response = await fetch(fetchUrl, {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        const parsed = normalizeRef.current(await response.json());
        if (!isDisposedRef.current) setData(parsed ?? fallbackRef.current());
      } catch (error) {
        if (!isDisposedRef.current) {
          console.warn(
            `[polling] ${fetchUrl} failed:`,
            error instanceof Error ? error.message : error,
          );
        }
      } finally {
        isInFlightRef.current = false;
        if (!isDisposedRef.current) setIsLoading(false);
        if (hasQueuedRefreshRef.current) {
          hasQueuedRefreshRef.current = false;
          void sync();
        }
      }
    },
    [fetchUrl],
  );

  useEffect(() => {
    if (!enabled) return;
    isDisposedRef.current = false;
    void sync();
    const timerId = window.setInterval(() => void sync(), intervalMs);
    return () => {
      isDisposedRef.current = true;
      window.clearInterval(timerId);
    };
  }, [enabled, intervalMs, sync]);

  const refresh = useCallback(() => {
    void sync(true);
  }, [sync]);

  return { data, isLoading, refresh };
};
