import { Check } from "lucide-react";
import { useState } from "react";

import {
  EFFORT_OPTIONS,
  readAgentLaunchSettings,
  writeAgentLaunchSettings,
} from "../../app/agentLaunchOptions";
import { AGENT_PROVIDER_OPTIONS } from "../../app/agentProviders";
import type { TerminalAgentProvider } from "../../app/types";
import { CuteMascot } from "./CuteMascot";

export type ActionCardsProps = {
  compact?: boolean;
  selectedAgent: TerminalAgentProvider;
  setSelectedAgent: (agent: TerminalAgentProvider) => void;
  agentMenuOpen: boolean;
  setAgentMenuOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  agentMenuRef: React.RefObject<HTMLDivElement | null>;
  onAdd: () => void;
  onLaunchAgent: () => void;
  isLaunchingAgent?: boolean;
};

export const ActionCards = ({
  compact,
  selectedAgent,
  setSelectedAgent,
  agentMenuOpen,
  setAgentMenuOpen,
  agentMenuRef,
  onAdd,
  onLaunchAgent,
  isLaunchingAgent,
}: ActionCardsProps) => {
  const [launchSettings, setLaunchSettings] = useState(readAgentLaunchSettings);

  const changeLaunchSettings = (patch: Partial<typeof launchSettings>) => {
    const next = { ...launchSettings, ...patch };

    setLaunchSettings(next);
    writeAgentLaunchSettings(next);
  };

  return (
    <div className={`deck-empty-actions${compact ? " deck-empty-actions--compact" : ""}`}>
      <button type="button" className="deck-empty-card" onClick={onAdd}>
        <div className="deck-empty-card-icon">
          <CuteMascot color="#34d399" size={compact ? 96 : 120} state="happy" />
        </div>
        <div className="deck-empty-card-text">
          <span className="deck-empty-card-title">Add Orchestration</span>
          <span className="deck-empty-card-desc">
            Start the deck by creating a orchestration for your codebase
          </span>
        </div>
      </button>
      <div className="deck-empty-card">
        <span className="deck-empty-card-icon deck-empty-card-icon--terminal">&gt;_</span>
        <div className="deck-empty-card-text">
          <span className="deck-empty-card-title">Open Agent</span>
          <span className="deck-empty-card-desc">
            Launch your coding agent to create orchestrations based on your codebase
          </span>
          <div className="deck-empty-agent-select-row">
            <div className="deck-empty-agent-picker" ref={agentMenuRef}>
              <button
                type="button"
                className="deck-empty-agent-trigger"
                aria-expanded={agentMenuOpen}
                aria-haspopup="menu"
                onClick={() => setAgentMenuOpen((p: boolean) => !p)}
              >
                {AGENT_PROVIDER_OPTIONS.find((o) => o.value === selectedAgent)?.label}
                <svg className="deck-empty-agent-chevron" viewBox="0 0 10 6" aria-hidden="true">
                  <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </button>
              {agentMenuOpen && (
                <div className="deck-empty-agent-menu" role="menu">
                  {AGENT_PROVIDER_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className="deck-empty-agent-menu-item"
                      role="menuitem"
                      data-active={opt.value === selectedAgent ? "true" : "false"}
                      onClick={() => {
                        setSelectedAgent(opt.value);
                        setAgentMenuOpen(false);
                      }}
                    >
                      {opt.label}
                      {opt.value === selectedAgent && (
                        <span className="deck-empty-agent-menu-check">
                          <Check size={12} />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedAgent === "claude" ? (
              <>
                <input
                  aria-label="Model (optional)"
                  className="deck-empty-agent-trigger"
                  onChange={(event) => {
                    changeLaunchSettings({ model: event.target.value.trim() });
                  }}
                  placeholder="model (default)"
                  size={16}
                  type="text"
                  value={launchSettings.model}
                />
                <select
                  aria-label="Effort"
                  className="deck-empty-agent-trigger"
                  onChange={(event) => {
                    changeLaunchSettings({ effort: event.target.value });
                  }}
                  value={launchSettings.effort}
                >
                  {EFFORT_OPTIONS.map((level) => (
                    <option key={level} value={level}>
                      {level === "" ? "effort (default)" : level}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
            <button
              type="button"
              className="deck-empty-agent-launch"
              disabled={isLaunchingAgent}
              onClick={onLaunchAgent}
            >
              {isLaunchingAgent ? "..." : "Launch"}
            </button>
          </div>
        </div>
      </div>
      <button type="button" className="deck-empty-card" onClick={onAdd}>
        <span className="deck-empty-card-icon deck-empty-card-icon--terminal">+</span>
        <div className="deck-empty-card-text">
          <span className="deck-empty-card-title">Add Another</span>
          <span className="deck-empty-card-desc">
            Create a custom orchestration with your own configuration
          </span>
        </div>
      </button>
    </div>
  );
};
