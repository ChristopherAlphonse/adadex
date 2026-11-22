import { Pencil, Trash2 } from "lucide-react";
import { Fragment, useState } from "react";

import { cn } from "../../lib/utils";

/** Renders `backticked` spans as inline code, so todo text reads the way it was written. */
export const renderInlineCode = (text: string) =>
  text.split(/(`[^`]+`)/).map((part, position) =>
    part.startsWith("`") && part.endsWith("`") && part.length > 2 ? (
      <code
        className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.85em]"
        key={`code-${position}`}
      >
        {part.slice(1, -1)}
      </code>
    ) : (
      <Fragment key={`text-${position}`}>{part}</Fragment>
    ),
  );

type TodoRowProps = {
  id: string;
  text: string;
  done: boolean;
  onToggle: () => void;
  onEdit?: ((text: string) => void) | undefined;
  onDelete?: (() => void) | undefined;
};

export const TodoRow = ({ id, text, done, onToggle, onEdit, onDelete }: TodoRowProps) => {
  const [draft, setDraft] = useState<string | null>(null);

  if (draft !== null) {
    const save = () => {
      const next = draft.trim();

      if (next && next !== text) onEdit?.(next);
      setDraft(null);
    };

    return (
      <input
        aria-label="Edit todo"
        ref={(element) => element?.focus()}
        className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground outline-none focus:border-primary"
        onBlur={save}
        onChange={(event) => {
          setDraft(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") save();

          if (event.key === "Escape") setDraft(null);
        }}
        value={draft}
      />
    );
  }

  return (
    <div className="group/todo flex items-start rounded-lg transition-colors hover:bg-surface-2">
      <label
        className={cn(
          "flex min-w-0 flex-1 cursor-pointer items-start gap-3 px-2 py-2 text-sm leading-snug",
          done && "text-muted-foreground line-through",
        )}
        htmlFor={id}
      >
        <input
          checked={done}
          className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]"
          id={id}
          onChange={onToggle}
          type="checkbox"
        />
        <span className="min-w-0">{renderInlineCode(text)}</span>
      </label>
      <span className="flex shrink-0 items-center gap-0.5 py-1.5 pr-1.5 opacity-0 group-focus-within/todo:opacity-100 group-hover/todo:opacity-100">
        {onEdit ? (
          <button
            aria-label="Edit todo text"
            className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
            onClick={() => {
              setDraft(text);
            }}
            type="button"
          >
            <Pencil size={13} />
          </button>
        ) : null}
        {onDelete ? (
          <button
            aria-label="Delete todo"
            className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-background hover:text-destructive"
            onClick={onDelete}
            type="button"
          >
            <Trash2 size={13} />
          </button>
        ) : null}
      </span>
    </div>
  );
};

type AddTodoProps = { onAdd: (text: string) => void };

export const AddTodo = ({ onAdd }: AddTodoProps) => {
  const [text, setText] = useState("");

  const submit = () => {
    const next = text.trim();

    if (!next) return;

    onAdd(next);
    setText("");
  };

  return (
    <input
      aria-label="Add a todo"
      className="w-full rounded-lg border border-dashed border-border bg-transparent px-2.5 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
      onChange={(event) => {
        setText(event.target.value);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") submit();
      }}
      placeholder="Add a todo, then press Enter"
      value={text}
    />
  );
};
