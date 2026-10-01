import { useMemo } from "react";
import type { UsageChartData } from "../app/hooks/useUsageHeatmapPolling";

type RuntimeStatusStripProps = {
  usageData: UsageChartData | null;
};

const MINI_USAGE_WIDTH = 160;
const MINI_USAGE_HEIGHT = 28;
const MINI_BAR_GAP = 1;

type MiniBar = { x: number; y: number; width: number; height: number };

const buildUsageBars = (data: UsageChartData): MiniBar[] => {
  const days = Array.isArray(data.days) ? data.days.slice(-30) : [];
  if (days.length === 0) return [];

  const totals = days.map((day) => (typeof day.totalTokens === "number" ? day.totalTokens : 0));
  const max = Math.max(...totals, 1);
  const barSlot = MINI_USAGE_WIDTH / days.length;
  const barWidth = Math.max(1, barSlot - MINI_BAR_GAP);

  return days.map((day, index) => {
    const totalTokens = typeof day.totalTokens === "number" ? day.totalTokens : 0;
    const h = Math.max(0.5, (totalTokens / max) * (MINI_USAGE_HEIGHT - 2));
    return {
      x: index * barSlot,
      y: MINI_USAGE_HEIGHT - h,
      width: barWidth,
      height: h,
    };
  });
};

export const RuntimeStatusStrip = ({ usageData }: RuntimeStatusStripProps) => {
  const _usageBars = useMemo(() => (usageData ? buildUsageBars(usageData) : []), [usageData]);

  return (
    <section className="console-status-strip" aria-label="Runtime status strip">
      <div className="console-status-main">
        <span className="console-status-brand">ADADEX</span>
      </div>
      {/* <div className="console-status-charts">
        <div
          className="console-status-sparkline"
          aria-label="Commits per day over last 30 days"
        >
          <div className="console-status-sparkline-chart">
            <svg
              viewBox={`0 0 ${GITHUB_SPARKLINE_WIDTH} ${GITHUB_SPARKLINE_HEIGHT}`}
              role="presentation"
            >
              <polyline points={sparklinePoints} />
            </svg>
          </div>
          <span className="console-status-sparkline-label">
            COMMITS/DAY · LAST 30 DAYS
          </span>
        </div>
        <div
          className="console-status-usage-mini"
          aria-label="Agent token usage last 30 days"
        >
          {usageBars.length > 0 ? (
            <>
              <div className="console-status-usage-mini-chart">
                <svg
                  viewBox={`0 0 ${MINI_USAGE_WIDTH} ${MINI_USAGE_HEIGHT}`}
                  role="presentation"
                >
                  {usageBars.map((bar, index) => (
                    <rect
                      key={`${index}-${bar.x}-${bar.height}`}
                      x={bar.x}
                      y={bar.y}
                      width={bar.width}
                      height={bar.height}
                      rx={0.5}
                    />
                  ))}
                </svg>
              </div>
              <span className="console-status-sparkline-label">
                AGENT TOKENS/DAY · LAST 30 DAYS
              </span>
            </>
          ) : (
            <span className="console-status-sparkline-label">USAGE —</span>
          )}
        </div>
      </div> */}
    </section>
  );
};
