import { asRecord, isBoolean, isNumber, isString, type ParsedValue } from "@adadex/core";
import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  buildOrchestrationGitCommitUrl,
  buildOrchestrationGitPullRequestMergeUrl,
  buildOrchestrationGitPullRequestUrl,
  buildOrchestrationGitPushUrl,
  buildOrchestrationGitStatusUrl,
  buildOrchestrationGitSyncUrl,
} from "../../runtime/runtimeEndpoints";
import type {
  CoordinationGitStatusSnapshot,
  CoordinationPullRequestSnapshot,
  TerminalView,
} from "../types";

type UseOrchestrationGitLifecycleOptions = {
  columns: TerminalView;
};

type UseOrchestrationGitLifecycleResult = {
  gitStatusByOrchestrationId: Record<string, CoordinationGitStatusSnapshot>;
  gitStatusLoadingByOrchestrationId: Record<string, boolean>;
  pullRequestByOrchestrationId: Record<string, CoordinationPullRequestSnapshot>;
  pullRequestLoadingByOrchestrationId: Record<string, boolean>;
  openGitOrchestrationId: string | null;
  openGitOrchestrationStatus: CoordinationGitStatusSnapshot | null;
  openGitOrchestrationPullRequest: CoordinationPullRequestSnapshot | null;
  gitCommitMessageDraft: string;
  gitDialogError: string | null;
  isGitDialogLoading: boolean;
  isGitDialogMutating: boolean;
  setGitCommitMessageDraft: Dispatch<SetStateAction<string>>;
  openOrchestrationGitActions: (coordinationId: string) => void;
  closeOrchestrationGitActions: () => void;
  commitOrchestrationChanges: () => Promise<void>;
  commitAndPushOrchestrationBranch: () => Promise<void>;
  pushOrchestrationBranch: () => Promise<void>;
  syncOrchestrationBranch: () => Promise<void>;
  mergeOrchestrationPullRequest: () => Promise<void>;
};

const parseGitError = async (response: Response, fallback: string) => {
  try {
    const payload = asRecord(await response.json());

    if (payload && isString(payload.error) && payload.error.trim().length > 0) {
      return payload.error.trim();
    }
  } catch {
    return fallback;
  }

  return fallback;
};

const parseOrchestrationGitStatus = (
  payload: ParsedValue,
): CoordinationGitStatusSnapshot | null => {
  const record = asRecord(payload);

  if (!record) {
    return null;
  }

  if (
    !isString(record.coordinationId) ||
    (record.workspaceMode !== "shared" && record.workspaceMode !== "worktree") ||
    !isString(record.branchName) ||
    (record.headCommit !== null &&
      record.headCommit !== undefined &&
      !isString(record.headCommit)) ||
    (record.worktreePath !== null &&
      record.worktreePath !== undefined &&
      !isString(record.worktreePath)) ||
    (record.upstreamBranchName !== null && !isString(record.upstreamBranchName)) ||
    !isBoolean(record.isDirty) ||
    !isNumber(record.aheadCount) ||
    !isNumber(record.behindCount) ||
    !isBoolean(record.hasConflicts) ||
    !Array.isArray(record.changedFiles) ||
    !record.changedFiles.every((file) => isString(file)) ||
    (record.defaultBaseBranchName !== null && !isString(record.defaultBaseBranchName))
  ) {
    return null;
  }

  return {
    coordinationId: record.coordinationId,
    workspaceMode: record.workspaceMode,
    branchName: record.branchName,
    headCommit: isString(record.headCommit) ? record.headCommit : null,
    worktreePath: isString(record.worktreePath) ? record.worktreePath : null,
    upstreamBranchName: record.upstreamBranchName,
    isDirty: record.isDirty,
    aheadCount: record.aheadCount,
    behindCount: record.behindCount,
    insertedLineCount: isNumber(record.insertedLineCount) ? record.insertedLineCount : 0,
    deletedLineCount: isNumber(record.deletedLineCount) ? record.deletedLineCount : 0,
    hasConflicts: record.hasConflicts,
    changedFiles: [...record.changedFiles],
    defaultBaseBranchName: record.defaultBaseBranchName,
  };
};

