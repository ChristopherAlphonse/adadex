import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { OrchestrationPod } from "../src/components/deck/OrchestrationPod";

const orchestration = {
  coordinationId: "docs",
  displayName: "Docs",
  description: "Docs and knowledge.",
  status: "idle" as const,
  color: "#ff6b2b",
  mascot: { animation: null, expression: null, accessory: null, hairColor: null },
  scope: { paths: [], tags: [] },
  vaultFiles: ["todo.md"],
  todoTotal: 2,
  todoDone: 1,
  todoItems: [
    { text: "Write the intro", done: true },
    { text: "Review the API page", done: false },
  ],
  suggestedSkills: ["docs-writer"],
};

const visuals = {
  color: "#ff6b2b",
  animation: "breathe" as const,
  expression: "happy" as const,
  accessory: "none" as const,
};

describe("OrchestrationPod card", () => {
  it("shows a simple preview with progress and the next todo", () => {
    render(<OrchestrationPod isFocused={false} orchestration={orchestration} visuals={visuals} />);

    expect(screen.getByText("Docs")).toBeTruthy();
    expect(screen.getByText("1 of 2")).toBeTruthy();
    expect(screen.getByText("Review the API page")).toBeTruthy();
  });

  it("opens the agent panel when the card name is clicked", () => {
    const onOpen = vi.fn();

    render(
      <OrchestrationPod
        isFocused={false}
        onOpen={onOpen}
        orchestration={orchestration}
        visuals={visuals}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Docs" }));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
