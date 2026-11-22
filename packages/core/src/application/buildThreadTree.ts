import type { TerminalSnapshot } from "../domain/terminal";

export type ThreadStatus = "working" | "needs-you" | "done" | "idle";

export type ThreadNode = {
  terminalId: string;
  label: string;
  status: ThreadStatus;
  /** When the agent is waiting on the user: to approve a tool call, or to answer. Null otherwise. */
  waitingFor: "approval" | "answer" | null;
  createdAt: string;
  children: ThreadNode[];
};

/** What a person should read off a terminal: is it working, waiting on them, finished, or just idle. */
export const threadStatusOf = (terminal: TerminalSnapshot): ThreadStatus => {
  if (terminal.lifecycleState === "stopped" || terminal.lifecycleState === "exited") {
    return "done";
  }

  if (
    terminal.agentRuntimeState === "waiting_for_user" ||
    terminal.agentRuntimeState === "waiting_for_permission"
  ) {
    return "needs-you";
  }

  if (terminal.agentRuntimeState === "processing") {
    return "working";
  }

  return "idle";
};

/**
 * Terminals as a tree: a terminal whose `parentTerminalId` names another listed terminal is its child.
 * Roots keep the order given; children follow their parent in the order given. A parent that is not listed
 * leaves its children as roots, so nothing disappears.
 */
export const buildThreadTree = (terminals: readonly TerminalSnapshot[]): ThreadNode[] => {
  const listed = new Set(terminals.map((terminal) => terminal.terminalId));
  const nodes = new Map<string, ThreadNode>();

  for (const terminal of terminals) {
    nodes.set(terminal.terminalId, {
      terminalId: terminal.terminalId,
      label: terminal.label,
      status: threadStatusOf(terminal),
      waitingFor:
        terminal.agentRuntimeState === "waiting_for_permission"
          ? "approval"
          : terminal.agentRuntimeState === "waiting_for_user"
            ? "answer"
            : null,
      createdAt: terminal.createdAt,
      children: [],
    });
  }

  const roots: ThreadNode[] = [];

  for (const terminal of terminals) {
    const node = nodes.get(terminal.terminalId);

    const parent =
      terminal.parentTerminalId && terminal.parentTerminalId !== terminal.terminalId
        ? nodes.get(terminal.parentTerminalId)
        : undefined;

    if (node && parent && listed.has(terminal.parentTerminalId ?? "")) {
      parent.children.push(node);
    } else if (node) {
      roots.push(node);
    }
  }

  return roots;
};
