import { Minus, X } from "lucide-react";
import { type Ref, useCallback, useState } from "react";

import type { GraphNode } from "../../app/canvas/types";
import type { TerminalView } from "../../app/types";
import { type AgentRuntimeState, AgentStateBadge } from "../AgentStateBadge";
import { Terminal } from "../Terminal";

type CanvasTerminalColumnProps = {
  node: GraphNode;
  terminals: TerminalView;
  layoutVersion?: string | number;
  isFocused?: boolean;
  onMinimize: () => void;
  onClose: () => void;
  onFocus?: () => void;
  panelRef?: Ref<HTMLElement> | undefined;
  onTerminalRenamed?: ((terminalId: string, coordinationName: string) => void) | undefined;
  onTerminalActivity?: ((terminalId: string) => void) | undefined;
};

export const CanvasTerminalColumn = ({
  node,
  terminals,
  layoutVersion,
  isFocused,
  onMinimize,
  onClose,
  onFocus,
  panelRef,
  onTerminalRenamed,
  onTerminalActivity,
}: CanvasTerminalColumnProps) => {
  const [agentState, setAgentState] = useState<AgentRuntimeState>("idle");

  const terminal = terminals.find((t) => t.terminalId === node.sessionId);
  const rawName = terminal?.coordinationName ?? node.coordinationId;
  const coordinationName = rawName.length > 24 ? `${rawName.slice(0, 24)}...` : rawName;
  const workspaceMode = terminal?.workspaceMode ?? "shared";

  const handleFocus = useCallback(() => {
    onFocus?.();
  }, [onFocus]);

  if (!node.sessionId) return null;

  return (
    <section
      ref={panelRef}
      className={`canvas-terminal-column${isFocused ? " canvas-terminal-column--focused" : ""}`}
      tabIndex={-1}
      onPointerDown={handleFocus}
      onFocusCapture={handleFocus}
    >
      <div className="canvas-terminal-column-header">
        <div className="canvas-terminal-column-heading">
          <h2>
            <span className="canvas-terminal-column-name">{coordinationName}</span>
            {workspaceMode === "worktree" && (
              <span className="canvas-terminal-column-badge">WT</span>
            )}
          </h2>
        </div>
        <div className="canvas-terminal-column-actions">
          <span
            className="canvas-terminal-column-orchestration-tag"
            style={{ background: node.color }}
          >
            {node.coordinationId}
          </span>
          <AgentStateBadge state={agentState} />
          <button
            type="button"
            className="canvas-terminal-column-minimize"
            onClick={onMinimize}
            aria-label="Minimize terminal panel"
            title="Minimize terminal panel"
          >
            <Minus size={14} />
          </button>
          <button
            type="button"
            className="canvas-terminal-column-close"
            onClick={onClose}
            aria-label="Close terminal session"
            title="Close terminal session"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="canvas-terminal-column-body">
        <Terminal
          terminalId={node.sessionId}
          terminalLabel={node.label}
          {...(layoutVersion === undefined ? {} : { layoutVersion })}
          onAgentRuntimeStateChange={setAgentState}
          {...(onTerminalRenamed ? { onTerminalRenamed } : {})}
          {...(onTerminalActivity ? { onTerminalActivity } : {})}
        />
      </div>
    </section>
  );
};
