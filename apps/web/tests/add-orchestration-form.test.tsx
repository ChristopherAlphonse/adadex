import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AddOrchestrationForm } from "../src/components/deck/AddOrchestrationForm";

describe("AddOrchestrationForm", () => {
  it("submits selected suggested skills", () => {
    const onSubmit = vi.fn();

    render(
      <AddOrchestrationForm
        onSubmit={onSubmit}
        onCancel={() => {}}
        isSubmitting={false}
        error={null}
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
      />,
    );

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "docs" } });
    fireEvent.click(screen.getByLabelText(/docs-writer/i));
    fireEvent.click(screen.getByRole("button", { name: /create coordination/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      "docs",
      "",
      expect.any(String),
      expect.objectContaining({
        animation: expect.any(String),
        expression: expect.any(String),
        accessory: expect.any(String),
        hairColor: expect.any(String),
      }),
      ["docs-writer"],
    );
  });

  it("submits the selected hair color", () => {
    const onSubmit = vi.fn();

    render(
      <AddOrchestrationForm
        onSubmit={onSubmit}
        onCancel={() => {}}
        isSubmitting={false}
        error={null}
        availableSkills={[]}
      />,
    );

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "docs" } });
    fireEvent.click(screen.getByLabelText("Select hair color #E04020 · rgb(224, 64, 32)"));
    fireEvent.click(screen.getByRole("button", { name: /create coordination/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      "docs",
      "",
      expect.any(String),
      expect.objectContaining({
        hairColor: "#e04020",
      }),
      [],
    );
  });
});
