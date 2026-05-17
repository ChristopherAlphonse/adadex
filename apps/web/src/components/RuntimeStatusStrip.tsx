import { useEffect, useMemo, useRef, useState } from "react";
import type { UsageChartData } from "../app/hooks/useUsageHeatmapPolling";
import type { CodexUsageSnapshot } from "../app/types";

type RuntimeStatusStripProps = {
  usageData: UsageChartData | null;
  codexUsage: CodexUsageSnapshot | null;
  isRefreshingCodexUsage?: boolean;
  onRefreshCodexUsage?: () => void;
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

const pct = (value: number | null | undefined, loading?: boolean): string => {
  if (loading) return "···";
  return value == null ? "NA" : `${Math.round(value)}%`;
};

const usageState = (
  codexUsage: CodexUsageSnapshot | null,
): {
  label: string;
  loading: boolean;
  sessionPercent: number | null | undefined;
  weekPercent: number | null | undefined;
  message?: string;
} => {
  if (codexUsage === null) {
    return {
      label: "Session",
      loading: true,
      sessionPercent: 0,
      weekPercent: 0,
    };
  }

  const label = codexUsage.source === "oauth-api" ? "5h" : "Session";
  if (codexUsage.status === "ok") {
    return {
      label,
      loading: false,
      sessionPercent: codexUsage.primaryUsedPercent,
      weekPercent: codexUsage.secondaryUsedPercent,
    };
  }

  return {
    label,
    loading: false,
    sessionPercent: null,
    weekPercent: null,
    message: codexUsage.message ?? "Usage unavailable",
  };
};

const UsageRail = ({
  label,
  percent,
  loading,
  title,
}: {
  label: string;
  percent: number | null | undefined;
  loading?: boolean;
  title?: string;
}) => {
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);

  const showTooltip = (clientX: number, clientY: number) => {
    if (!title) return;
    setTooltip({ x: clientX, y: clientY });
  };

  return (
    <div
      className="console-status-usage-row"
      data-has-tooltip={title ? "true" : undefined}
      tabIndex={title ? 0 : -1}
      onMouseEnter={(event) => showTooltip(event.clientX, event.clientY)}
      onMouseMove={(event) => showTooltip(event.clientX, event.clientY)}
      onMouseLeave={() => setTooltip(null)}
      onBlur={() => setTooltip(null)}
      onFocus={(event) => {
        if (!title) return;
        const rect = event.currentTarget.getBoundingClientRect();
        setTooltip({ x: rect.left + 24, y: rect.bottom + 8 });
      }}
    >
      <span className="console-status-usage-row-meta">
        <span className="console-status-usage-row-label">{label}</span>
        <span className="console-status-usage-row-value">{pct(percent, loading)}</span>
      </span>
      <span className="console-status-usage-rail">
        <span
          className="console-status-usage-rail-fill"
          style={{ width: `${Math.min(100, percent ?? 0)}%` }}
        />
      </span>
      {title && tooltip ? (
        <span
          className="console-status-usage-tooltip"
          style={{
            left: `${Math.max(8, tooltip.x - 260)}px`,
            top: `${Math.min(window.innerHeight - 80, tooltip.y + 14)}px`,
          }}
        >
          {title}
        </span>
      ) : null}
    </div>
  );
};

export const RuntimeStatusStrip = ({
  usageData,
  codexUsage,
  isRefreshingCodexUsage = false,
  onRefreshCodexUsage,
}: RuntimeStatusStripProps) => {
  const _usageBars = useMemo(() => (usageData ? buildUsageBars(usageData) : []), [usageData]);
  const codexUsageState = usageState(codexUsage);
  const [showRefreshSpin, setShowRefreshSpin] = useState(false);
  const refreshStartedAtRef = useRef<number | null>(null);
  const refreshHideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (refreshHideTimerRef.current !== null) {
        window.clearTimeout(refreshHideTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isRefreshingCodexUsage) {
      if (refreshHideTimerRef.current !== null) {
        window.clearTimeout(refreshHideTimerRef.current);
        refreshHideTimerRef.current = null;
      }
      refreshStartedAtRef.current = Date.now();
      setShowRefreshSpin(true);
      return;
    }

    if (refreshStartedAtRef.current === null) {
      setShowRefreshSpin(false);
      return;
    }

    const elapsedMs = Date.now() - refreshStartedAtRef.current;
    const remainingMs = Math.max(0, 450 - elapsedMs);
    refreshHideTimerRef.current = window.setTimeout(() => {
      setShowRefreshSpin(false);
      refreshStartedAtRef.current = null;
      refreshHideTimerRef.current = null;
    }, remainingMs);
  }, [isRefreshingCodexUsage]);

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
      <div className="console-status-codex-usage" aria-label="Codex usage limits">
        {onRefreshCodexUsage && (
          <button
            type="button"
            className="console-status-codex-usage-refresh"
            onClick={onRefreshCodexUsage}
            aria-label="Refresh Codex usage"
            title="Refresh Codex usage"
            data-refreshing={showRefreshSpin ? "true" : "false"}
          >
            ↻
          </button>
        )}
        <span className="console-status-codex-usage-title">
          CODEX
          <br />
          USAGE
        </span>
        <div className="console-status-codex-usage-bars">
          <UsageRail
            label={codexUsageState.label}
            percent={codexUsageState.sessionPercent}
            loading={codexUsageState.loading}
            {...(codexUsageState.message ? { title: codexUsageState.message } : {})}
          />
          <UsageRail
            label="Week (all)"
            percent={codexUsageState.weekPercent}
            loading={codexUsageState.loading}
            {...(codexUsageState.message ? { title: codexUsageState.message } : {})}
          />
        </div>
      </div>
    </section>
  );
};
