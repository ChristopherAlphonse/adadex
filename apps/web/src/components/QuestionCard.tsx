import { type QuestionAnswer, type QuestionForm, formatQuestionAnswers } from "@adadex/core";
import { useState } from "react";

import { cn } from "@/lib/utils";

type QuestionCardProps = {
  form: QuestionForm;
  /** True when an answer to this form is already in the conversation. */
  answered?: boolean;
  /** Sends the answers to the agent. Without it the card is read-only. */
  onSend?: ((text: string) => Promise<void>) | undefined;
};

type Choice = number | "other" | null;

type Draft = { choice: Choice; note: string };

const LETTERS = "abcdefghijklmnopqrstuvwxyz";

const initialDrafts = (form: QuestionForm): Draft[] =>
  form.questions.map((question) => {
    const recommended = question.options.findIndex((option) => option.recommended);

    return { choice: recommended >= 0 ? recommended : null, note: "" };
  });

const toAnswer = (draft: Draft): QuestionAnswer => ({
  optionIndex: draft.choice === "other" ? null : draft.choice,
  note: draft.note,
});

export const QuestionCard = ({ form, answered = false, onSend }: QuestionCardProps) => {
  const [drafts, setDrafts] = useState<Draft[]>(() => initialDrafts(form));

  const [status, setStatus] = useState<"editing" | "sending" | "sent">(
    answered ? "sent" : "editing",
  );

  const [error, setError] = useState<string | null>(null);
  const locked = status !== "editing" || !onSend;

  const update = (index: number, patch: Partial<Draft>) => {
    setDrafts((current) =>
      current.map((draft, position) => (position === index ? { ...draft, ...patch } : draft)),
    );
  };

  const send = async () => {
    if (!onSend) {
      return;
    }

    setStatus("sending");
    setError(null);

    try {
      await onSend(formatQuestionAnswers(form, drafts.map(toAnswer)));
      setStatus("sent");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to send the answers.");
      setStatus("editing");
    }
  };

  return (
    <section
      aria-label={form.title}
      className="overflow-hidden rounded-xl border border-border bg-card text-sm"
      data-question-title={form.title}
    >
      <header className="px-4 pt-3 pb-1">
        <p className="m-0 font-medium">{form.title}</p>
        <p className="m-0 text-xs text-muted-foreground">
          {form.questions.length === 1 ? "1 question" : `${form.questions.length} questions`}
        </p>
      </header>
      {form.questions.map((question, index) => {
        const draft = drafts[index] ?? { choice: null, note: "" };

        return (
          <fieldset
            className="m-0 flex min-w-0 flex-col gap-1.5 border-0 border-t border-border px-4 py-3"
            disabled={locked}
            key={question.id}
          >
            <legend className="float-left mb-1.5 w-full p-0 font-medium">{question.text}</legend>
            {[...question.options.map((option) => option.label), "Other / none of these"].map(
              (label, optionIndex) => {
                const isOther = optionIndex === question.options.length;
                const option = isOther ? undefined : question.options[optionIndex];
                const value: Choice = isOther ? "other" : optionIndex;
                const selected = draft.choice === value;

                return (
                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-2.5 rounded-lg border border-border px-3 py-2",
                      selected ? "border-primary bg-surface-2" : "",
                      locked ? "cursor-default opacity-80" : "",
                    )}
                    key={label}
                  >
                    <input
                      checked={selected}
                      className="mt-1"
                      name={`${form.title}-${question.id}`}
                      onChange={() => {
                        update(index, { choice: value });
                      }}
                      type="radio"
                    />
                    <span className="flex-1">
                      <span>{label}</span>
                      {option?.recommended ? (
                        <span className="ml-2 rounded-full border border-border px-1.5 text-[11px] text-muted-foreground">
                          Recommended
                        </span>
                      ) : null}
                      {option?.detail ? (
                        <span className="block text-xs text-muted-foreground">{option.detail}</span>
                      ) : null}
                    </span>
                    <span className="rounded border border-border px-1.5 font-mono text-[11px] text-muted-foreground">
                      {LETTERS[optionIndex]}
                    </span>
                  </label>
                );
              },
            )}
            <input
              aria-label={`Note for ${question.text}`}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
              onChange={(event) => {
                update(index, { note: event.target.value });
              }}
              placeholder="Note (optional)"
              type="text"
              value={draft.note}
            />
          </fieldset>
        );
      })}
      <footer className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5">
        <span className="text-xs text-muted-foreground">
          {error ??
            (status === "sent"
              ? "Answers sent."
              : onSend
                ? "Questions you leave blank are sent as unanswered."
                : "Open this in a live session to answer.")}
        </span>
        <button
          className="rounded-lg bg-foreground px-3 py-1.5 text-sm font-semibold text-background disabled:opacity-40"
          disabled={locked}
          onClick={() => {
            void send();
          }}
          type="button"
        >
          {status === "sending" ? "Sending…" : "Send answers"}
        </button>
      </footer>
    </section>
  );
};
