import { type AgentRuntimeState, isAgentRuntimeState } from "@adadex/core";
import { StatusBadge, type StatusBadgeTone } from "./ui/StatusBadge";

export type { AgentRuntimeState } from "@adadex/core";
export { isAgentRuntimeState } from "@adadex/core";

type AgentStateBadgeProps = {
  state: AgentRuntimeState;
};

const stateLabel = (state: AgentRuntimeState): string => {
  switch (state) {
    case "waiting_for_permission":
      return "PERMISSION";
    case "waiting_for_user":
      return "WAITING";
    default:
      return state.toUpperCase();
  }
};

const stateTone = (state: AgentRuntimeState): StatusBadgeTone => {
  switch (state) {
    case "waiting_for_permission":
    case "waiting_for_user":
      return "warning";
    default:
      return state;
  }
};

export const AgentStateBadge = ({ state }: AgentStateBadgeProps) => (
  <StatusBadge
    className="terminal-state-badge"
    label={stateLabel(state)}
    compactLabel={
      state === "waiting_for_permission"
        ? "PERM"
        : state === "waiting_for_user"
          ? "WAIT"
          : state === "processing"
            ? "PROC"
            : state.toUpperCase()
    }
    tone={stateTone(state)}
  />
);
