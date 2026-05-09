import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import {
  buildTentacleGitCommitUrl,
  buildTentacleGitPullRequestMergeUrl,
  buildTentacleGitPullRequestUrl,
  buildTentacleGitPushUrl,
  buildTentacleGitStatusUrl,
  buildTentacleGitSyncUrl,
} from "../../runtime/runtimeEndpoints";
import type {
  CoordinationGitStatusSnapshot,
  CoordinationPullRequestSnapshot,
  TerminalView,
} from "../types";

type UseTentacleGitLifecycleOptions = {
  columns: TerminalView;
};

type UseTentacleGitLifecycleResult = {
  gitStatusByTentacleId: Record<string, CoordinationGitStatusSnapshot>;
  gitStatusLoadingByTentacleId: Record<string, boolean>;
  pullRequestByTentacleId: Record<string, CoordinationPullRequestSnapshot>;
  pullRequestLoadingByTentacleId: Record<string, boolean>;
  openGitTentacleId: string | null;
  openGitTentacleStatus: CoordinationGitStatusSnapshot | null;
  openGitTentaclePullRequest: CoordinationPullRequestSnapshot | null;
  gitCommitMessageDraft: string;
  gitDialogError: string | null;
  isGitDialogLoading: boolean;
  isGitDialogMutating: boolean;
  setGitCommitMessageDraft: Dispatch<SetStateAction<string>>;
  openTentacleGitActions: (coordinationId: string) => void;
  closeTentacleGitActions: () => void;
  commitTentacleChanges: () => Promise<void>;
  commitAndPushTentacleBranch: () => Promise<void>;
  pushTentacleBranch: () => Promise<void>;
  syncTentacleBranch: () => Promise<void>;
  mergeTentaclePullRequest: () => Promise<void>;
};

const parseGitError = async (response: Response, fallback: string) => {
  try {
    const payload = (await response.json()) as { error?: unknown };
    if (typeof payload.error === "string" && payload.error.trim().length > 0) {
      return payload.error.trim();
    }
  } catch {
    return fallback;
  }

  return fallback;
};

