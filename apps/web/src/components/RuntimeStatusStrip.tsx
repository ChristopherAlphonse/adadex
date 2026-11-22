import { isNumber } from "@adadex/core";
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

  const totals = days.map((day) => (isNumber(day.totalTokens) ? day.totalTokens : 0));
  const max = Math.max(...totals, 1);
  const barSlot = MINI_USAGE_WIDTH / days.length;
  const barWidth = Math.max(1, barSlot - MINI_BAR_GAP);

  return days.map((day, index) => {
    const totalTokens = isNumber(day.totalTokens) ? day.totalTokens : 0;
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
    </section>
  );
};
