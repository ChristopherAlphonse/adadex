import type { WorkspaceSetupSnapshot } from "@adadex/core";
import { useEffect, useMemo, useState } from "react";

import { WORKSPACE_SETUP_OVERLAY_STORAGE_KEY } from "../../components/canvas/canvasSupport";

type OverlayState = "expanded" | "minimized" | "hidden";

const isOverlayState = (value: string | null): value is OverlayState =>
  value === "minimized" || value === "hidden" || value === "expanded";

/**
 * The Workspace Setup panel on the canvas: whether it is shown at all, whether it is expanded, a slim bar, or
 * dismissed, and how many steps are still open. It starts as the slim bar and remembers the choice for the session.
 */
export const useWorkspaceSetupOverlay = (
  workspaceSetup: WorkspaceSetupSnapshot | null | undefined,
) => {
  const shouldShow = Boolean(workspaceSetup?.shouldShowSetupCard);

  const [overlay, setOverlay] = useState<OverlayState>(() => {
    if (!shouldShow || typeof sessionStorage === "undefined") {
      return "minimized";
    }

    const raw = sessionStorage.getItem(WORKSPACE_SETUP_OVERLAY_STORAGE_KEY);

    return isOverlayState(raw) ? raw : "minimized";
  });

  const [wasVisible, setWasVisible] = useState(shouldShow);

  if (wasVisible !== shouldShow) {
    setWasVisible(shouldShow);

    if (!shouldShow) {
      setOverlay("minimized");
    }
  }

  const visibleOverlay = shouldShow ? overlay : "expanded";

  const incompleteSteps = useMemo(
    () => (workspaceSetup?.steps ?? []).filter((step) => !step.complete).length,
    [workspaceSetup],
  );

  useEffect(() => {
    if (!shouldShow) {
      sessionStorage.removeItem(WORKSPACE_SETUP_OVERLAY_STORAGE_KEY);

      return;
    }

    sessionStorage.setItem(WORKSPACE_SETUP_OVERLAY_STORAGE_KEY, visibleOverlay);
  }, [shouldShow, visibleOverlay]);

  return { shouldShow, overlay: visibleOverlay, setOverlay, incompleteSteps };
};
