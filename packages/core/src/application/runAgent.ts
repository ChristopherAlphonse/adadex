import type { ActionExecutor, ActionOutcome, ApprovalGate } from "../ports/ActionPorts";
import type { AgentProvider, AgentRunRequest } from "../ports/AgentProvider";
import { type ActionRegistry, authorize } from "./actionRegistry";

export interface RunAgentDeps {
  readonly provider: AgentProvider;
  readonly registry: ActionRegistry;
  readonly executor: ActionExecutor;
  readonly approvals: ApprovalGate;
  /** Called when the agent asked for a human-only action, so the UI can show the button for a person to press. */
  readonly onNeedsHumanClick?: (actionId: string, reason: string) => void;
}

export interface CallRecord {
  readonly callId: string;
  readonly actionId: string;
  readonly outcome: ActionOutcome;
}

export interface AgentRunResult {
  readonly summary: string;
  readonly calls: readonly CallRecord[];
}

const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : "action failed");

const execute = async (
  executor: ActionExecutor,
  actionId: string,
  input: unknown,
): Promise<ActionOutcome> => {
  try {
    return { status: "ok", output: await executor.execute(actionId, input) };
  } catch (e) {
    return { status: "error", message: errorMessage(e) };
  }
};

const decide = async (
  deps: RunAgentDeps,
  actionId: string,
  rawInput: unknown,
): Promise<ActionOutcome> => {
  const first = authorize(deps.registry, actionId, rawInput, { caller: "agent" });
  if (first.kind === "run") return execute(deps.executor, actionId, first.input);
  if (first.kind === "deny") return { status: "denied", reason: first.reason };
  if (first.kind === "needs-human-click")
    return { status: "needs-human-click", reason: first.reason };

  const approved = await deps.approvals.request(actionId, first.reason);
  if (!approved) return { status: "denied", reason: "not approved" };
  const second = authorize(deps.registry, actionId, rawInput, {
    caller: "agent",
    approvedActionId: actionId,
  });
  return second.kind === "run"
    ? execute(deps.executor, actionId, second.input)
    : { status: "denied", reason: "not approved" };
};

/**
 * Drives one agent: every action it asks for goes through the registry, so policy decides whether it runs,
 * waits for approval, needs a human click, or is refused. The agent is always told the outcome.
 */
export const runAgent = async (
  deps: RunAgentDeps,
  request: AgentRunRequest,
): Promise<AgentRunResult> => {
  const session = await deps.provider.start(request);
  const calls: CallRecord[] = [];
  let summary = "";
  try {
    for await (const event of session.events()) {
      if (event.type === "done") {
        summary = event.summary;
        break;
      }
      if (event.type !== "action") continue;
      const outcome = await decide(deps, event.actionId, event.input);
      calls.push({ callId: event.callId, actionId: event.actionId, outcome });
      await session.respond(event.callId, outcome);
    }
  } finally {
    await session.stop();
  }
  return { summary, calls };
};
