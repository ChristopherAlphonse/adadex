import type { QuestionForm } from "@adadex/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { QuestionCard } from "../src/components/QuestionCard";

const form: QuestionForm = {
  title: "Before I fix it",
  questions: [
    {
      id: "q1",
      text: "What should the shopper see?",
      options: [
        { label: "Inline error", detail: "under the field", recommended: true },
        { label: "Toast", detail: null, recommended: false },
      ],
    },
    {
      id: "q2",
      text: "Add a test?",
      options: [
        { label: "Yes", detail: null, recommended: false },
        { label: "No", detail: null, recommended: false },
      ],
    },
  ],
};

describe("QuestionCard", () => {
  it("preselects the recommended option and sends the answers", async () => {
    const onSend = vi.fn(async (_text: string) => {});

    render(<QuestionCard form={form} onSend={onSend} />);
    expect(screen.getByText("Recommended")).toBeTruthy();

    const radios = screen.getAllByRole("radio");

    expect(radios).toHaveLength(6);
    fireEvent.click(radios[4] ?? radios[0] ?? document.body);
    fireEvent.change(screen.getByLabelText("Note for What should the shopper see?"), {
      target: { value: "short" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send answers" }));

    await waitFor(() => {
      expect(onSend).toHaveBeenCalledTimes(1);
    });

    const text = onSend.mock.calls[0]?.[0] ?? "";

    expect(text).toContain("q1 (What should the shopper see?): Inline error - short");
    expect(text).toContain("q2 (Add a test?): No");
    await waitFor(() => {
      expect(screen.getByText("Answers sent.")).toBeTruthy();
    });
  });

  it("shows the failure and lets the user try again", async () => {
    const onSend = vi.fn(async () => {
      throw new Error("agent not running");
    });

    render(<QuestionCard form={form} onSend={onSend} />);
    fireEvent.click(screen.getByRole("button", { name: "Send answers" }));

    await waitFor(() => {
      expect(screen.getByText("agent not running")).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: "Send answers" })).toHaveProperty("disabled", false);
  });

  it("is read-only without a sender and when already answered", () => {
    const first = render(<QuestionCard form={form} />);

    expect(screen.getByRole("button", { name: "Send answers" })).toHaveProperty("disabled", true);
    first.unmount();

    render(<QuestionCard answered form={form} onSend={async () => {}} />);
    expect(screen.getByText("Answers sent.")).toBeTruthy();
  });
});
