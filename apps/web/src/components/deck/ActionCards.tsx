import { Check } from "lucide-react";

import type { TerminalAgentProvider } from "../../app/types";
import { OctopusGlyph } from "../EmptyOctopus";

export const AGENT_PROVIDER_OPTIONS: { value: TerminalAgentProvider; label: string }[] = [
  { value: "codex", label: "Codex" },
];

export type ActionCardsProps = {
  compact?: boolean;
  selectedAgent: TerminalAgentProvider;
  setSelectedAgent: (agent: TerminalAgentProvider) => void;
  agentMenuOpen: boolean;
  setAgentMenuOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  agentMenuRef: React.RefObject<HTMLDivElement | null>;
  onAddManually: () => void;
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
  onAddManually,
  onLaunchAgent,
  isLaunchingAgent,
}: ActionCardsProps) => (
  <div className={`deck-empty-actions${compact ? " deck-empty-actions--compact" : ""}`}>
    <button type="button" className="deck-empty-card" onClick={onAddManually}>
      <div className="deck-empty-card-icon">
        <OctopusGlyph
          color="#d4a017"
          animation="idle"
          expression="normal"
          accessory="none"
          scale={compact ? 3 : 4}
        />
      </div>
      <div className="deck-empty-card-text">
        <span className="deck-empty-card-title">Create First Tentacle</span>
        <span className="deck-empty-card-desc">
          Start the deck by creating a tentacle for your codebase
        </span>
      </div>
    </button>
    <div className="deck-empty-card">
      <span className="deck-empty-card-icon deck-empty-card-icon--terminal">&gt;_</span>
      <div className="deck-empty-card-text">
        <span className="deck-empty-card-title">Open Agent</span>
        <span className="deck-empty-card-desc">
          Launch your coding agent to create tentacles based on your codebase
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
    <button type="button" className="deck-empty-card" onClick={onAddManually}>
      <span className="deck-empty-card-icon deck-empty-card-icon--terminal">+</span>
      <div className="deck-empty-card-text">
        <span className="deck-empty-card-title">Add Tentacle Manually</span>
        <span className="deck-empty-card-desc">
          Create a custom tentacle with your own configuration
        </span>
      </div>
    </button>
  </div>
);
