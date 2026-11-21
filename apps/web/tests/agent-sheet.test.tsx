import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { formatColorForDisplay, MASCOT_COLORS } from "../src/app/mascotPalette";
import { AgentSheet } from "../src/components/deck/AgentSheet";

const orchestration = {
  coordinationId: "docs",
  displayName: "Docs",
  description: "Docs and knowledge.",
  status: "idle" as const,
  color: "#ff6b2b",
  mascot: { animation: null, expression: null, accessory: null, hairColor: null },
  scope: { paths: [], tags: [] },
  vaultFiles: ["todo.md"],
  todoTotal: 0,
  todoDone: 0,
  todoItems: [],
  suggestedSkills: ["docs-writer"],
};

const visuals = {
  color: "#ff6b2b",
  animation: "breathe" as const,
  expression: "happy" as const,
  accessory: "none" as const,
};

const availableSkills = [
  { name: "docs-writer", description: "Keeps docs aligned with the product.", source: "project" },
  { name: "release-helper", description: "Helps with release coordination.", source: "user" },
] as const;

const renderSheet = (overrides: Partial<Parameters<typeof AgentSheet>[0]> = {}) =>
  render(
    <AgentSheet
      availableSkills={[...availableSkills]}
      onClose={vi.fn()}
      onVaultBrowse={vi.fn()}
      onVaultFileClick={vi.fn()}
      orchestration={orchestration}
      visuals={visuals}
      {...overrides}
    />,
  );

describe("AgentSheet", () => {
  it("saves suggested skills from the panel", async () => {
    const onSaveSuggestedSkills = vi.fn().mockResolvedValue(true);

    renderSheet({ onSaveSuggestedSkills });

    fireEvent.click(screen.getByRole("button", { name: "Edit skills" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /release-helper/i }));
    fireEvent.click(screen.getByRole("button", { name: /save skills/i }));

    await waitFor(() => {
      expect(onSaveSuggestedSkills).toHaveBeenCalledWith("docs", ["docs-writer", "release-helper"]);
    });
  });

  it("opens the customize options when the mascot face is clicked", () => {
    renderSheet();

    expect(screen.queryByText("Preview a mood")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Customize this agent" }));

    expect(screen.getByText("Preview a mood")).toBeTruthy();
  });

  it("saves the selected color from the customize panel", async () => {
    const onSaveMascot = vi.fn().mockResolvedValue(true);
    const onSaveAgent = vi.fn().mockResolvedValue(true);

    renderSheet({ onSaveAgent, onSaveMascot });

    fireEvent.click(screen.getByRole("button", { name: "Customize this agent" }));
    const selected = MASCOT_COLORS[6] ?? MASCOT_COLORS[0];
    const swatch = screen.getByLabelText(`Use color ${formatColorForDisplay(selected)}`);
    fireEvent.click(swatch);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onSaveMascot).toHaveBeenCalledWith(
        "docs",
        expect.objectContaining({ color: selected }),
      );
    });
    expect(onSaveAgent).not.toHaveBeenCalled();
  });

  it("shows an error when the color save fails", async () => {
    const onSaveMascot = vi.fn().mockResolvedValue(false);

    renderSheet({ onSaveMascot });

    fireEvent.click(screen.getByRole("button", { name: "Customize this agent" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Could not save the mascot color.")).toBeTruthy();
  });

  it("offers the expanded color palette with US spelling", () => {
    renderSheet();

    fireEvent.click(screen.getByRole("button", { name: "Customize this agent" }));

    expect(screen.getAllByLabelText(/Use color /i).length).toBeGreaterThanOrEqual(12);
    expect(screen.queryByLabelText(/Use colour/i)).toBeNull();
  });

  it("asks for confirmation before deleting", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    renderSheet({ onDelete, onClose });

    fireEvent.click(screen.getByRole("button", { name: /delete orchestration/i }));

    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /yes, delete/i }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith("docs");
      expect(onClose).toHaveBeenCalled();
    });
  });
});
