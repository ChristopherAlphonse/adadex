import type { MessageSegment, Question, QuestionForm, QuestionOption } from "../domain/transcript";
import { type ParsedValue, asRecord, asString } from "../util/typeCoercion";

const MAX_QUESTIONS = 10;

const MAX_OPTIONS = 8;

const FORM_FENCE = /```questions[ \t]*\r?\n([\s\S]*?)```/g;

const parseOption = (value: ParsedValue): QuestionOption | null => {
  const record = asRecord(value);
  const label = record ? asString(record.label) : null;

  if (!record || !label) {
    return null;
  }

  return { label, detail: asString(record.detail), recommended: record.recommended === true };
};

const parseQuestion = (value: ParsedValue, index: number): Question | null => {
  const record = asRecord(value);
  const text = record ? asString(record.text) : null;

  if (!record || !text || !Array.isArray(record.options)) {
    return null;
  }

  const options = record.options
    .slice(0, MAX_OPTIONS)
    .flatMap((option) => parseOption(option) ?? []);

  return options.length > 0 ? { id: asString(record.id) ?? `q${index + 1}`, text, options } : null;
};

const parseForm = (body: string): QuestionForm | null => {
  let record: ReturnType<typeof asRecord>;

  try {
    record = asRecord(JSON.parse(body));
  } catch {
    return null;
  }

  if (!record || !Array.isArray(record.questions)) {
    return null;
  }

  const questions = record.questions
    .slice(0, MAX_QUESTIONS)
    .flatMap((question, index) => parseQuestion(question, index) ?? []);

  return questions.length > 0 ? { title: asString(record.title) ?? "Questions", questions } : null;
};

/** Splits a message into plain text and question forms. A `questions` block that is not valid stays plain text. */
export const splitQuestionForms = (text: string): MessageSegment[] => {
  const segments: MessageSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(FORM_FENCE)) {
    const form = parseForm(match[1] ?? "");
    const start = match.index ?? 0;

    if (form) {
      const before = text.slice(cursor, start);

      if (before.trim().length > 0) {
        segments.push({ kind: "text", text: before });
      }

      segments.push({ kind: "form", form });
      cursor = start + match[0].length;
    }
  }

  const rest = text.slice(cursor);

  if (rest.trim().length > 0 || segments.length === 0) {
    segments.push({ kind: "text", text: rest });
  }

  return segments;
};

export type QuestionAnswer = { optionIndex: number | null; note: string };

/** The message sent back to the agent: one line per question, "unanswered" where nothing was chosen. */
export const formatQuestionAnswers = (
  form: QuestionForm,
  answers: readonly (QuestionAnswer | undefined)[],
): string => {
  const lines = form.questions.map((question, index) => {
    const answer = answers[index];

    const option =
      answer?.optionIndex === null ? undefined : question.options[answer?.optionIndex ?? -1];

    const note = answer?.note.trim() ?? "";
    const chosen = option ? option.label : note.length > 0 ? "Other" : "unanswered";

    return `${question.id} (${question.text}): ${chosen}${note.length > 0 ? ` - ${note}` : ""}`;
  });

  return [`Answers to "${form.title}":`, ...lines].join("\n");
};
