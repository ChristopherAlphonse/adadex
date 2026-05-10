import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { GitHubPrimaryView } from "./GitHubPrimaryView";
import { UsageBarChart } from "./UsageHeatmap";
export const ActivityPrimaryView = ({ usageChartProps, githubPrimaryViewProps, }) => {
    return (_jsxs("section", { className: "activity-view", "aria-label": "Activity primary view", children: [_jsx(UsageBarChart, { ...usageChartProps }), _jsx(GitHubPrimaryView, { ...githubPrimaryViewProps })] }));
};
