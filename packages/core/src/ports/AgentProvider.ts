import type { ActionOutcome } from "./ActionPorts";

export interface AgentRunRequest {
  readonly goal: string;
  /** Files the agent reads for context, such as CONTEXT.md and the spec. */
  readonly contextFiles: readonly string[];
}

export type AgentEvent =
  | { readonly type: "message"; readonly text: string }
  | {
      readonly type: "action";
      readonly callId: string;
      readonly actionId: string;
      readonly input: unknown;
    }
  | { readonly type: "done"; readonly summary: string };

/** One running agent. Adapters (Claude Code, OpenCode, a PTY terminal) implement this. */
export interface AgentSession {
  events(): AsyncIterable<AgentEvent>;
  respond(callId: string, outcome: ActionOutcome): Promise<void>;
  stop(): Promise<void>;
}

export interface AgentProvider {
  readonly id: string;
  start(request: AgentRunRequest): Promise<AgentSession>;
}
