import { useCallback, useEffect, useMemo, useState } from "react";
import { buildOrchestrationGitCommitUrl, buildOrchestrationGitPullRequestMergeUrl, buildOrchestrationGitPullRequestUrl, buildOrchestrationGitPushUrl, buildOrchestrationGitStatusUrl, buildOrchestrationGitSyncUrl, } from "../../runtime/runtimeEndpoints";
const parseGitError = async (response, fallback) => {
    try {
        const payload = (await response.json());
        if (typeof payload.error === "string" && payload.error.trim().length > 0) {
            return payload.error.trim();
        }
    }
    catch {
        return fallback;
    }
    return fallback;
};
const parseOrchestrationGitStatus = (payload) => {
    if (payload === null || payload === undefined || typeof payload !== "object") {
        return null;
    }
    const record = payload;
    if (typeof record.coordinationId !== "string" ||
        (record.workspaceMode !== "shared" && record.workspaceMode !== "worktree") ||
        typeof record.branchName !== "string" ||
        (record.upstreamBranchName !== null && typeof record.upstreamBranchName !== "string") ||
        typeof record.isDirty !== "boolean" ||
        typeof record.aheadCount !== "number" ||
        typeof record.behindCount !== "number" ||
        typeof record.hasConflicts !== "boolean" ||
        !Array.isArray(record.changedFiles) ||
        !record.changedFiles.every((file) => typeof file === "string") ||
        (record.defaultBaseBranchName !== null && typeof record.defaultBaseBranchName !== "string")) {
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
const parseOrchestrationPullRequest = (payload) => {
    if (payload === null || payload === undefined || typeof payload !== "object") {
        return null;
    }
    const record = payload;
    if (typeof record.coordinationId !== "string" ||
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
        (record.mergeStateStatus !== null && typeof record.mergeStateStatus !== "string")) {
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
export const useOrchestrationGitLifecycle = ({ columns, }) => {
    const [gitStatusByOrchestrationId, setGitStatusByOrchestrationId] = useState({});
    const [gitStatusLoadingByOrchestrationId, setGitStatusLoadingByOrchestrationId] = useState({});
    const [gitStatusAttemptedOrchestrationIds, setGitStatusAttemptedOrchestrationIds] = useState({});
    const [pullRequestByOrchestrationId, setPullRequestByOrchestrationId] = useState({});
    const [pullRequestLoadingByOrchestrationId, setPullRequestLoadingByOrchestrationId] = useState({});
    const [pullRequestAttemptedOrchestrationIds, setPullRequestAttemptedOrchestrationIds] = useState({});
    const [openGitOrchestrationId, setOpenGitOrchestrationId] = useState(null);
    const [gitCommitMessageDraft, setGitCommitMessageDraft] = useState("");
    const [gitDialogError, setGitDialogError] = useState(null);
    const [isGitDialogMutating, setIsGitDialogMutating] = useState(false);
    const fetchOrchestrationGitStatus = useCallback(async (coordinationId) => {
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
                const errorMessage = await parseGitError(response, `Unable to fetch git status (${response.status}).`);
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
        }
        finally {
            setGitStatusLoadingByOrchestrationId((current) => ({
                ...current,
                [coordinationId]: false,
            }));
        }
    }, []);
    const fetchOrchestrationPullRequest = useCallback(async (coordinationId) => {
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
                const errorMessage = await parseGitError(response, `Unable to fetch pull request status (${response.status}).`);
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
        }
        finally {
            setPullRequestLoadingByOrchestrationId((current) => ({
                ...current,
                [coordinationId]: false,
            }));
        }
    }, []);
    const worktreeOrchestrationIds = useMemo(() => columns
        .filter((column) => column.workspaceMode === "worktree")
        .map((column) => column.coordinationId), [columns]);
    useEffect(() => {
        const activeOrchestrationIds = new Set(columns.map((column) => column.coordinationId));
        setGitStatusByOrchestrationId((current) => Object.fromEntries(Object.entries(current).filter(([coordinationId]) => activeOrchestrationIds.has(coordinationId))));
        setGitStatusLoadingByOrchestrationId((current) => Object.fromEntries(Object.entries(current).filter(([coordinationId]) => activeOrchestrationIds.has(coordinationId))));
        setGitStatusAttemptedOrchestrationIds((current) => Object.fromEntries(Object.entries(current).filter(([coordinationId]) => activeOrchestrationIds.has(coordinationId))));
        setPullRequestByOrchestrationId((current) => Object.fromEntries(Object.entries(current).filter(([coordinationId]) => activeOrchestrationIds.has(coordinationId))));
        setPullRequestLoadingByOrchestrationId((current) => Object.fromEntries(Object.entries(current).filter(([coordinationId]) => activeOrchestrationIds.has(coordinationId))));
        setPullRequestAttemptedOrchestrationIds((current) => Object.fromEntries(Object.entries(current).filter(([coordinationId]) => activeOrchestrationIds.has(coordinationId))));
        if (openGitOrchestrationId && !activeOrchestrationIds.has(openGitOrchestrationId)) {
            setOpenGitOrchestrationId(null);
            setGitDialogError(null);
            setGitCommitMessageDraft("");
        }
    }, [columns, openGitOrchestrationId]);
    useEffect(() => {
        for (const coordinationId of worktreeOrchestrationIds) {
            if (gitStatusAttemptedOrchestrationIds[coordinationId]) {
                continue;
            }
            setGitStatusAttemptedOrchestrationIds((current) => ({
                ...current,
                [coordinationId]: true,
            }));
            void fetchOrchestrationGitStatus(coordinationId).catch((error) => {
                console.warn(`[git] Failed to fetch status for orchestration ${coordinationId}:`, error);
            });
        }
    }, [fetchOrchestrationGitStatus, gitStatusAttemptedOrchestrationIds, worktreeOrchestrationIds]);
    useEffect(() => {
        for (const coordinationId of worktreeOrchestrationIds) {
            if (pullRequestAttemptedOrchestrationIds[coordinationId]) {
                continue;
            }
            setPullRequestAttemptedOrchestrationIds((current) => ({
                ...current,
                [coordinationId]: true,
            }));
            void fetchOrchestrationPullRequest(coordinationId).catch((error) => {
                console.warn(`[git] Failed to fetch pull request for orchestration ${coordinationId}:`, error);
            });
        }
    }, [
        fetchOrchestrationPullRequest,
        pullRequestAttemptedOrchestrationIds,
        worktreeOrchestrationIds,
    ]);
    const openOrchestrationGitActions = useCallback((coordinationId) => {
        setOpenGitOrchestrationId(coordinationId);
        setGitDialogError(null);
        setGitCommitMessageDraft("");
        void Promise.all([
            fetchOrchestrationGitStatus(coordinationId),
            fetchOrchestrationPullRequest(coordinationId),
        ]).catch((error) => {
            setGitDialogError(error instanceof Error ? error.message : "Unable to fetch git lifecycle data.");
        });
    }, [fetchOrchestrationGitStatus, fetchOrchestrationPullRequest]);
    const closeOrchestrationGitActions = useCallback(() => {
        setOpenGitOrchestrationId(null);
        setGitDialogError(null);
        setGitCommitMessageDraft("");
    }, []);
    const runGitMutation = useCallback(async (action, request = {}) => {
        if (!openGitOrchestrationId) {
            return null;
        }
        const endpoint = action === "commit"
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
                const errorMessage = await parseGitError(response, `Unable to ${action} (${response.status}).`);
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
        }
        catch (error) {
            setGitDialogError(error instanceof Error ? error.message : `Unable to ${action} orchestration worktree.`);
            return null;
        }
        finally {
            setIsGitDialogMutating(false);
        }
    }, [openGitOrchestrationId]);
    const runPullRequestMutation = useCallback(async (request = {}) => {
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
                const errorMessage = await parseGitError(response, `Unable to merge pull request (${response.status}).`);
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
        }
        catch (error) {
            setGitDialogError(error instanceof Error ? error.message : "Unable to merge pull request.");
        }
        finally {
            setIsGitDialogMutating(false);
        }
    }, [openGitOrchestrationId]);
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
    const openGitOrchestrationStatus = openGitOrchestrationId !== null
        ? (gitStatusByOrchestrationId[openGitOrchestrationId] ?? null)
        : null;
    const openGitOrchestrationPullRequest = openGitOrchestrationId !== null
        ? (pullRequestByOrchestrationId[openGitOrchestrationId] ?? null)
        : null;
    const isGitDialogLoading = openGitOrchestrationId !== null
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
