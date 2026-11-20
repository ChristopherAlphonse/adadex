import type { ActionContext, AuthorizeResult } from "../domain/action";
import type {
  ActionExecutor,
  ActionOutcome,
  ActionInput,
  ApprovalGate,
} from "../ports/ActionPorts";
import type { AgentProvider, AgentRunRequest } from "../ports/AgentProvider";
import {
  isBoolean,
  isNumber,
  isParsedRecord,
  isString,
  type ParsedValue,
} from "../util/typeCoercion";
import { type ActionRegistry, authorize } from "./actionRegistry";

export interface RunAgentDeps {
  readonly provider: AgentProvider;
  readonly registry: ActionRegistry;
  readonly executor: ActionExecutor;
  readonly approvals: ApprovalGate;
  /** Called when the agent asked for a human-only action, so the UI can show the button for a person to press. */
  readonly onNeedsHumanClick?: (actionId: string, reason: string) => void;
  /** Replaces the plain registry check, so a run can be limited to the actions of its role. `approved` is true once a person said yes. */
  readonly authorize?: (actionId: string, input: ActionInput, approved: boolean) => AuthorizeResult;
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

const errorMessage = (cause: unknown): string =>
  cause instanceof Error ? cause.message : "action failed";

/** Agent calls arrive as JSON; anything else cannot be handed to an action parser. */
const isParsedInput = (value: unknown): value is ParsedValue => {
  if (value === null || isString(value) || isNumber(value) || isBoolean(value)) return true;

  if (Array.isArray(value)) return value.every(isParsedInput);

  return isParsedRecord(value) && Object.values(value).every(isParsedInput);
};

const execute = async (
  executor: ActionExecutor,
  actionId: string,
  input: ActionInput,
): Promise<ActionOutcome> => {
  try {
    return { status: "ok", output: await executor.execute(actionId, input) };
  } catch (cause) {
    return { status: "error", message: errorMessage(cause) };
  }
};

const decide = async (
  deps: RunAgentDeps,
  actionId: string,
  rawInput: ActionInput,
): Promise<ActionOutcome> => {
  const decideFor = (approved: boolean): AuthorizeResult => {
    if (deps.authorize) return deps.authorize(actionId, rawInput, approved);

    const ctx: ActionContext = approved
      ? { caller: "agent", approvedActionId: actionId }
      : { caller: "agent" };

    return authorize(deps.registry, actionId, rawInput, ctx);
  };

  const first = decideFor(false);

  if (first.kind === "run") return execute(deps.executor, actionId, first.input);

  if (first.kind === "deny") return { status: "denied", reason: first.reason };

  if (first.kind === "needs-human-click") {
    deps.onNeedsHumanClick?.(actionId, first.reason);

    return { status: "needs-human-click", reason: first.reason };
  }

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
      // A value the provider could not have decoded from JSON is treated as missing, so the action's parser denies it.
      const input = isParsedInput(event.input) ? event.input : null;
      const outcome = await decide(deps, event.actionId, input);
      calls.push({ callId: event.callId, actionId: event.actionId, outcome });
      await session.respond(event.callId, outcome);
    }
  } finally {
    await session.stop();
  }

  return { summary, calls };
};
