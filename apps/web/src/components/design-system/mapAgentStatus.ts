import type { AgentState } from "@adadex/core";

import type { AgentStatus } from "./types";

export const mapAgentStateToStatus = (state: AgentState | undefined): AgentStatus => {
  if (state === "live") return "running";
  if (state === "stale" || state === "queued" || state === "blocked") return "stale";
  if (state === "stopped" || state === "exited") return "stopped";
  return "idle";
};
