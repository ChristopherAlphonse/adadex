type AdadexConsoleFooterProps = {
  visibleCount: number;
  totalCount: number;
};

export const AdadexConsoleFooter = ({
  visibleCount,
  totalCount,
}: AdadexConsoleFooterProps): React.ReactElement => (
  <footer className="flex h-8 shrink-0 items-center justify-between border-t border-border bg-surface px-4 text-[14px] text-muted-foreground">
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="size-1.5 animate-pulse rounded-full bg-running" />
        <span className="font-medium text-foreground/90">Mesh connected</span>
        <span className="font-mono text-muted-foreground">12ms</span>
      </div>
      <div className="h-3.5 w-px bg-border" />
      <span>us-east-1</span>
      <div className="h-3.5 w-px bg-border" />
      <span>
        {visibleCount} of {totalCount} agents
      </span>
    </div>
    <div className="flex items-center gap-4">
      <span className="font-mono">UTF-8</span>
      <span className="font-mono">Ln 104, Col 32</span>
      <span className="font-mono text-brand">v0.8.2</span>
    </div>
  </footer>
);
