import { useCallback, useRef, useState } from "react";

import type { TerminalAgentProvider } from "@adadex/core";
import { Check } from "lucide-react";

import { AGENT_PROVIDER_OPTIONS } from "../../app/agentProviders";
import { PRIMARY_NAV_ITEMS, type PrimaryNavIndex } from "../../app/constants";
import { useClickOutside } from "../../app/hooks/useClickOutside";
import type { CodexUsageSnapshot } from "../../app/types";
import { Meter } from "./ConsolePrimitives";

type ConsoleChromeHeaderProps = {
  activePrimaryNav: PrimaryNavIndex;
  onPrimaryNavChange: (index: PrimaryNavIndex) => void;
  agentProvider: TerminalAgentProvider;
  onAgentProviderChange: (provider: TerminalAgentProvider) => void;
  codexUsage: CodexUsageSnapshot | null;
  isRefreshingCodexUsage?: boolean;
};

const codexMeterValues = (
  codexUsage: CodexUsageSnapshot | null,
  isRefreshing: boolean,
): { primary: number; secondary: number; primaryLabel: string } => {
  if (isRefreshing || codexUsage === null) {
    return { primary: 0, secondary: 0, primaryLabel: "Codex" };
  }
  if (codexUsage.status !== "ok") {
    return { primary: 0, secondary: 0, primaryLabel: "Codex" };
  }
  const primary = Number(codexUsage.primaryUsedPercent ?? 0);
  const secondary = Number(codexUsage.secondaryUsedPercent ?? 0);
  return {
    primary: Number.isFinite(primary) ? Math.round(primary) : 0,
    secondary: Number.isFinite(secondary) ? Math.round(secondary) : 0,
    primaryLabel: codexUsage.source === "oauth-api" ? "5h" : "Codex",
  };
};

export const ConsoleChromeHeader = ({
  activePrimaryNav,
  onPrimaryNavChange,
  agentProvider,
  onAgentProviderChange,
  codexUsage,
  isRefreshingCodexUsage = false,
}: ConsoleChromeHeaderProps): React.ReactElement => {
  const meters = codexMeterValues(codexUsage, isRefreshingCodexUsage);
  const [providerMenuOpen, setProviderMenuOpen] = useState(false);
  const providerMenuRef = useRef<HTMLDivElement | null>(null);
  const dismissProviderMenu = useCallback(() => setProviderMenuOpen(false), []);
  useClickOutside(providerMenuRef, providerMenuOpen, dismissProviderMenu);

  const providerLabel =
    AGENT_PROVIDER_OPTIONS.find((option) => option.value === agentProvider)?.label ??
    agentProvider;

  return (
    <header className="relative flex h-14 shrink-0 items-center border-b border-border bg-background/80 px-5 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <span className="text-[15px] font-semibold tracking-[0.12em] text-foreground">ADADEX</span>
        <span className="text-muted-foreground/40">/</span>
        <div className="relative" ref={providerMenuRef}>
          <button
            type="button"
            aria-expanded={providerMenuOpen}
            aria-haspopup="menu"
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] font-medium text-foreground hover:bg-white/5"
            onClick={() => setProviderMenuOpen((open) => !open)}
          >
            {providerLabel}
            <svg
              className="size-3.5 text-muted-foreground"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {providerMenuOpen ? (
            <div
              className="absolute left-0 top-[calc(100%+4px)] z-50 min-w-[9rem] rounded-md border border-border bg-surface py-1 shadow-lg"
              role="menu"
            >
              {AGENT_PROVIDER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-[13px] text-foreground hover:bg-white/5"
                  onClick={() => {
                    onAgentProviderChange(option.value);
                    setProviderMenuOpen(false);
                  }}
                >
                  <span>{option.label}</span>
                  {option.value === agentProvider ? (
                    <Check className="size-3.5 text-muted-foreground" aria-hidden />
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <span className="rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand">
          Live
        </span>
      </div>

      <nav
        aria-label="Primary navigation"
        className="mx-6 hidden h-full min-w-0 flex-1 items-center justify-center gap-1 md:flex"
      >
        {PRIMARY_NAV_ITEMS.map((item) => {
          const active = item.index === activePrimaryNav;
          return (
            <button
              key={item.index}
              type="button"
              onClick={() => onPrimaryNavChange(item.index)}
              className={`relative flex h-full items-center gap-2 whitespace-nowrap px-3 text-[13px] font-medium transition-colors ${
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{item.label}</span>
              <kbd
                className={`hidden h-[18px] min-w-[18px] items-center justify-center rounded border px-1 font-mono text-[10px] xl:inline-flex ${
                  active
                    ? "border-border bg-white/10 text-foreground"
                    : "border-border bg-white/[0.03] text-muted-foreground/70"
                }`}
              >
                {item.index}
              </kbd>
              {active ? (
                <span className="absolute bottom-0 left-2 right-2 h-px bg-foreground" />
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <button
          type="button"
          className="hidden items-center gap-2 rounded-md border border-border bg-white/[0.02] px-3 py-1.5 text-[12.5px] text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground md:flex"
        >
          <svg
            className="size-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <span>Search</span>
          <kbd className="ml-4 flex h-5 items-center gap-0.5 rounded border border-border bg-background px-1.5 font-mono text-[10px] text-muted-foreground">
            <span>Ctrl</span>K
          </kbd>
        </button>
        {agentProvider === "codex" ? (
          <>
            <div className="mx-1 hidden h-6 w-px bg-border md:block" />
            <div className="hidden items-center gap-3 pr-1 xl:flex">
              <Meter label={meters.primaryLabel} value={meters.primary} />
              <Meter label="Weekly" value={meters.secondary} muted />
            </div>
          </>
        ) : null}
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-white/5 hover:text-foreground"
          aria-label="Notifications"
        >
          <svg
            className="size-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
        </button>
        <div className="size-8 rounded-full bg-gradient-to-br from-brand to-stale ring-2 ring-background" />
      </div>
    </header>
  );
};
