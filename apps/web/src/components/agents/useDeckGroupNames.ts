import { asRecord, isString } from "@adadex/core";
import { useEffect, useState } from "react";

import { buildDeckOrchestrationsUrl } from "../../runtime/runtimeEndpoints";

/** Deck display names by coordination id, so the session rail shows "Core Domain" and not `core-domain`. */
export const useDeckGroupNames = (refreshKey: number): ReadonlyMap<string, string> => {
  const [names, setNames] = useState<ReadonlyMap<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch(buildDeckOrchestrationsUrl());

        if (!response.ok) return;

        const payload: unknown = await response.json();
        const next = new Map<string, string>();

        for (const entry of Array.isArray(payload) ? payload : []) {
          const record = asRecord(entry);

          if (record && isString(record.coordinationId) && isString(record.displayName)) {
            next.set(record.coordinationId, record.displayName);
          }
        }

        if (!cancelled) setNames(next);
      } catch {
        // The rail falls back to the coordination id.
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return names;
};
