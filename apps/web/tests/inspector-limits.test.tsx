import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InspectorLimits } from "../src/components/design-system/InspectorLimits";

describe("InspectorLimits", () => {
  it("explains when there is no usage yet", () => {
    render(<InspectorLimits stats={null} />);
    expect(screen.getByText(/No usage yet/)).toBeTruthy();
  });

  it("shows context, cache hit rate and the last request", () => {
    render(
      <InspectorLimits
        stats={{
          model: "claude-sonnet-5-5",
          requestCount: 3,
          contextTokens: 180_000,
          lastRequest: { input: 2, output: 122, cacheRead: 179_000, cacheCreation: 1000 },
          cacheHitRate: 0.96,
          totalOutput: 4000,
          firstAt: "2026-11-22T06:00:00.000Z",
          lastAt: "2026-11-22T06:03:00.000Z",
        }}
      />,
    );

    expect(screen.getByText("180k tokens")).toBeTruthy();
    expect(screen.getByText("96%")).toBeTruthy();
    expect(screen.getByText("122 out")).toBeTruthy();
    expect(screen.getByText("3m 0s")).toBeTruthy();
  });
});
