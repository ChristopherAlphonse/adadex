import { useCallback, useEffect, useState } from "react";

import { HttpTerminalSnapshotReader } from "../../runtime/HttpTerminalSnapshotReader";
import { buildTerminalSnapshotsUrl } from "../../runtime/runtimeEndpoints";
import { updateTerminalLaunchOptions } from "../../runtime/terminalActions";
import { type AgentLaunchSettings, writeAgentLaunchSettings } from "../agentLaunchOptions";

type UseTerminalLaunchOptionsResult = {
  options: AgentLaunchSettings;
  isSaving: boolean;
  error: string | null;
  update: (patch: Partial<AgentLaunchSettings>) => void;
  save: () => Promise<void>;
};

/**
 * Reads the model/effort stored on a terminal and keeps the shared launch defaults in sync when saved,
 * so the choice applies both when this agent restarts and when a new agent is launched.
 */
export const useTerminalLaunchOptions = (
  terminalId: string | null,
  enabled: boolean,
): UseTerminalLaunchOptionsResult => {
  const [options, setOptions] = useState<AgentLaunchSettings>(() => ({
    model: "",
    effort: "",
  }));

  const [isSaving, setIsSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !terminalId) return undefined;

    let isCancelled = false;

    const reader = new HttpTerminalSnapshotReader({ endpoint: buildTerminalSnapshotsUrl() });

    void reader
      .listTerminalSnapshots()
      .then((snapshots) => {
        if (isCancelled) return;

        const snapshot = snapshots.find((entry) => entry.terminalId === terminalId);

        setOptions({ model: snapshot?.agentModel ?? "", effort: snapshot?.agentEffort ?? "" });
      })
      .catch(() => {
        if (!isCancelled) {
          setError("Unable to load this agent's launch options.");
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [enabled, terminalId]);

  const update = useCallback((patch: Partial<AgentLaunchSettings>) => {
    setOptions((current) => ({ ...current, ...patch }));
    setError(null);
  }, []);

  const save = useCallback(async () => {
    if (!terminalId) return;

    setIsSaving(true);
    setError(null);

    try {
      await updateTerminalLaunchOptions(terminalId, {
        agentModel: options.model,
        agentEffort: options.effort,
      });
      writeAgentLaunchSettings(options);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save launch options.");
    } finally {
      setIsSaving(false);
    }
  }, [options, terminalId]);

  return { options, isSaving, error, update, save };
};
