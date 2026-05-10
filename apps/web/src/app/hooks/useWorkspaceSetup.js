import { useCallback, useEffect, useState } from "react";
import { buildWorkspaceSetupStepUrl, buildWorkspaceSetupUrl } from "../../runtime/runtimeEndpoints";
const readErrorMessage = async (response, fallback) => {
    try {
        const payload = (await response.json());
        return typeof payload.error === "string" ? payload.error : fallback;
    }
    catch {
        return fallback;
    }
};
export const useWorkspaceSetup = () => {
    const [workspaceSetup, setWorkspaceSetup] = useState(null);
    const [isWorkspaceSetupLoading, setIsWorkspaceSetupLoading] = useState(true);
    const [workspaceSetupError, setWorkspaceSetupError] = useState(null);
    const refreshWorkspaceSetup = useCallback(async () => {
        try {
            setWorkspaceSetupError(null);
            const response = await fetch(buildWorkspaceSetupUrl(), {
                headers: { Accept: "application/json" },
            });
            if (!response.ok) {
                throw new Error(await readErrorMessage(response, "Unable to load workspace setup."));
            }
            const payload = (await response.json());
            setWorkspaceSetup(payload);
            return payload;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Unable to load workspace setup.";
            setWorkspaceSetupError(message);
            return null;
        }
        finally {
            setIsWorkspaceSetupLoading(false);
        }
    }, []);
    const runWorkspaceSetupStep = useCallback(async (stepId) => {
        try {
            setWorkspaceSetupError(null);
            const response = await fetch(buildWorkspaceSetupStepUrl(stepId), {
                method: "POST",
                headers: { Accept: "application/json" },
            });
            if (!response.ok) {
                throw new Error(await readErrorMessage(response, `Unable to run ${stepId}.`));
            }
            const payload = (await response.json());
            setWorkspaceSetup(payload);
            return payload;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : `Unable to run ${stepId}.`;
            setWorkspaceSetupError(message);
            return null;
        }
    }, []);
    useEffect(() => {
        void refreshWorkspaceSetup();
    }, [refreshWorkspaceSetup]);
    return {
        workspaceSetup,
        isWorkspaceSetupLoading,
        workspaceSetupError,
        refreshWorkspaceSetup,
        runWorkspaceSetupStep,
    };
};
