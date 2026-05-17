import type { TerminalAgentProvider } from "@adadex/core";
import { Check, Moon, Sun } from "lucide-react";
import { useCallback, useRef, useState } from "react";

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
  isLight?: boolean;
  onToggleColorTheme?: () => void;
};

const codexMeterValues = (
  codexUsage: CodexUsageSnapshot | null,
  isRefreshing: boolean,
  agentProvider: TerminalAgentProvider,
): {
  primary: number;
  secondary: number;
  primaryLabel: string;
  weekLabel: string;
  available: boolean;
} => {
  const providerLabel = agentProvider === "codex" ? "Codex" : agentProvider;
  if (agentProvider !== "codex") {
    return {
      primary: 0,
      secondary: 0,
      primaryLabel: providerLabel,
      weekLabel: "Weekly",
      available: false,
    };
  }
  if (isRefreshing || codexUsage === null) {
    return {
      primary: 0,
      secondary: 0,
      primaryLabel: providerLabel,
      weekLabel: "Weekly",
      available: false,
    };
  }
  if (codexUsage.status !== "ok") {
    return {
      primary: 0,
      secondary: 0,
      primaryLabel: providerLabel,
      weekLabel: "Weekly",
      available: false,
    };
  }
  const primary = Number(codexUsage.primaryUsedPercent ?? 0);
  const secondary = Number(codexUsage.secondaryUsedPercent ?? 0);
  return {
    primary: Number.isFinite(primary) ? Math.round(primary) : 0,
    secondary: Number.isFinite(secondary) ? Math.round(secondary) : 0,
    primaryLabel: codexUsage.source === "oauth-api" ? "5h" : providerLabel,
    weekLabel: "Weekly",
    available: true,
  };
};

export const ConsoleChromeHeader = ({
  activePrimaryNav,
  onPrimaryNavChange,
  agentProvider,
  onAgentProviderChange,
  codexUsage,
  isRefreshingCodexUsage = false,
  isLight = false,
  onToggleColorTheme,
}: ConsoleChromeHeaderProps): React.ReactElement => {
  const meters = codexMeterValues(codexUsage, isRefreshingCodexUsage, agentProvider);
  const [providerMenuOpen, setProviderMenuOpen] = useState(false);
  const providerMenuRef = useRef<HTMLDivElement | null>(null);
  const dismissProviderMenu = useCallback(() => setProviderMenuOpen(false), []);
  useClickOutside(providerMenuRef, providerMenuOpen, dismissProviderMenu);

  const providerLabel =
    AGENT_PROVIDER_OPTIONS.find((option) => option.value === agentProvider)?.label ?? agentProvider;

  return (
    <header className="relative z-[100] flex h-14 shrink-0 items-center border-b border-border bg-background/80 px-5 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <span className="text-[17px] font-semibold tracking-[0.12em] text-foreground">ADADEX</span>
        <span className="text-muted-foreground/40">/</span>
        <div className="relative" ref={providerMenuRef}>
          <button
            type="button"
            aria-expanded={providerMenuOpen}
            aria-haspopup="menu"
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[15px] font-medium text-foreground hover:bg-foreground/5"
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
              className="absolute left-0 top-[calc(100%+4px)] z-[110] min-w-[9rem] rounded-md border border-border bg-surface py-1 shadow-lg"
              role="menu"
            >
              {AGENT_PROVIDER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-[15px] text-foreground hover:bg-foreground/5"
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
              className={`relative flex h-full items-center gap-2 whitespace-nowrap px-3 text-[15px] font-medium transition-colors ${
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{item.label}</span>
              <kbd
                className={`hidden h-[20px] min-w-[20px] items-center justify-center rounded border px-1 font-mono text-[12px] xl:inline-flex ${
                  active
                    ? "border-border bg-foreground/10 text-foreground"
                    : "border-border bg-foreground/[0.03] text-muted-foreground/70"
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
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
          aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
          onClick={onToggleColorTheme}
        >
          {isLight ? (
            <Moon className="size-4" strokeWidth={2} />
          ) : (
            <Sun className="size-4" strokeWidth={2} />
          )}
        </button>
        <div
          className="hidden items-center gap-3 pr-1 xl:flex"
          title={meters.available ? undefined : `Usage stats not available for ${agentProvider}`}
        >
          <Meter label={meters.primaryLabel} value={meters.primary} muted={!meters.available} />
          <Meter label={meters.weekLabel} value={meters.secondary} muted />
        </div>
      </div>
    </header>
  );
};
