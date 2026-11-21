import { isString } from "@adadex/core";
import type { WorkspaceSetupSnapshot, WorkspaceSetupStepId } from "@adadex/core";
import { useCallback, useEffect, useRef, useState } from "react";

import { buildWorkspaceSetupStepUrl, buildWorkspaceSetupUrl } from "../../runtime/runtimeEndpoints";

type UseWorkspaceSetupResult = {
  workspaceSetup: WorkspaceSetupSnapshot | null;
  isWorkspaceSetupLoading: boolean;
  workspaceSetupError: string | null;
  refreshWorkspaceSetup: () => Promise<WorkspaceSetupSnapshot | null>;
  runWorkspaceSetupStep: (stepId: WorkspaceSetupStepId) => Promise<WorkspaceSetupSnapshot | null>;
};

const readErrorMessage = async (response: Response, fallback: string) => {
  try {
    const payload =
      /* SAFETY: preceding checks establish the invariant this assertion encodes. */ (await response.json()) as {
        error?: unknown;
      };

    return isString(payload.error) ? payload.error : fallback;
  } catch {
    return fallback;
  }
};

export const useWorkspaceSetup = (): UseWorkspaceSetupResult => {
  const [workspaceSetup, setWorkspaceSetup] = useState<WorkspaceSetupSnapshot | null>(null);
  const [isWorkspaceSetupLoading, setIsWorkspaceSetupLoading] = useState(true);
  const [workspaceSetupError, setWorkspaceSetupError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const refreshWorkspaceSetup = useCallback(async () => {
    try {
      setWorkspaceSetupError(null);

      const response = await fetch(buildWorkspaceSetupUrl(), {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Unable to load workspace setup."));
      }

      const payload =
        /* SAFETY: preceding checks establish the invariant this assertion encodes. */ (await response.json()) as WorkspaceSetupSnapshot;

      setWorkspaceSetup(payload);

      return payload;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load workspace setup.";
      setWorkspaceSetupError(message);

      return null;
    } finally {
      setIsWorkspaceSetupLoading(false);
    }
  }, []);

  const runWorkspaceSetupStep = useCallback(async (stepId: WorkspaceSetupStepId) => {
    try {
      setWorkspaceSetupError(null);

      const response = await fetch(buildWorkspaceSetupStepUrl(stepId), {
        method: "POST",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, `Unable to run ${stepId}.`));
      }

      const payload =
        /* SAFETY: preceding checks establish the invariant this assertion encodes. */ (await response.json()) as WorkspaceSetupSnapshot;

      setWorkspaceSetup(payload);

      return payload;
    } catch (error) {
      const message = error instanceof Error ? error.message : `Unable to run ${stepId}.`;
      setWorkspaceSetupError(message);

      return null;
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      void refreshWorkspaceSetup();
    }
  }, [refreshWorkspaceSetup]);

  return {
    workspaceSetup,
    isWorkspaceSetupLoading,
    workspaceSetupError,
    refreshWorkspaceSetup,
    runWorkspaceSetupStep,
  };
};
