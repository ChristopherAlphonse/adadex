import { describe, expect, it } from "vitest";

import { formatQuestionAnswers, splitQuestionForms } from "../src";

const block = (body: string) => `Before.\n\`\`\`questions\n${body}\n\`\`\`\nAfter.`;

const valid = JSON.stringify({
  title: "Before I fix it",
  questions: [
    {
      id: "q1",
      text: "What should the shopper see?",
      options: [
        { label: "Inline error", recommended: true, detail: "under the field" },
        { label: "Toast" },
      ],
    },
    { text: "Add a test?", options: [{ label: "Yes" }, { label: "No" }] },
  ],
});

describe("splitQuestionForms", () => {
  it("splits text around a valid form and fills in defaults", () => {
    const segments = splitQuestionForms(block(valid));

    expect(segments.map((s) => s.kind)).toEqual(["text", "form", "text"]);

    const form = segments[1];

    expect(form?.kind === "form" && form.form.questions[1]?.id).toBe("q2");
    expect(form?.kind === "form" && form.form.questions[0]?.options[0]?.recommended).toBe(true);
  });

  it("leaves an invalid block as plain text", () => {
    const segments = splitQuestionForms(block("{not json"));

    expect(segments).toHaveLength(1);
    expect(segments[0]?.kind).toBe("text");
  });

  it("ignores questions with no options", () => {
    const segments = splitQuestionForms(
      block(JSON.stringify({ questions: [{ text: "x", options: [] }] })),
    );

    expect(segments.every((s) => s.kind === "text")).toBe(true);
  });
});

describe("formatQuestionAnswers", () => {
  it("lists each answer, marks blanks unanswered, and keeps notes", () => {
    const segment = splitQuestionForms(block(valid)).find((s) => s.kind === "form");
    const form = segment?.kind === "form" ? segment.form : null;

    if (!form) {
      throw new Error("expected a form");
    }

    const text = formatQuestionAnswers(form, [
      { optionIndex: 0, note: "keep it short" },
      undefined,
    ]);

    expect(text).toContain('Answers to "Before I fix it":');
    expect(text).toContain("q1 (What should the shopper see?): Inline error - keep it short");
    expect(text).toContain("q2 (Add a test?): unanswered");
  });
});
