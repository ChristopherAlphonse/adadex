import type { ParsedRecord } from "@adadex/core";
import { useCallback, useEffect, useRef, useState } from "react";

import type {
  FactoryActionInput,
  FactoryApproval,
  FactoryHost,
  FactoryJob,
  FactoryLogEvent,
  FactoryProcess,
  FactoryRole,
  FactoryWorkflow,
} from "../../runtime/factoryHost";

export interface FactorySnapshot {
  readonly jobs: readonly FactoryJob[];
  readonly workflows: readonly FactoryWorkflow[];
  readonly approvals: readonly FactoryApproval[];
  readonly processes: readonly FactoryProcess[];
  readonly loop: boolean | null;
  readonly checks: string | null;
  readonly roles: readonly FactoryRole[] | null;
  readonly logs: readonly FactoryLogEvent[] | null;
}

const EMPTY_SNAPSHOT: FactorySnapshot = {
  jobs: [],
  workflows: [],
  approvals: [],
  processes: [],
  loop: null,
  checks: null,
  roles: null,
  logs: null,
};

const messageOf = (cause: unknown): string =>
  cause instanceof Error && cause.message.length > 0 ? cause.message : "Factory request failed";

const readSnapshot = async (host: FactoryHost): Promise<FactorySnapshot> => {
  const [jobs, workflows, approvals, processes, loop, checks, roles, logs] = await Promise.all([
    host.listJobs(),
    host.listWorkflows(),
    host.listApprovals(),
    host.listProcesses(),
    host.getLoop(),
    host.getChecks(),
    host.listRoles(),
    host.listLogs(),
  ]);

  return { jobs, workflows, approvals, processes, loop, checks, roles, logs };
};

export const useFactoryHost = (host: FactoryHost) => {
  const [snapshot, setSnapshot] = useState<FactorySnapshot>(EMPTY_SNAPSHOT);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const isMountedRef = useRef(false);
  const loadedHostRef = useRef<FactoryHost | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await readSnapshot(host);

      if (isMountedRef.current) {
        setSnapshot(next);
        setLoadError(null);
      }
    } catch (cause) {
      if (isMountedRef.current) setLoadError(messageOf(cause));
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [host]);

  useEffect(() => {
    isMountedRef.current = true;

    if (loadedHostRef.current !== host) {
      loadedHostRef.current = host;
      void refresh();
    }

    const unsubscribe = host.subscribe(() => {
      void refresh();
    });

    return () => {
      isMountedRef.current = false;
      unsubscribe();
    };
  }, [host, refresh]);

  const runMutation = useCallback(
    async (key: string, mutate: () => Promise<void>): Promise<boolean> => {
      setPendingKey(key);
      setActionError(null);

      try {
        await mutate();
        await refresh();

        return true;
      } catch (cause) {
        setActionError(messageOf(cause));

        return false;
      } finally {
        setPendingKey(null);
      }
    },
    [refresh],
  );

  const runAction = useCallback(
    async (key: string, actionId: string, input: FactoryActionInput) =>
      runMutation(key, () => host.runAction(actionId, input)),
    [host, runMutation],
  );

  const respondApproval = useCallback(
    async (key: string, approvalId: string, approved: boolean) =>
      runMutation(key, () => host.respondApproval(approvalId, approved)),
    [host, runMutation],
  );

  const killProcess = useCallback(
    async (key: string, processId: string) => runMutation(key, () => host.killProcess(processId)),
    [host, runMutation],
  );

  const setLoop = useCallback(
    async (enabled: boolean) => runMutation("loop", () => host.setLoop(enabled)),
    [host, runMutation],
  );

  const setChecks = useCallback(
    async (command: string) => runMutation("checks", () => host.setChecks(command)),
    [host, runMutation],
  );

  const saveRole = useCallback(
    async (role: ParsedRecord) => runMutation("role:save", () => host.saveRole(role)),
    [host, runMutation],
  );

  const removeRole = useCallback(
    async (id: string) => runMutation(`role:remove:${id}`, () => host.removeRole(id)),
    [host, runMutation],
  );

  return {
    snapshot,
    isLoading,
    error: actionError ?? loadError,
    pendingKey,
    refresh,
    runAction,
    respondApproval,
    killProcess,
    setLoop,
    setChecks,
    saveRole,
    removeRole,
  };
};
