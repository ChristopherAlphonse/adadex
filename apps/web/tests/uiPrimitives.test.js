import { render, screen } from "@testing-library/react";
import { jsx as _jsx } from "react/jsx-runtime";
import { describe, expect, it } from "vitest";
import { ActionButton } from "../src/components/ui/ActionButton";
import { StatusBadge } from "../src/components/ui/StatusBadge";

describe("UI primitives", () => {
  it("renders action button variants and size classes", () => {
    render(_jsx(ActionButton, { size: "compact", variant: "danger", children: "Delete" }));
    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass(
      "action-button",
      "action-button--danger",
      "action-button--compact",
    );
  });
  it("renders status badges with semantic tone classes", () => {
    render(_jsx(StatusBadge, { tone: "processing" }));
    expect(screen.getByText("PROCESSING").closest(".status-badge")).toHaveClass(
      "status-badge",
      "pill",
      "processing",
    );
  });
});
