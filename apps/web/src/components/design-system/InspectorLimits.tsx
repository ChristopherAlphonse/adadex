import type { UsageSummary } from "@adadex/core";

import { KV, Section } from "./ConsolePrimitives";

const formatTokens = (value: number): string =>
  value >= 1000 ? `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}k` : String(value);

const formatPercent = (value: number | null): string =>
  value === null ? "—" : `${Math.round(value * 100)}%`;

const formatSpan = (firstAt: string | null, lastAt: string | null): string => {
  if (!firstAt || !lastAt) {
    return "—";
  }

  const seconds = Math.round((Date.parse(lastAt) - Date.parse(firstAt)) / 1000);

  if (!Number.isFinite(seconds) || seconds < 0) {
    return "—";
  }

  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};

/** Token use of a session. Plan limits and cost are not shown: neither is in the transcript. */
export const InspectorLimits = ({ stats }: { stats: UsageSummary | null }) => {
  if (!stats || !stats.lastRequest) {
    return (
      <div className="p-5 text-[15px] text-muted-foreground">
        No usage yet. It appears after the agent finishes its first turn.
      </div>
    );
  }

  return (
    <>
      <Section title="Context">
        <div className="space-y-1">
          <KV label="Model" value={stats.model ?? "—"} mono />
          <KV label="In context" value={`${formatTokens(stats.contextTokens)} tokens`} mono />
          <KV label="Requests" value={String(stats.requestCount)} mono />
          <KV label="Total output" value={`${formatTokens(stats.totalOutput)} tokens`} mono />
          <KV label="Active time" value={formatSpan(stats.firstAt, stats.lastAt)} mono />
        </div>
      </Section>
      <Section title="Cache">
        <div className="space-y-1">
          <KV label="Hit rate" value={formatPercent(stats.cacheHitRate)} mono />
          <KV label="Last input" value={`${formatTokens(stats.lastRequest.input)} in`} mono />
          <KV label="Last output" value={`${formatTokens(stats.lastRequest.output)} out`} mono />
          <KV
            label="Last cached"
            value={`${formatTokens(stats.lastRequest.cacheRead)} read`}
            mono
          />
          <KV
            label="Last written"
            value={`${formatTokens(stats.lastRequest.cacheCreation)} written`}
            mono
          />
        </div>
      </Section>
    </>
  );
};
