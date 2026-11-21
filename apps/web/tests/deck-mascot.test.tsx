import { render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { ActionCards } from "../src/components/deck/ActionCards";
import { WorkspaceSetupCard } from "../src/components/deck/WorkspaceSetupCard";

describe("Deck mascot surfaces", () => {
  it("uses the new mascot in the empty-state cards", () => {
    const { container } = render(
      <ActionCards
        selectedAgent="claude"
        setSelectedAgent={vi.fn()}
        agentMenuOpen={false}
        setAgentMenuOpen={vi.fn()}
        agentMenuRef={createRef<HTMLDivElement>()}
        onAdd={vi.fn()}
        onLaunchAgent={vi.fn()}
      />,
    );

    expect(container.querySelector(".cute-mascot")).not.toBeNull();
    expect(container.querySelector("canvas")).toBeNull();
  });

  it("uses the new mascot in the workspace setup card", () => {
    const { container } = render(
      <WorkspaceSetupCard
        workspaceSetup={null}
        isLoading={false}
        error={null}
        onRunStep={vi.fn()}
        onLaunchAgent={vi.fn()}
      />,
    );

    expect(container.querySelector(".cute-mascot")).not.toBeNull();
    expect(container.querySelector("canvas")).toBeNull();
  });
});
