import type { ComponentProps } from "react";

import { GitHubPrimaryView } from "./GitHubPrimaryView";
import { UsageBarChart } from "./UsageHeatmap";

type ActivityPrimaryViewProps = {
  usageChartProps: ComponentProps<typeof UsageBarChart>;
  githubPrimaryViewProps: ComponentProps<typeof GitHubPrimaryView>;
};

export const ActivityPrimaryView = ({
  usageChartProps,
  githubPrimaryViewProps,
}: ActivityPrimaryViewProps) => {
  return (
    <section className="activity-view" aria-label="Activity primary view">
      <UsageBarChart {...usageChartProps} />
      <GitHubPrimaryView {...githubPrimaryViewProps} />
    </section>
  );
};