const parseOrchestrationPullRequest = (
  payload: ParsedValue,
): CoordinationPullRequestSnapshot | null => {
  const record = asRecord(payload);

  if (!record) {
    return null;
  }

  if (
    !isString(record.coordinationId) ||
    (record.workspaceMode !== "shared" && record.workspaceMode !== "worktree") ||
    (record.status !== "none" &&
      record.status !== "open" &&
      record.status !== "merged" &&
      record.status !== "closed") ||
    (record.number !== null && !isNumber(record.number)) ||
    (record.url !== null && !isString(record.url)) ||
    (record.title !== null && !isString(record.title)) ||
    (record.baseRef !== null && !isString(record.baseRef)) ||
    (record.headRef !== null && !isString(record.headRef)) ||
    (record.isDraft !== null && !isBoolean(record.isDraft)) ||
    (record.mergeable !== null &&
      record.mergeable !== "MERGEABLE" &&
      record.mergeable !== "CONFLICTING" &&
      record.mergeable !== "UNKNOWN") ||
    (record.mergeStateStatus !== null && !isString(record.mergeStateStatus))
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

export const useOrchestrationGitLifecycle = ({
  columns,
}: UseOrchestrationGitLifecycleOptions): UseOrchestrationGitLifecycleResult => {
  const [gitStatusByOrchestrationId, setGitStatusByOrchestrationId] = useState<
    Record<string, CoordinationGitStatusSnapshot>
  >({});

  const [gitStatusLoadingByOrchestrationId, setGitStatusLoadingByOrchestrationId] = useState<
    Record<string, boolean>
  >({});

  const [pullRequestByOrchestrationId, setPullRequestByOrchestrationId] = useState<
    Record<string, CoordinationPullRequestSnapshot>
  >({});

  const [pullRequestLoadingByOrchestrationId, setPullRequestLoadingByOrchestrationId] = useState<
    Record<string, boolean>
  >({});

  const gitStatusAttemptedIdsRef = useRef(new Set<string>());
  const pullRequestAttemptedIdsRef = useRef(new Set<string>());
  const [prunedForColumns, setPrunedForColumns] = useState(columns);

  const [openGitOrchestrationId, setOpenGitOrchestrationId] = useState<string | null>(null);
  const [gitCommitMessageDraft, setGitCommitMessageDraft] = useState("");
  const [gitDialogError, setGitDialogError] = useState<string | null>(null);
  const [isGitDialogMutating, setIsGitDialogMutating] = useState(false);

  const fetchOrchestrationGitStatus = useCallback(async (coordinationId: string) => {
    setGitStatusLoadingByOrchestrationId((current) => ({
      ...current,
      [coordinationId]: true,
    }));

    try {
      const response = await fetch(buildOrchestrationGitStatusUrl(coordinationId), {
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

      const payload = parseOrchestrationGitStatus(await response.json());

      if (!payload) {
        throw new Error("Unable to parse git status response.");
      }

      setGitStatusByOrchestrationId((current) => ({
        ...current,
        [coordinationId]: payload,
      }));

      return payload;
    } finally {
      setGitStatusLoadingByOrchestrationId((current) => ({
        ...current,
        [coordinationId]: false,
      }));
    }
  }, []);

  const fetchOrchestrationPullRequest = useCallback(async (coordinationId: string) => {
    setPullRequestLoadingByOrchestrationId((current) => ({
      ...current,
      [coordinationId]: true,
    }));

    try {
      const response = await fetch(buildOrchestrationGitPullRequestUrl(coordinationId), {
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

      const payload = parseOrchestrationPullRequest(await response.json());

      if (!payload) {
        throw new Error("Unable to parse pull request response.");
      }

      setPullRequestByOrchestrationId((current) => ({
        ...current,
        [coordinationId]: payload,
      }));

      return payload;
    } finally {
      setPullRequestLoadingByOrchestrationId((current) => ({
        ...current,
        [coordinationId]: false,
      }));
    }
  }, []);

  const worktreeOrchestrationIds = useMemo(
    () =>
      columns
        .filter((column) => column.workspaceMode === "worktree")
        .map((column) => column.coordinationId),
    [columns],
  );

  if (prunedForColumns !== columns) {
    const activeOrchestrationIds = new Set(columns.map((column) => column.coordinationId));

    const keepActive = <T>(current: Record<string, T>): Record<string, T> =>
      Object.fromEntries(
        Object.entries(current).filter(([coordinationId]) =>
          activeOrchestrationIds.has(coordinationId),
        ),
      );

    setPrunedForColumns(columns);
    setGitStatusByOrchestrationId(keepActive);
    setGitStatusLoadingByOrchestrationId(keepActive);
    setPullRequestByOrchestrationId(keepActive);
    setPullRequestLoadingByOrchestrationId(keepActive);

    if (openGitOrchestrationId && !activeOrchestrationIds.has(openGitOrchestrationId)) {
      setOpenGitOrchestrationId(null);
      setGitDialogError(null);
      setGitCommitMessageDraft("");
    }
  }

  useEffect(() => {
    const activeOrchestrationIds = new Set(columns.map((column) => column.coordinationId));

    for (const attemptedIds of [
      gitStatusAttemptedIdsRef.current,
      pullRequestAttemptedIdsRef.current,
    ]) {
      for (const coordinationId of attemptedIds) {
        if (!activeOrchestrationIds.has(coordinationId)) {
          attemptedIds.delete(coordinationId);
        }
      }
    }
  }, [columns]);

  useEffect(() => {
    const gitStatusAttemptedIds = gitStatusAttemptedIdsRef.current;
    const pullRequestAttemptedIds = pullRequestAttemptedIdsRef.current;

    for (const coordinationId of worktreeOrchestrationIds) {
      if (!gitStatusAttemptedIds.has(coordinationId)) {
        gitStatusAttemptedIds.add(coordinationId);
        void fetchOrchestrationGitStatus(coordinationId).catch((cause: unknown) => {
          console.warn(`[git] Failed to fetch status for orchestration ${coordinationId}:`, cause);
        });
      }

      if (!pullRequestAttemptedIds.has(coordinationId)) {
        pullRequestAttemptedIds.add(coordinationId);
        void fetchOrchestrationPullRequest(coordinationId).catch((cause: unknown) => {
          console.warn(
            `[git] Failed to fetch pull request for orchestration ${coordinationId}:`,
            cause,
          );
        });
      }
    }
  }, [fetchOrchestrationGitStatus, fetchOrchestrationPullRequest, worktreeOrchestrationIds]);

  const openOrchestrationGitActions = useCallback(
    (coordinationId: string) => {
      setOpenGitOrchestrationId(coordinationId);
      setGitDialogError(null);
      setGitCommitMessageDraft("");

      void Promise.all([
        fetchOrchestrationGitStatus(coordinationId),
        fetchOrchestrationPullRequest(coordinationId),
      ]).catch((cause: unknown) => {
        setGitDialogError(
          cause instanceof Error ? cause.message : "Unable to fetch git lifecycle data.",
        );
      });
    },
    [fetchOrchestrationGitStatus, fetchOrchestrationPullRequest],
  );

  const closeOrchestrationGitActions = useCallback(() => {
    setOpenGitOrchestrationId(null);
    setGitDialogError(null);
    setGitCommitMessageDraft("");
  }, []);

  const runGitMutation = useCallback(
    async (
      action: "commit" | "push" | "sync",
      request: { body?: string; headers?: Record<string, string> } = {},
    ): Promise<CoordinationGitStatusSnapshot | null> => {
      if (!openGitOrchestrationId) {
        return null;
      }

      const endpoint =
        action === "commit"
          ? buildOrchestrationGitCommitUrl(openGitOrchestrationId)
          : action === "push"
            ? buildOrchestrationGitPushUrl(openGitOrchestrationId)
            : buildOrchestrationGitSyncUrl(openGitOrchestrationId);

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

        const payload = parseOrchestrationGitStatus(await response.json());

        if (!payload) {
          throw new Error("Unable to parse git lifecycle response.");
        }

        setGitStatusByOrchestrationId((current) => ({
          ...current,
          [openGitOrchestrationId]: payload,
        }));

        return payload;
      } catch (error) {
        setGitDialogError(
          error instanceof Error ? error.message : `Unable to ${action} orchestration worktree.`,
        );

        return null;
      } finally {
        setIsGitDialogMutating(false);
      }
    },
    [openGitOrchestrationId],
  );

  const runPullRequestMutation = useCallback(
    async (request: { body?: string; headers?: Record<string, string> } = {}) => {
      if (!openGitOrchestrationId) {
        return;
      }

      const endpoint = buildOrchestrationGitPullRequestMergeUrl(openGitOrchestrationId);

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

        const payload = parseOrchestrationPullRequest(await response.json());

        if (!payload) {
          throw new Error("Unable to parse pull request response.");
        }

        setPullRequestByOrchestrationId((current) => ({
          ...current,
          [openGitOrchestrationId]: payload,
        }));
      } catch (error) {
        setGitDialogError(error instanceof Error ? error.message : "Unable to merge pull request.");
      } finally {
        setIsGitDialogMutating(false);
      }
    },
    [openGitOrchestrationId],
  );

  const commitOrchestrationChanges = useCallback(async () => {
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

  const commitAndPushOrchestrationBranch = useCallback(async () => {
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

  const pushOrchestrationBranch = useCallback(async () => {
    await runGitMutation("push");
  }, [runGitMutation]);

  const syncOrchestrationBranch = useCallback(async () => {
    await runGitMutation("sync");
  }, [runGitMutation]);

  const mergeOrchestrationPullRequest = useCallback(async () => {
    await runPullRequestMutation();
  }, [runPullRequestMutation]);

  const openGitOrchestrationStatus =
    openGitOrchestrationId !== null
      ? (gitStatusByOrchestrationId[openGitOrchestrationId] ?? null)
      : null;

  const openGitOrchestrationPullRequest =
    openGitOrchestrationId !== null
      ? (pullRequestByOrchestrationId[openGitOrchestrationId] ?? null)
      : null;

  const isGitDialogLoading =
    openGitOrchestrationId !== null
      ? (gitStatusLoadingByOrchestrationId[openGitOrchestrationId] ?? false) ||
        (pullRequestLoadingByOrchestrationId[openGitOrchestrationId] ?? false)
      : false;

  return {
    gitStatusByOrchestrationId,
    gitStatusLoadingByOrchestrationId,
    pullRequestByOrchestrationId,
    pullRequestLoadingByOrchestrationId,
    openGitOrchestrationId,
    openGitOrchestrationStatus,
    openGitOrchestrationPullRequest,
    gitCommitMessageDraft,
    gitDialogError,
    isGitDialogLoading,
    isGitDialogMutating,
    setGitCommitMessageDraft,
    openOrchestrationGitActions,
    closeOrchestrationGitActions,
    commitOrchestrationChanges,
    commitAndPushOrchestrationBranch,
    pushOrchestrationBranch,
    syncOrchestrationBranch,
    mergeOrchestrationPullRequest,
  };
};
