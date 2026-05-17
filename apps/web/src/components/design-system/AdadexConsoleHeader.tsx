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
      <span className="rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand">
        Live
      </span>
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
        <span>Search…</span>
        <kbd className="ml-4 flex h-5 items-center gap-0.5 rounded border border-border bg-background px-1.5 font-mono text-[10px] text-muted-foreground">
          <span>⌘</span>K
        </kbd>
      </button>

      <div className="mx-1 hidden h-6 w-px bg-border md:block" />

      <div className="hidden items-center gap-3 pr-1 xl:flex">
        <Meter label="Codex" value={30} />
        <Meter label="Weekly" value={7} muted />
      </div>

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
