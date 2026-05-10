import { useCallback, useEffect, useState } from "react";
import { buildCouplingData, buildTreemapTree, } from "../codeIntelAggregation";
export const useCodeIntelRuntime = (enabled) => {
    const [events, setEvents] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const fetchEvents = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch("/api/code-intel/events");
            if (!response.ok) {
                setError(`Failed to load events: ${response.status}`);
                return;
            }
            const data = (await response.json());
            setEvents(data.events);
        }
        catch {
            setError("Failed to connect to API");
        }
        finally {
            setIsLoading(false);
        }
    }, []);
    useEffect(() => {
        if (!enabled)
            return;
        void fetchEvents();
    }, [enabled, fetchEvents]);
    // Derive workspace cwd from common prefix of file paths
    const workspaceCwd = events.length > 0 ? deriveWorkspaceCwd(events.map((e) => e.file)) : "";
    const treemapRoot = events.length > 0 ? buildTreemapTree(events, workspaceCwd) : null;
    const couplingData = events.length > 0 ? buildCouplingData(events, workspaceCwd) : null;
    return {
        events,
        treemapRoot,
        couplingData,
        isLoading,
        error,
        refresh: () => {
            void fetchEvents();
        },
    };
};
/** Find the longest common directory prefix across all file paths. */
const deriveWorkspaceCwd = (paths) => {
    const [firstPath] = paths;
    if (!firstPath)
        return "";
    const parts = firstPath.split("/");
    let prefix = "";
    for (let i = 0; i < parts.length - 1; i++) {
        const candidate = parts.slice(0, i + 1).join("/");
        if (paths.every((p) => p.startsWith(`${candidate}/`))) {
            prefix = candidate;
        }
        else {
            break;
        }
    }
    return prefix;
};
