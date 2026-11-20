import {
  type ActionExecutor,
  type ActionOutcome,
  type ActionRegistry,
  type ApprovalGate,
  authorize,
} from "@adadex/core";

/** Shown by the main process as a native OS dialog. Web content cannot click it. */
export type NativeConfirm = (title: string, detail: string) => Promise<boolean>;

export type HostEvent =
  | { readonly type: "needs-click"; readonly actionId: string; readonly reason: string }
  | { readonly type: "approval-requested"; readonly actionId: string; readonly reason: string }
  | {
      readonly type: "ran";
      readonly actionId: string;
      readonly caller: "ui" | "agent";
      readonly outcome: ActionOutcome;
    };

export interface ActionHostDeps {
  readonly registry: ActionRegistry;
  readonly executor: ActionExecutor;
  readonly confirm: NativeConfirm;
  /** How the UI shows an approval card for an agent's `ask` action. */
  readonly askApproval: ApprovalGate;
  readonly emit: (event: HostEvent) => void;
}

export type HostResult =
  | { readonly status: "ok"; readonly output: unknown }
  | { readonly status: "denied"; readonly reason: string }
  | { readonly status: "declined" }
  | { readonly status: "error"; readonly message: string };

export interface AgentPorts {
  readonly executor: ActionExecutor;
  readonly approvals: ApprovalGate;
  readonly onNeedsHumanClick: (actionId: string, reason: string) => void;
}

export interface ActionHost {
  /** A button press in the UI. */
  fromUi(actionId: string, input: unknown): Promise<HostResult>;
  /** The ports `runAgent` needs, so an agent's calls go through the same registry and policy. */
  agentPorts(): AgentPorts;
}

const message = (e: unknown): string => (e instanceof Error ? e.message : "action failed");

/**
 * The only place a request becomes a run, and the only place a human click is made. A human-only action
 * is confirmed with a native dialog here. The UI and agents can ask for one but cannot supply the click.
 */
export const createActionHost = (deps: ActionHostDeps): ActionHost => {
  const run = async (
    caller: "ui" | "agent",
    actionId: string,
    input: unknown,
  ): Promise<HostResult> => {
    let result: HostResult;
    try {
      result = { status: "ok", output: await deps.executor.execute(actionId, input) };
    } catch (e) {
      result = { status: "error", message: message(e) };
    }
    const outcome: ActionOutcome =
      result.status === "ok"
        ? { status: "ok", output: result.output }
        : { status: "error", message: result.status === "error" ? result.message : "" };
    deps.emit({ type: "ran", actionId, caller, outcome });
    return result;
  };

  const fromUi = async (actionId: string, rawInput: unknown): Promise<HostResult> => {
    const def = deps.registry.get(actionId);
    if (!def) return { status: "denied", reason: `unknown action ${actionId}` };

    let ctx = { caller: "human" } as Parameters<typeof authorize>[3];
    if (def.class === "human") {
      const ok = await deps.confirm(def.title, `Run "${def.title}" now?`);
      if (!ok) return { status: "declined" };
      ctx = { caller: "human", humanClick: { actionId } };
    }
    const decision = authorize(deps.registry, actionId, rawInput, ctx);
    if (decision.kind === "run") return run("ui", actionId, decision.input);
    return { status: "denied", reason: decision.reason };
  };

  const agentPorts = (): AgentPorts => ({
    executor: {
      execute: async (actionId, input) => {
        // Defense in depth: even if a caller skipped the registry, an agent never runs a human-only action.
        if (
          deps.registry.get(actionId)?.class !== "free" &&
          deps.registry.get(actionId)?.class !== "ask"
        ) {
          throw new Error(`${actionId} is not available to an agent`);
        }
        const r = await run("agent", actionId, input);
        if (r.status === "ok") return r.output;
        throw new Error(r.status === "error" ? r.message : "not run");
      },
    },
    approvals: {
      request: async (actionId, reason) => {
        deps.emit({ type: "approval-requested", actionId, reason });
        return deps.askApproval.request(actionId, reason);
      },
    },
    onNeedsHumanClick: (actionId, reason) => deps.emit({ type: "needs-click", actionId, reason }),
  });

  return { fromUi, agentPorts };
};
