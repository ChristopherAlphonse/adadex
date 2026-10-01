import { Moon, Sun } from "lucide-react";

import { PRIMARY_NAV_ITEMS, type PrimaryNavIndex } from "../../app/constants";

type ConsoleChromeHeaderProps = {
  activePrimaryNav: PrimaryNavIndex;
  onPrimaryNavChange: (index: PrimaryNavIndex) => void;
  isLight?: boolean;
  onToggleColorTheme?: () => void;
};

export const ConsoleChromeHeader = ({
  activePrimaryNav,
  onPrimaryNavChange,
  isLight = false,
  onToggleColorTheme,
}: ConsoleChromeHeaderProps): React.ReactElement => {
  return (
    <header className="relative z-[100] flex h-14 shrink-0 items-center border-b border-border bg-background/80 px-5 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <span className="text-[17px] font-semibold tracking-[0.12em] text-foreground">ADADEX</span>
        <span className="text-muted-foreground/40">/</span>
        <span className="px-2 py-1 text-[15px] font-medium text-foreground">kiro</span>
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
              aria-current={active ? "page" : undefined}
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
      </div>
    </header>
  );
};
