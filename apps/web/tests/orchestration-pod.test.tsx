import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OrchestrationPod } from "../src/components/deck/OrchestrationPod";

describe("OrchestrationPod skill editor", () => {
  it("saves suggested skills from the deck pod", async () => {
    const onSaveSuggestedSkills = vi.fn().mockResolvedValue(true);

    render(
      <OrchestrationPod
        orchestration={{
          coordinationId: "docs",
          displayName: "Docs",
          description: "Docs and knowledge.",
          status: "idle",
          color: "#ff6b2b",
          mascot: {
            animation: null,
            expression: null,
            accessory: null,
            hairColor: null,
          },
          scope: { paths: [], tags: [] },
          vaultFiles: ["todo.md"],
          todoTotal: 0,
          todoDone: 0,
          todoItems: [],
          suggestedSkills: ["docs-writer"],
        }}
        visuals={{
          color: "#ff6b2b",
          animation: "sway",
          expression: "happy",
          accessory: "none",
        }}
        isFocused={false}
        availableSkills={[
          {
            name: "docs-writer",
            description: "Keeps docs aligned with the product.",
            source: "project",
          },
          {
            name: "release-helper",
            description: "Helps with release coordination.",
            source: "user",
          },
        ]}
        onSaveSuggestedSkills={onSaveSuggestedSkills}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Skills" }));
    fireEvent.click(screen.getByLabelText(/release-helper/i));
    fireEvent.click(screen.getByRole("button", { name: /save skills/i }));

    await waitFor(() => {
      expect(onSaveSuggestedSkills).toHaveBeenCalledWith("docs", ["docs-writer", "release-helper"]);
    });
  });
});
