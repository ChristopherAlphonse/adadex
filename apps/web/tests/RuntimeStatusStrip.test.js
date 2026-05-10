import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RuntimeStatusStrip } from "../src/components/RuntimeStatusStrip";
describe("RuntimeStatusStrip", () => {
    it("shows loading placeholders before Codex usage loads", () => {
        render(_jsx(RuntimeStatusStrip, { sparklinePoints: "", usageData: null, codexUsage: null }));
        const usage = screen.getByLabelText("Codex usage limits");
        expect(within(usage).getAllByText("···")).toHaveLength(2);
    });
    it("uses a 5h label for oauth-backed usage", () => {
        render(_jsx(RuntimeStatusStrip, { sparklinePoints: "", usageData: null, codexUsage: {
                status: "ok",
                source: "oauth-api",
                fetchedAt: "2026-04-09T10:00:00.000Z",
                primaryUsedPercent: 14,
                secondaryUsedPercent: 52,
            } }));
        const usage = screen.getByLabelText("Codex usage limits");
        expect(within(usage).getByText("5h")).toBeInTheDocument();
        expect(within(usage).getByText("14%")).toBeInTheDocument();
        expect(within(usage).getByText("52%")).toBeInTheDocument();
    });
    it("shows unavailable values instead of a permanent loading state", () => {
        render(_jsx(RuntimeStatusStrip, { sparklinePoints: "", usageData: null, codexUsage: {
                status: "unavailable",
                source: "none",
                fetchedAt: "2026-04-09T10:00:00.000Z",
                message: "Codex credentials not found. Run `codex login`.",
            } }));
        const usage = screen.getByLabelText("Codex usage limits");
        expect(within(usage).getAllByText("NA")).toHaveLength(2);
        expect(within(usage).queryByText("···")).toBeNull();
    });
    it("marks the refresh button as rotating while Codex usage is refreshing", () => {
        render(_jsx(RuntimeStatusStrip, { sparklinePoints: "", usageData: null, codexUsage: null, isRefreshingCodexUsage: true, onRefreshCodexUsage: () => { } }));
        expect(screen.getByRole("button", { name: "Refresh Codex usage" })).toHaveAttribute("data-refreshing", "true");
    });
});
