import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ActionButton } from "../src/components/ui/ActionButton";
import { StatusBadge } from "../src/components/ui/StatusBadge";

describe("UI primitives", () => {
  it("renders action button variants and size classes", () => {
    render(
      <ActionButton size="compact" variant="danger">
        Delete
      </ActionButton>,
    );

    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass(
      "action-button",
      "action-button--danger",
      "action-button--compact",
    );
  });

  it("renders status badges with semantic tone classes", () => {
    render(<StatusBadge tone="processing" />);

    expect(screen.getByText("PROCESSING").closest(".status-badge")).toHaveClass(
      "status-badge",
      "pill",
      "processing",
    );
  });
});
