import { Grid3x3, Minus, Plus, Scan } from "lucide-react";

type ConsoleCanvasViewportControlsProps = {
  scale: number;
  showGrid: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onToggleGrid: () => void;
};

export const ConsoleCanvasViewportControls = ({
  scale,
  showGrid,
  onZoomIn,
  onZoomOut,
  onFitView,
  onToggleGrid,
}: ConsoleCanvasViewportControlsProps): React.ReactElement => {
  const zoomPercent = Math.round(scale * 100);

  return (
    <div
      className="pointer-events-auto absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-border bg-surface/90 p-1 shadow-2xl backdrop-blur"
      aria-label="Canvas viewport controls"
    >
      <button
        type="button"
        onClick={onZoomOut}
        className="flex items-center gap-1 rounded px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
      >
        <Minus className="size-3" strokeWidth={2} aria-hidden />
        Zoom
      </button>
      <span className="px-1 font-mono text-[10px] text-muted-foreground">{zoomPercent}%</span>
      <button
        type="button"
        onClick={onZoomIn}
        className="flex items-center gap-1 rounded px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
      >
        <Plus className="size-3" strokeWidth={2} aria-hidden />
        Zoom
      </button>
      <div className="mx-1 h-4 w-px bg-border" aria-hidden />
      <button
        type="button"
        onClick={onFitView}
        className="flex items-center gap-1 rounded px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
      >
        <Scan className="size-3" strokeWidth={2} aria-hidden />
        Fit
      </button>
      <button
        type="button"
        onClick={onToggleGrid}
        aria-pressed={showGrid}
        className={`flex items-center gap-1 rounded px-2.5 py-1 text-[11px] transition-colors ${
          showGrid
            ? "bg-foreground/10 text-foreground"
            : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
        }`}
      >
        <Grid3x3 className="size-3" strokeWidth={2} aria-hidden />
        Grid
      </button>
    </div>
  );
};
