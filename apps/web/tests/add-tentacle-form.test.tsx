import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AddTentacleForm } from "../src/components/deck/AddTentacleForm";

describe("AddTentacleForm", () => {
  it("submits selected suggested skills", () => {
    const onSubmit = vi.fn();

    render(
      <AddTentacleForm
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
    fireEvent.click(screen.getByRole("button", { name: /create tentacle/i }));

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
});
