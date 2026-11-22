import { isFunctionValue } from "@adadex/core";
import {
  GitBranch,
  Hexagon,
  Layers,
  ListTodo,
  Sparkles,
  Terminal as TerminalIcon,
  Trash2,
} from "lucide-react";

import type { TerminalWorkspaceMode } from "../../app/types";
import type { CanvasPrimaryViewProps } from "../CanvasPrimaryView";
import type { ContextMenuState } from "./canvasSupport";

type ExternalHandlers = {
  [
    K in
      | "onCreateOrchestration"
      | "onCreateTerminal"
      | "onCreateWorktreeTerminal"
      | "onDeleteActiveSession"
  ]?: CanvasPrimaryViewProps[K] | undefined;
};

type CanvasContextMenuProps = ExternalHandlers & {
  menu: ContextMenuState;
  onClose: () => void;
  /** Opens the terminal of an agent that was just created. */
  onOpenAgent: (agentId: string) => void;
  onCreateAgent: (coordinationId: string) => void;
  onOrchestrationAction: (coordinationId: string, action: string) => void;
  onSpawnSwarm: (coordinationId: string, workspaceMode: TerminalWorkspaceMode) => Promise<void>;
  onDeckLeadAction: (action: string) => void;
};

/** The right-click menu on the agents canvas. What it offers depends on what was clicked. */
export const CanvasContextMenu = ({
  menu,
  onClose,
  onOpenAgent,
  onCreateAgent,
  onOrchestrationAction,
  onSpawnSwarm,
  onDeckLeadAction,
  onCreateOrchestration,
  onCreateTerminal,
  onCreateWorktreeTerminal,
  onDeleteActiveSession,
}: CanvasContextMenuProps) => (
  <>
    <button
      type="button"
      aria-label="Close canvas context menu"
      className="canvas-context-menu-backdrop"
      onClick={() => onClose()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        requestAnimationFrame(() => {
          const under = document.elementFromPoint(e.clientX, e.clientY);

          if (under) {
            under.dispatchEvent(
              new MouseEvent("contextmenu", {
                bubbles: true,
                clientX: e.clientX,
                clientY: e.clientY,
              }),
            );
          }
        });
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " " && e.key !== "Escape") return;
        e.preventDefault();
        onClose();
      }}
    />
    <div
      className="canvas-context-menu"
      style={{ left: `${menu.x}px`, top: `${menu.y}px` }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        requestAnimationFrame(() => {
          const under = document.elementFromPoint(e.clientX, e.clientY);

          if (under) {
            under.dispatchEvent(
              new MouseEvent("contextmenu", {
                bubbles: true,
                clientX: e.clientX,
                clientY: e.clientY,
              }),
            );
          }
        });
      }}
    >
      {menu.kind === "canvas" && (
        <>
          <button
            type="button"
            className="canvas-context-menu-item"
            onClick={() => {
              onClose();
              onCreateOrchestration?.();
            }}
          >
            <span className="canvas-context-menu-icon">
              <Hexagon size={14} />
            </span>
            New Orchestration
          </button>
          <button
            type="button"
            className="canvas-context-menu-item"
            onClick={() => {
              onClose();
              const result = onCreateTerminal?.();

              if (result && isFunctionValue(result.then)) {
                void result.then((agentId) => {
                  if (agentId) onOpenAgent(agentId);
                });
              }
            }}
          >
            <span className="canvas-context-menu-icon">
              <TerminalIcon size={14} />
            </span>
            New Terminal
          </button>
          <button
            type="button"
            className="canvas-context-menu-item"
            onClick={() => {
              onClose();
              const result = onCreateWorktreeTerminal?.();

              if (result && isFunctionValue(result.then)) {
                void result.then((agentId) => {
                  if (agentId) onOpenAgent(agentId);
                });
              }
            }}
          >
            <span className="canvas-context-menu-icon">
              <GitBranch size={14} />
            </span>
            New Worktree Terminal
          </button>
        </>
      )}
      {menu.kind === "orchestration" && (
        <>
          <button
            type="button"
            className="canvas-context-menu-item"
            onClick={() => onCreateAgent(menu.coordinationId)}
          >
            <span className="canvas-context-menu-icon">
              <TerminalIcon size={14} />
            </span>
            Create new agent
          </button>
          <button
            type="button"
            className="canvas-context-menu-item"
            onClick={() => {
              onClose();
              const result = onCreateWorktreeTerminal?.();

              if (result && isFunctionValue(result.then)) {
                void result.then((agentId) => {
                  if (agentId) onOpenAgent(agentId);
                });
              }
            }}
          >
            <span className="canvas-context-menu-icon">
              <GitBranch size={14} />
            </span>
            New Worktree Terminal
          </button>
          <button
            type="button"
            className="canvas-context-menu-item"
            onClick={() =>
              onOrchestrationAction(menu.coordinationId, "coordination-reorganize-todos")
            }
          >
            <span className="canvas-context-menu-icon">
              <ListTodo size={14} />
            </span>
            Update To-Do List
          </button>
          <button
            type="button"
            className="canvas-context-menu-item"
            onClick={() => onOrchestrationAction(menu.coordinationId, "coordination-update")}
          >
            <span className="canvas-context-menu-icon">
              <Hexagon size={14} />
            </span>
            Update Orchestration
          </button>
          <button
            type="button"
            className="canvas-context-menu-item"
            onClick={() => {
              void onSpawnSwarm(menu.coordinationId, "worktree");
            }}
          >
            <span className="canvas-context-menu-icon">
              <Layers size={14} />
            </span>
            Spawn Swarm (Worktrees)
          </button>
          <button
            type="button"
            className="canvas-context-menu-item"
            onClick={() => {
              void onSpawnSwarm(menu.coordinationId, "shared");
            }}
          >
            <span className="canvas-context-menu-icon">
              <Layers size={14} />
            </span>
            Spawn Swarm (Normal)
          </button>
        </>
      )}
      {menu.kind === "deck-lead" && (
        <>
          <button
            type="button"
            className="canvas-context-menu-item"
            onClick={() => onDeckLeadAction("deck-lead-reorganize-todos")}
          >
            <span className="canvas-context-menu-icon">
              <ListTodo size={14} />
            </span>
            Reorganize To-Do's
          </button>
          <button
            type="button"
            className="canvas-context-menu-item"
            onClick={() => onDeckLeadAction("deck-lead-reorganize-coordinations")}
          >
            <span className="canvas-context-menu-icon">
              <Hexagon size={14} />
            </span>
            Reorganize Coordinations
          </button>
          <button
            type="button"
            className="canvas-context-menu-item"
            onClick={() => onDeckLeadAction("deck-lead-clean-contexts")}
          >
            <span className="canvas-context-menu-icon">
              <Sparkles size={14} />
            </span>
            Clean Coordination Contexts
          </button>
        </>
      )}
      {menu.kind === "active-session" && (
        <button
          type="button"
          className="canvas-context-menu-item canvas-context-menu-item--danger"
          onClick={() => {
            onDeleteActiveSession?.(menu.sessionId, menu.label, menu.workspaceMode);
            onClose();
          }}
        >
          <span className="canvas-context-menu-icon">
            <Trash2 size={14} />
          </span>
          Delete
        </button>
      )}
    </div>
  </>
);
