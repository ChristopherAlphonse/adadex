import { CONSOLE_NAV } from "./data";
import { Meter } from "./ConsolePrimitives";

export const AdadexConsoleHeader = (): React.ReactElement => (
  <header className="relative flex h-14 shrink-0 items-center border-b border-border bg-background/80 px-5 backdrop-blur-xl">
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2.5">
        <div className="flex size-7 items-center justify-center rounded-md bg-foreground text-background">
          <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
            <path d="M12 2L2 19.7778H22L12 2Z" />
          </svg>
        </div>
        <span className="text-[15px] font-semibold tracking-tight text-foreground">Adadex</span>
      </div>
      <span className="text-muted-foreground/40">/</span>
      <button
        type="button"
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] font-medium text-foreground hover:bg-white/5"
      >
        production
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
    </div>

    <nav className="mx-6 hidden h-full flex-1 items-center justify-center gap-1 lg:flex">
      {CONSOLE_NAV.map((item) => {
        const active = item.n === 1;
        return (
          <button
            key={item.n}
            type="button"
            className={`relative flex h-full items-center gap-2 whitespace-nowrap px-3 text-[13px] font-medium transition-colors ${
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>{item.label}</span>
            <kbd
              className={`hidden h-[18px] min-w-[18px] items-center justify-center rounded border px-1 font-mono text-[10px] xl:inline-flex ${
                active
                  ? "border-brand/30 bg-brand/10 text-brand"
                  : "border-border bg-white/[0.03] text-muted-foreground/70"
              }`}
            >
              {item.n}
            </kbd>
            {active ? (
              <span className="absolute bottom-0 left-2 right-2 h-px bg-foreground" />
            ) : null}
          </button>
        );
      })}
    </nav>

    <div className="ml-auto flex shrink-0 items-center gap-2">
      <div className="hidden items-center gap-3 pr-1 xl:flex">
        <Meter label="Codex" value={30} />
        <Meter label="Weekly" value={7} muted />
      </div>
    </div>
  </header>
);