const parseTentacleGitStatus = (payload: unknown): CoordinationGitStatusSnapshot | null => {
  if (payload === null || payload === undefined || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  if (
    typeof record.coordinationId !== "string" ||
    (record.workspaceMode !== "shared" && record.workspaceMode !== "worktree") ||
    typeof record.branchName !== "string" ||
    (record.upstreamBranchName !== null && typeof record.upstreamBranchName !== "string") ||
    typeof record.isDirty !== "boolean" ||
    typeof record.aheadCount !== "number" ||
    typeof record.behindCount !== "number" ||
    typeof record.hasConflicts !== "boolean" ||
    !Array.isArray(record.changedFiles) ||
    !record.changedFiles.every((file) => typeof file === "string") ||
    (record.defaultBaseBranchName !== null && typeof record.defaultBaseBranchName !== "string")
  ) {
    return null;
  }

  return {
    coordinationId: record.coordinationId,
    workspaceMode: record.workspaceMode,
    branchName: record.branchName,
    upstreamBranchName: record.upstreamBranchName,
    isDirty: record.isDirty,
    aheadCount: record.aheadCount,
    behindCount: record.behindCount,
    insertedLineCount: typeof record.insertedLineCount === "number" ? record.insertedLineCount : 0,
    deletedLineCount: typeof record.deletedLineCount === "number" ? record.deletedLineCount : 0,
    hasConflicts: record.hasConflicts,
    changedFiles: [...record.changedFiles],
    defaultBaseBranchName: record.defaultBaseBranchName,
  };
};

const parseTentaclePullRequest = (payload: unknown): CoordinationPullRequestSnapshot | null => {
  if (payload === null || payload === undefined || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  if (
    typeof record.coordinationId !== "string" ||
    (record.workspaceMode !== "shared" && record.workspaceMode !== "worktree") ||
    (record.status !== "none" &&
      record.status !== "open" &&
      record.status !== "merged" &&
      record.status !== "closed") ||
    (record.number !== null && typeof record.number !== "number") ||
    (record.url !== null && typeof record.url !== "string") ||
    (record.title !== null && typeof record.title !== "string") ||
    (record.baseRef !== null && typeof record.baseRef !== "string") ||
    (record.headRef !== null && typeof record.headRef !== "string") ||
    (record.isDraft !== null && typeof record.isDraft !== "boolean") ||
    (record.mergeable !== null &&
      record.mergeable !== "MERGEABLE" &&
      record.mergeable !== "CONFLICTING" &&
      record.mergeable !== "UNKNOWN") ||
    (record.mergeStateStatus !== null && typeof record.mergeStateStatus !== "string")
  ) {
    return null;
  }

  return {
    coordinationId: record.coordinationId,
    workspaceMode: record.workspaceMode,
    status: record.status,
    number: record.number,
    url: record.url,
    title: record.title,
    baseRef: record.baseRef,
    headRef: record.headRef,
    isDraft: record.isDraft,
    mergeable: record.mergeable,
    mergeStateStatus: record.mergeStateStatus,
  };
};

export const useTentacleGitLifecycle = ({
  columns,
}: UseTentacleGitLifecycleOptions): UseTentacleGitLifecycleResult => {
  const [gitStatusByTentacleId, setGitStatusByTentacleId] = useState<
    Record<string, CoordinationGitStatusSnapshot>
  >({});
  const [gitStatusLoadingByTentacleId, setGitStatusLoadingByTentacleId] = useState<
    Record<string, boolean>
  >({});
  const [gitStatusAttemptedTentacleIds, setGitStatusAttemptedTentacleIds] = useState<
    Record<string, boolean>
  >({});
  const [pullRequestByTentacleId, setPullRequestByTentacleId] = useState<
    Record<string, CoordinationPullRequestSnapshot>
  >({});
  const [pullRequestLoadingByTentacleId, setPullRequestLoadingByTentacleId] = useState<
    Record<string, boolean>
  >({});
  const [pullRequestAttemptedTentacleIds, setPullRequestAttemptedTentacleIds] = useState<
    Record<string, boolean>
  >({});
  const [openGitTentacleId, setOpenGitTentacleId] = useState<string | null>(null);
  const [gitCommitMessageDraft, setGitCommitMessageDraft] = useState("");
  const [gitDialogError, setGitDialogError] = useState<string | null>(null);
  const [isGitDialogMutating, setIsGitDialogMutating] = useState(false);

  const fetchTentacleGitStatus = useCallback(async (coordinationId: string) => {
    setGitStatusLoadingByTentacleId((current) => ({
      ...current,
      [coordinationId]: true,
    }));

    try {
      const response = await fetch(buildTentacleGitStatusUrl(coordinationId), {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });
      if (!response.ok) {
        const errorMessage = await parseGitError(
          response,
          `Unable to fetch git status (${response.status}).`,
        );
        throw new Error(errorMessage);
      }

      const payload = parseTentacleGitStatus(await response.json());
      if (!payload) {
        throw new Error("Unable to parse git status response.");
      }

      setGitStatusByTentacleId((current) => ({
        ...current,
        [coordinationId]: payload,
      }));
      return payload;
    } finally {
      setGitStatusLoadingByTentacleId((current) => ({
        ...current,
        [coordinationId]: false,
      }));
    }
  }, []);

  const fetchTentaclePullRequest = useCallback(async (coordinationId: string) => {
    setPullRequestLoadingByTentacleId((current) => ({
      ...current,
      [coordinationId]: true,
    }));

    try {
      const response = await fetch(buildTentacleGitPullRequestUrl(coordinationId), {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });
      if (!response.ok) {
        const errorMessage = await parseGitError(
          response,
          `Unable to fetch pull request status (${response.status}).`,
        );
        throw new Error(errorMessage);
      }

      const payload = parseTentaclePullRequest(await response.json());
      if (!payload) {
        throw new Error("Unable to parse pull request response.");
      }

      setPullRequestByTentacleId((current) => ({
        ...current,
        [coordinationId]: payload,
      }));
      return payload;
    } finally {
      setPullRequestLoadingByTentacleId((current) => ({
        ...current,
        [coordinationId]: false,
      }));
    }
  }, []);

  const worktreeTentacleIds = useMemo(
    () =>
      columns
        .filter((column) => column.workspaceMode === "worktree")
        .map((column) => column.coordinationId),
    [columns],
  );

  useEffect(() => {
    const activeTentacleIds = new Set(columns.map((column) => column.coordinationId));
    setGitStatusByTentacleId((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([coordinationId]) => activeTentacleIds.has(coordinationId)),
      ),
    );
    setGitStatusLoadingByTentacleId((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([coordinationId]) => activeTentacleIds.has(coordinationId)),
      ),
    );
    setGitStatusAttemptedTentacleIds((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([coordinationId]) => activeTentacleIds.has(coordinationId)),
      ),
    );
    setPullRequestByTentacleId((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([coordinationId]) => activeTentacleIds.has(coordinationId)),
      ),
    );
    setPullRequestLoadingByTentacleId((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([coordinationId]) => activeTentacleIds.has(coordinationId)),
      ),
    );
    setPullRequestAttemptedTentacleIds((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([coordinationId]) => activeTentacleIds.has(coordinationId)),
      ),
    );
    if (openGitTentacleId && !activeTentacleIds.has(openGitTentacleId)) {
      setOpenGitTentacleId(null);
      setGitDialogError(null);
      setGitCommitMessageDraft("");
    }
  }, [columns, openGitTentacleId]);

  useEffect(() => {
    for (const coordinationId of worktreeTentacleIds) {
      if (gitStatusAttemptedTentacleIds[coordinationId]) {
        continue;
      }

      setGitStatusAttemptedTentacleIds((current) => ({
        ...current,
        [coordinationId]: true,
      }));
      void fetchTentacleGitStatus(coordinationId).catch((error: unknown) => {
        console.warn(`[git] Failed to fetch status for tentacle ${coordinationId}:`, error);
      });
    }
  }, [fetchTentacleGitStatus, gitStatusAttemptedTentacleIds, worktreeTentacleIds]);

  useEffect(() => {
    for (const coordinationId of worktreeTentacleIds) {
      if (pullRequestAttemptedTentacleIds[coordinationId]) {
        continue;
      }

      setPullRequestAttemptedTentacleIds((current) => ({
        ...current,
        [coordinationId]: true,
      }));
      void fetchTentaclePullRequest(coordinationId).catch((error: unknown) => {
        console.warn(`[git] Failed to fetch pull request for tentacle ${coordinationId}:`, error);
      });
    }
  }, [fetchTentaclePullRequest, pullRequestAttemptedTentacleIds, worktreeTentacleIds]);

  const openTentacleGitActions = useCallback(
    (coordinationId: string) => {
      setOpenGitTentacleId(coordinationId);
      setGitDialogError(null);
      setGitCommitMessageDraft("");

      void Promise.all([
        fetchTentacleGitStatus(coordinationId),
        fetchTentaclePullRequest(coordinationId),
      ]).catch((error: unknown) => {
        setGitDialogError(
          error instanceof Error ? error.message : "Unable to fetch git lifecycle data.",
        );
      });
    },
    [fetchTentacleGitStatus, fetchTentaclePullRequest],
  );

  const closeTentacleGitActions = useCallback(() => {
    setOpenGitTentacleId(null);
    setGitDialogError(null);
    setGitCommitMessageDraft("");
  }, []);

  const runGitMutation = useCallback(
    async (
      action: "commit" | "push" | "sync",
      request: { body?: string; headers?: Record<string, string> } = {},
    ): Promise<CoordinationGitStatusSnapshot | null> => {
      if (!openGitTentacleId) {
        return null;
      }

      const endpoint =
        action === "commit"
          ? buildTentacleGitCommitUrl(openGitTentacleId)
          : action === "push"
            ? buildTentacleGitPushUrl(openGitTentacleId)
            : buildTentacleGitSyncUrl(openGitTentacleId);

      setIsGitDialogMutating(true);
      setGitDialogError(null);
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            Accept: "application/json",
            ...request.headers,
          },
          body: request.body ?? null,
        });

        if (!response.ok) {
          const errorMessage = await parseGitError(
            response,
            `Unable to ${action} (${response.status}).`,
          );
          throw new Error(errorMessage);
        }

        const payload = parseTentacleGitStatus(await response.json());
        if (!payload) {
          throw new Error("Unable to parse git lifecycle response.");
        }

        setGitStatusByTentacleId((current) => ({
          ...current,
          [openGitTentacleId]: payload,
        }));
        return payload;
      } catch (error) {
        setGitDialogError(
          error instanceof Error ? error.message : `Unable to ${action} tentacle worktree.`,
        );
        return null;
      } finally {
        setIsGitDialogMutating(false);
      }
    },
    [openGitTentacleId],
  );

  const runPullRequestMutation = useCallback(
    async (request: { body?: string; headers?: Record<string, string> } = {}) => {
      if (!openGitTentacleId) {
        return;
      }

      const endpoint = buildTentacleGitPullRequestMergeUrl(openGitTentacleId);

      setIsGitDialogMutating(true);
      setGitDialogError(null);
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            Accept: "application/json",
            ...request.headers,
          },
          body: request.body ?? null,
        });

        if (!response.ok) {
          const errorMessage = await parseGitError(
            response,
            `Unable to merge pull request (${response.status}).`,
          );
          throw new Error(errorMessage);
        }

        const payload = parseTentaclePullRequest(await response.json());
        if (!payload) {
          throw new Error("Unable to parse pull request response.");
        }

        setPullRequestByTentacleId((current) => ({
          ...current,
          [openGitTentacleId]: payload,
        }));
      } catch (error) {
        setGitDialogError(error instanceof Error ? error.message : "Unable to merge pull request.");
      } finally {
        setIsGitDialogMutating(false);
      }
    },
    [openGitTentacleId],
  );

  const commitTentacleChanges = useCallback(async () => {
    const message = gitCommitMessageDraft.trim();
    if (message.length === 0) {
      setGitDialogError("Commit message cannot be empty.");
      return;
    }

    const committed = await runGitMutation("commit", {
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    });
    if (committed) {
      setGitCommitMessageDraft("");
    }
  }, [gitCommitMessageDraft, runGitMutation]);

  const commitAndPushTentacleBranch = useCallback(async () => {
    const message = gitCommitMessageDraft.trim();
    if (message.length === 0) {
      setGitDialogError("Commit message cannot be empty.");
      return;
    }

    const committed = await runGitMutation("commit", {
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    });
    if (!committed) {
      return;
    }
    setGitCommitMessageDraft("");
    await runGitMutation("push");
  }, [gitCommitMessageDraft, runGitMutation]);

  const pushTentacleBranch = useCallback(async () => {
    await runGitMutation("push");
  }, [runGitMutation]);

  const syncTentacleBranch = useCallback(async () => {
    await runGitMutation("sync");
  }, [runGitMutation]);

  const mergeTentaclePullRequest = useCallback(async () => {
    await runPullRequestMutation();
  }, [runPullRequestMutation]);

  const openGitTentacleStatus =
    openGitTentacleId !== null ? (gitStatusByTentacleId[openGitTentacleId] ?? null) : null;
  const openGitTentaclePullRequest =
    openGitTentacleId !== null ? (pullRequestByTentacleId[openGitTentacleId] ?? null) : null;
  const isGitDialogLoading =
    openGitTentacleId !== null
      ? (gitStatusLoadingByTentacleId[openGitTentacleId] ?? false) ||
        (pullRequestLoadingByTentacleId[openGitTentacleId] ?? false)
      : false;

  return {
    gitStatusByTentacleId,
    gitStatusLoadingByTentacleId,
    pullRequestByTentacleId,
    pullRequestLoadingByTentacleId,
    openGitTentacleId,
    openGitTentacleStatus,
    openGitTentaclePullRequest,
    gitCommitMessageDraft,
    gitDialogError,
    isGitDialogLoading,
    isGitDialogMutating,
    setGitCommitMessageDraft,
    openTentacleGitActions,
    closeTentacleGitActions,
    commitTentacleChanges,
    commitAndPushTentacleBranch,
    pushTentacleBranch,
    syncTentacleBranch,
    mergeTentaclePullRequest,
  };
};
